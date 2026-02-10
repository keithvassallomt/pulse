const db = require('./db');

// Helper to run DB queries
const dbRun = (sql, params) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const dbGet = (sql, params) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const dbAll = (sql, params) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

// Parse docker ps output
// Format: {{.ID}}|{{.Names}}|{{.Image}}|{{.State}}|{{.Status}}
function parseDockerPs(output) {
    if (!output) return [];
    return output.trim().split('\n').map(line => {
        const parts = line.split('|');
        if (parts.length < 5) return null;
        return {
            id: parts[0],
            name: parts[1],
            image: parts[2],
            state: parts[3], // running, exited, etc.
            status: parts[4] // Up 2 hours, Exited (0) 5 seconds ago
        };
    }).filter(c => c !== null);
}

// Check health for a specific container
async function getContainerHealth(execCommand, conn, containerId) {
    try {
        // Inspect State.Health.Status
        // Returns "healthy", "unhealthy", "starting", or "" (if no healthcheck)
        const cmd = `docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' ${containerId}`;
        const health = await execCommand(conn, cmd);
        return health === 'none' ? null : health;
    } catch (err) {
        console.warn(`Failed to inspect container ${containerId}: ${err.message}`);
        return 'unknown';
    }
}

async function processDockerContainers(execCommand, conn, machineId) {
    try {
        console.log(`Checking Docker containers for machine ${machineId}...`);
        
        // 1. List all containers
        const psCmd = `docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.State}}|{{.Status}}'`;
        const psOutput = await execCommand(conn, psCmd);
        const containers = parseDockerPs(psOutput);

        for (const container of containers) {
            // 2. Get detailed health if running
            let healthStatus = 'unknown';
            if (container.state === 'running') {
                healthStatus = await getContainerHealth(execCommand, conn, container.id);
            } else {
                healthStatus = 'not_running';
            }

            // 3. Upsert into DB
            // Check if container exists
            let dbContainer = await dbGet(
                `SELECT id FROM containers WHERE machine_id = ? AND container_id = ?`, 
                [machineId, container.id]
            );

            let containerTableId;

            if (dbContainer) {
                await dbRun(
                    `UPDATE containers SET name = ?, image = ?, state = ?, status = ?, health_status = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?`,
                    [container.name, container.image, container.state, container.status, healthStatus, dbContainer.id]
                );
                containerTableId = dbContainer.id;
            } else {
                const res = await dbRun(
                    `INSERT INTO containers (machine_id, container_id, name, image, state, status, health_status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [machineId, container.id, container.name, container.image, container.state, container.status, healthStatus]
                );
                containerTableId = res.lastID;
            }

            // 4. Auto-Healing Logic
            await checkAndHeal(execCommand, conn, machineId, containerTableId, container, healthStatus);
        }

    } catch (err) {
        console.error(`Docker monitoring failed for machine ${machineId}:`, err);
        // Log to DB logs
        await dbRun(`INSERT INTO logs (machine_id, level, message) VALUES (?, ?, ?)`, 
            [machineId, 'ERROR', `Docker monitor failed: ${err.message}`]);
    }
}

async function checkAndHeal(execCommand, conn, machineId, containerTableId, container, healthStatus) {
    // 1. Get Policy
    const policy = await dbGet(`SELECT * FROM container_policies WHERE container_table_id = ?`, [containerTableId]);
    
    if (!policy) {
        // No policy, no action
        return;
    }

    // 2. Evaluate Health
    const isUnhealthy = healthStatus === 'unhealthy';
    // const isExited = container.state === 'exited'; // Optional: auto-restart exited containers?
    
    // For now, let's focus on "unhealthy" status which implies a healthcheck failed
    if (isUnhealthy) {
        console.log(`Container ${container.name} (${container.id}) is UNHEALTHY. Checking policy...`);

        // Check grace period (time since last restart)
        if (policy.last_restart) {
            const lastRestart = new Date(policy.last_restart).getTime();
            const now = Date.now();
            const diffSeconds = (now - lastRestart) / 1000;
            
            if (diffSeconds < policy.grace_period) {
                console.log(`Skipping restart for ${container.name}: In grace period (${diffSeconds | 0}s < ${policy.grace_period}s)`);
                return;
            }
        }

        // Check max retries
        if (policy.current_retries >= policy.max_retries) {
            console.log(`Skipping restart for ${container.name}: Max retries reached (${policy.current_retries}/${policy.max_retries})`);
            await dbRun(`INSERT INTO logs (machine_id, level, message) VALUES (?, ?, ?)`, 
                [machineId, 'WARN', `Auto-heal skipped for ${container.name}: Max retries reached`]);
            return;
        }

        // 3. Restart Action
        try {
            console.log(`Restarting container ${container.name}...`);
            await execCommand(conn, `docker restart ${container.id}`);
            
            // 4. Update Policy State
            await dbRun(
                `UPDATE container_policies SET current_retries = current_retries + 1, last_restart = CURRENT_TIMESTAMP WHERE id = ?`,
                [policy.id]
            );

            // 5. Log Action
            await dbRun(`INSERT INTO logs (machine_id, level, message) VALUES (?, ?, ?)`, 
                [machineId, 'INFO', `Auto-healed container ${container.name} (Restarted)`]);
            
            console.log(`Successfully restarted ${container.name}`);

        } catch (err) {
            console.error(`Failed to restart ${container.name}:`, err);
            await dbRun(`INSERT INTO logs (machine_id, level, message) VALUES (?, ?, ?)`, 
                [machineId, 'ERROR', `Failed to auto-heal ${container.name}: ${err.message}`]);
        }
    } else if (healthStatus === 'healthy' || container.state === 'running') {
        // Reset retries if healthy for a while? 
        // Simple logic: if healthy, reset retries to 0
        if (policy.current_retries > 0) {
             await dbRun(`UPDATE container_policies SET current_retries = 0 WHERE id = ?`, [policy.id]);
        }
    }
}

module.exports = { processDockerContainers };
