const fs = require('fs');
const ssh2 = require('ssh2');
const path = require('path');
const db = require('./db');
const { processDockerContainers } = require('./docker_monitor');
const { collectDockerInLxc } = require('./proxmox_monitor');
const { detectAnomalies } = require('./anomaly_detector');
const { getKeyForHost } = require('./ssh_utils');

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
    
    const lines = dfOutput.split('\n');
    if (lines.length < 2) return null;
    
    const parts = lines[1].split(/\s+/);
    if (parts.length < 5) return null;
    
    return {
        total: parseInt(parts[1], 10),
        used: parseInt(parts[2], 10)
    };
}

// --- Collection Logic ---

async function collectMetrics(execCommand, conn, machineId, hostname) {
    try {
        const [memOutput, diskOutput, loadOutput, topOutput, zfsOutput] = await Promise.all([
            execCommand(conn, 'cat /proc/meminfo'),
            execCommand(conn, 'df -m /'),
            execCommand(conn, 'cat /proc/loadavg'),
            execCommand(conn, 'top -bn1 | head -n 5'),
            execCommand(conn, 'zpool list -H -o name,size,alloc,health').catch(() => null)
        ]);

        const mem = parseMemInfo(memOutput);
        const disk = parseDisk(diskOutput);
        
        const loadParts = loadOutput.split(/\s+/);
        const load_1 = parseFloat(loadParts[0]);
        const load_5 = parseFloat(loadParts[1]);
        const load_15 = parseFloat(loadParts[2]);

        let cpu_usage = 0;
        const cpuMatch = topOutput.match(/%Cpu\(s\):\s+([\d.]+)\s+us/);
        if (cpuMatch) {
            cpu_usage = parseFloat(cpuMatch[1]);
        } else {
            const idleMatch = topOutput.match(/([\d.]+)\s+id/);
            if (idleMatch) {
                cpu_usage = 100 - parseFloat(idleMatch[1]);
            }
        }

        let zfs = null;
        if (zfsOutput) {
            const zParts = zfsOutput.split(/\s+/);
            if (zParts.length >= 4) {
                zfs = {
                    total: parseInt(zParts[1]),
                    used: parseInt(zParts[2]),
                    health: zParts[3]
                };
            }
        }

        await dbRun(
            `INSERT INTO metrics (machine_id, cpu_usage, memory_used, memory_total, disk_used, disk_total, load_1, load_5, load_15, zfs_used, zfs_total, zfs_health) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [machineId, cpu_usage, mem?.used, mem?.total, disk?.used, disk?.total, load_1, load_5, load_15, zfs?.used, zfs?.total, zfs?.health]
        );

        await dbRun(`UPDATE machines SET last_seen = CURRENT_TIMESTAMP, status = 'online' WHERE id = ?`, [machineId]);
        
        detectAnomalies(machineId, { cpu_usage, memory_used: mem?.used, memory_total: mem?.total });

    } catch (err) {
        console.error(`Failed to get metrics for ${hostname}: ${err.message}`);
        await dbRun(`UPDATE machines SET status = 'error' WHERE id = ?`, [machineId]);
    }
}

async function runCollector() {
    const machines = await dbAll('SELECT * FROM machines');
    
    for (const machine of machines) {
        const conn = new ssh2.Client();
        
        conn.on('ready', async () => {
            console.log(`Connected to ${machine.hostname}`);
            
            await collectMetrics(execCommand, conn, machine.id, machine.hostname);
            await processDockerContainers(execCommand, conn, machine.id);
            await collectDockerInLxc(execCommand, conn, machine.id);
            
            conn.end();
        }).on('error', (err) => {
            console.error(`Connection error for ${machine.hostname}: ${err.message}`);
            dbRun(`UPDATE machines SET status = 'offline' WHERE id = ?`, [machine.id]);
        }).connect({
            host: machine.hostname,
            port: 22,
            username: machine.user,
            privateKey: getKeyForHost(machine.hostname)
        });
    }
}

module.exports = { runCollector };
