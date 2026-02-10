const fs = require('fs');
const ssh2 = require('ssh2');
const path = require('path');
const db = require('./db');
const { processDockerContainers } = require('./docker_monitor');
const { detectAnomalies } = require('./anomaly_detector');

// Promisify DB run
const dbRun = (sql, params) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const dbAll = (sql, params) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

// --- Configuration ---
// For now, let's assume hosts are stored in the DB as per db.js schema.
// We also need SSH keys. We'll look for ~/.ssh/id_rsa by default or use environment variables.

const SSH_KEY_PATH = process.env.SSH_KEY_PATH || path.join(process.env.HOME, '.ssh/id_rsa');
let privateKey;
try {
    privateKey = fs.readFileSync(SSH_KEY_PATH);
} catch (err) {
    console.warn(`Warning: Could not read SSH key from ${SSH_KEY_PATH}. Ensure it exists or set SSH_KEY_PATH.`);
    // We might proceed if password auth is used, but key is standard.
}

// --- SSH Command Execution Helper ---
function execCommand(client, command, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Command '${command}' timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        client.exec(command, (err, stream) => {
            if (err) {
                clearTimeout(timeout);
                return reject(err);
            }
            let stdout = '';
            let stderr = '';
            stream.on('close', (code, signal) => {
                clearTimeout(timeout);
                if (code !== 0) {
                     reject(new Error(`Command failed with code ${code}: ${stderr}`));
                } else {
                    resolve(stdout.trim());
                }
            }).on('data', (data) => {
                stdout += data;
            }).stderr.on('data', (data) => {
                stderr += data;
            });
        });
    });
}

// --- Parsers ---

function parseMemInfo(output) {
    // Parse /proc/meminfo
    if (!output) return null;
    
    const lines = output.split('\n');
    let total = 0;
    let available = 0;
    
    for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length < 2) continue;
        
        const key = parts[0].replace(':', '');
        const val = parseInt(parts[1], 10); // kB
        
        if (key === 'MemTotal') total = Math.floor(val / 1024); // MB
        if (key === 'MemAvailable') available = Math.floor(val / 1024); // MB
    }

    if (total > 0) {
        return { total, used: total - available };
    }
    return null;
}

function parseDisk(dfOutput) {
    if (!dfOutput) return null;
    
    // Expected `df -m /` output:
    // Filesystem     1M-blocks  Used Available Use% Mounted on
    // /dev/sda1         102400 50000     52400  49% /
    
    const lines = dfOutput.split('\n');
    // Skip header, take the second line
    if (lines.length < 2) return null;
    
    const parts = lines[1].split(/\s+/);
    if (parts.length < 4) return null;

    const total = parseInt(parts[1], 10);
    const used = parseInt(parts[2], 10);
    
    return { total, used };
}

function parseLoadAvg(loadOutput) {
    // cat /proc/loadavg
    // 0.00 0.01 0.05 1/192 12345
    if (!loadOutput) return 0.0;
    
    const parts = loadOutput.split(/\s+/);
    if (parts.length > 0) {
        return parseFloat(parts[0]);
    }
    return 0.0;
}

// --- Main Collection Logic ---

async function collectMetricsForMachine(machine) {
    const conn = new ssh2.Client();
    
    return new Promise((resolve, reject) => {
        const connectionTimeout = setTimeout(() => {
            conn.end();
            console.error(`Connection timeout for ${machine.hostname}`);
             // We need to resolve here to not block the loop, but log the error
             resolve(); 
        }, 10000); // 10s connection timeout

        conn.on('ready', async () => {
            clearTimeout(connectionTimeout);
            console.log(`Connected to ${machine.hostname}`);
            
            try {
                // 1. Memory (Preferred: /proc/meminfo)
                let mem = null;
                try {
                    const memInfo = await execCommand(conn, 'cat /proc/meminfo');
                    mem = parseMemInfo(memInfo);
                } catch (e) {
                     console.warn(`Failed to get memory info for ${machine.hostname}: ${e.message}`);
                     // Fallback to free -m?
                }
                
                // 2. Disk (Root partition for now)
                let disk = null;
                try {
                    const dfOut = await execCommand(conn, 'df -m /');
                    disk = parseDisk(dfOut);
                } catch (e) {
                    console.warn(`Failed to get disk usage for ${machine.hostname}: ${e.message}`);
                }
                
                // 3. CPU (Load Avg as proxy for now, or /proc/stat for robust calc)
                // Let's use loadavg 1min for simplicity and robustness over top parsing
                let cpuLoad = 0.0;
                try {
                     const loadOut = await execCommand(conn, 'cat /proc/loadavg');
                     cpuLoad = parseLoadAvg(loadOut);
                     // If we want percentage, we need core count, but load is a good metric too.
                     // The DB schema expects cpu_usage (percentage usually).
                     // Let's stick to a simple 0-100 placeholder if we can't do full calc, 
                     // or try to do the /proc/stat calculation properly.
                     // For this "fix", let's use the load average as "cpu_usage" for now (simplification)
                     // or keep the top command but wrap it better.
                     // Actually, the audit said "parseCpu relies on top -bn1 ... may fail".
                     // Let's try to grab 'top' again but safely.
                } catch (e) {
                    console.warn(`Failed to get loadavg for ${machine.hostname}: ${e.message}`);
                }
                
                 // Try legacy top as fallback for CPU % if loadavg isn't what we want
                 let cpuPercent = 0.0;
                 try {
                     const topOut = await execCommand(conn, 'top -bn1 | grep "Cpu(s)"', 3000);
                     // Reuse old parser logic but safely
                     const match = topOut.match(/([\d\.]+)\s*id/);
                     if (match) {
                        cpuPercent = 100.0 - parseFloat(match[1]);
                     }
                 } catch (e) {
                     // If top fails, maybe we just use load * 10 or something? 
                     // Or just leave it at 0.0 and log.
                     console.warn(`Failed to get CPU % from top for ${machine.hostname}: ${e.message}`);
                 }

                
                // Store metrics - allow partials
                // If we have at least ONE metric, we save.
                if (mem || disk || cpuPercent > 0) {
                    await dbRun(`INSERT INTO metrics (machine_id, cpu_usage, memory_used, memory_total, disk_used, disk_total) VALUES (?, ?, ?, ?, ?, ?)`, 
                        [
                            machine.id, 
                            cpuPercent || 0.0, 
                            mem ? mem.used : 0, 
                            mem ? mem.total : 0, 
                            disk ? disk.used : 0, 
                            disk ? disk.total : 0
                        ]);
                    console.log(`Metrics stored for ${machine.hostname}`);
                } else {
                    console.warn(`No metrics collected for ${machine.hostname}`);
                }
                
                // 4. Anomaly Detection
                try {
                    const anomalies = await detectAnomalies(machine.id);
                    if (anomalies.length > 0) {
                        console.log(`Found ${anomalies.length} anomaly(ies) for ${machine.hostname}`);
                    }
                } catch (e) {
                    console.warn(`Anomaly detection failed for ${machine.hostname}: ${e.message}`);
                }

                // 5. Docker Containers
                await processDockerContainers(execCommand, conn, machine.id);

                // Update Last Seen
                await dbRun(`UPDATE machines SET last_seen = CURRENT_TIMESTAMP, status = 'online' WHERE id = ?`, [machine.id]);

                conn.end();
                resolve();

            } catch (err) {
                console.error(`Error during collection phase for ${machine.hostname}:`, err);
                // Even if global failure, we resolved individual steps. 
                conn.end();
                resolve(); 
            }
        }).on('error', async (err) => {
            clearTimeout(connectionTimeout);
            console.error(`Connection error for ${machine.hostname}:`, err);
            await dbRun(`UPDATE machines SET status = 'offline' WHERE id = ?`, [machine.id]);
            await dbRun(`INSERT INTO logs (machine_id, level, message) VALUES (?, ?, ?)`, 
                    [machine.id, 'ERROR', `SSH Connection failed: ${err.message}`]);
            resolve();
        }).connect({
            host: machine.hostname,
            port: 22,
            username: machine.user,
            privateKey: privateKey,
            readyTimeout: 10000 // ssh2 level timeout
        });
    });
}

async function runCollector() {
    console.log("Starting metrics collection...");
    
    try {
        const rows = await dbAll(`SELECT * FROM machines`);
        
        if (rows.length === 0) {
            console.log("No machines configured.");
            return;
        }

        // Process machines sequentially
        for (const machine of rows) {
            await collectMetricsForMachine(machine);
        }
        
        console.log("Collection cycle complete.");
    } catch (err) {
        console.error("Error in runCollector:", err);
    }
}

// If run directly
if (require.main === module) {
    runCollector();
}

module.exports = { runCollector };
