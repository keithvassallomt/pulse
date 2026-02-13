/**
 * Terminal Backend Proxy
 * WebSocket-based SSH proxy using ws and ssh2.
 * Enables interactive terminal sessions from the dashboard.
 */

const { WebSocketServer } = require('ws');
const { Client: SSHClient } = require('ssh2');
const fs = require('fs');
const path = require('path');
const url = require('url');
const db = require('./db');

const { getKeyForHost } = require('./ssh_utils');

// Helper to promisify db.get
const dbGet = (sql, params) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

// Allowed sudo commands (whitelist for safety) - duplicated from index.js for now
const ALLOWED_ACTIONS = {
    reboot:          { command: 'sudo /sbin/reboot', timeoutMs: 30000 },
    'check-updates': { command: 'sudo apt list --upgradable 2>/dev/null || sudo yum check-update 2>/dev/null || echo "Unknown package manager"', timeoutMs: 600000 },
    update:          { command: 'sudo apt-get update 2>/dev/null || sudo yum makecache -y 2>/dev/null || sudo yum check-update 2>/dev/null || echo "Unknown package manager"', timeoutMs: 1800000 },
    upgrade:         { command: 'sudo apt-get upgrade -y 2>/dev/null || sudo yum update -y 2>/dev/null || echo "Unknown package manager"', timeoutMs: 3600000 },
    'upgrade-all':   { command: 'sudo apt-get update && sudo apt-get upgrade -y', timeoutMs: 3600000 },
    'restart-docker':{ command: 'sudo systemctl restart docker', timeoutMs: 60000 },
    'restart-ssh':   { command: 'sudo systemctl restart sshd', timeoutMs: 60000 },
    'service-status':{ command: 'sudo systemctl list-units --type=service --state=running --no-pager --no-legend', timeoutMs: 120000 },
};

/**
 * Attach a WebSocket server to an existing HTTP server.
 * Clients connect to ws://host:port/ws/terminal?machineId=<id>
 *
 * Protocol:
 *   - Client sends JSON: { type: 'resize', cols, rows } for terminal resize
 *   - Client sends JSON: { type: 'input', data: '...' } or RAW STRING for keystrokes
 *   - Server sends JSON: { type: 'output', data: '...' } for shell output
 *   - Server sends JSON: { type: 'error', message: '...' } on errors
 *   - Server sends JSON: { type: 'connected' } when shell is ready
 */
function attachTerminalProxy(server) {
    const wss = new WebSocketServer({
        server,
        path: '/ws/terminal',
    });
    
    // Attach Action Proxy on a different path
    const wssAction = new WebSocketServer({
        server,
        path: '/ws/action',
    });

    console.log('Terminal proxy WebSocket server attached on /ws/terminal');
    console.log('Action proxy WebSocket server attached on /ws/action');

    // --- Terminal Proxy Logic ---
    wss.on('connection', async (ws, req) => {
        const params = new url.URL(req.url, 'http://localhost').searchParams;
        const machineId = params.get('machineId');
        console.log(`[Terminal] New connection request for machineId: ${machineId}`);

        if (!machineId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Missing machineId parameter' }));
            ws.close();
            return;
        }

        let machine;
        try {
            machine = await dbGet('SELECT * FROM machines WHERE id = ?', [machineId]);
        } catch (err) {
            console.error(`[Terminal] DB Error: ${err.message}`);
            ws.send(JSON.stringify({ type: 'error', message: 'Database error: ' + err.message }));
            ws.close();
            return;
        }

        if (!machine) {
            console.error(`[Terminal] Machine ${machineId} not found`);
            ws.send(JSON.stringify({ type: 'error', message: 'Machine not found' }));
            ws.close();
            return;
        }

        console.log(`[Terminal] Connecting to ${machine.hostname} as ${machine.user}...`);

        // Get the best SSH key for this host
        const privateKey = getKeyForHost(machine.hostname);
        if (!privateKey) {
            console.error(`[Terminal] No SSH key found for host ${machine.hostname}`);
            ws.send(JSON.stringify({ type: 'error', message: 'No SSH key found for host ' + machine.hostname }));
            ws.close();
            return;
        }

        const sshClient = new SSHClient();
        let stream = null;

        sshClient.on('ready', () => {
            console.log(`[Terminal] SSH ready for ${machine.hostname}`);
            sshClient.shell({ term: 'xterm-256color', cols: 80, rows: 24 }, (err, s) => {
                if (err) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Failed to open shell: ' + err.message }));
                    sshClient.end();
                    ws.close();
                    return;
                }

                stream = s;
                ws.send(JSON.stringify({ type: 'connected' }));

                stream.on('data', (data) => {
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({ type: 'output', data: data.toString('base64') }));
                    }
                });

                stream.stderr.on('data', (data) => {
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({ type: 'output', data: data.toString('base64') }));
                    }
                });

                stream.on('close', () => {
                    ws.send(JSON.stringify({ type: 'error', message: 'SSH session closed' }));
                    sshClient.end();
                    ws.close();
                });
            });
        });

        sshClient.on('error', (err) => {
            console.error(`[Terminal] SSH Client Error (${machine?.hostname}): ${err.message}`);
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'error', message: 'SSH error: ' + err.message }));
            }
            ws.close();
        });

        ws.on('message', (raw) => {
            if (!stream) return;
            
            let msg;
            try {
                msg = JSON.parse(raw);
            } catch {
                // Not JSON, assume raw input
                stream.write(raw);
                return;
            }

            if (msg.type === 'input' && msg.data) {
                stream.write(msg.data);
            } else if (msg.type === 'resize') {
                stream.setWindow(msg.rows || 24, msg.cols || 80, 0, 0);
            } else {
                // Fallback for weirdly formatted messages
                stream.write(raw);
            }
        });

        ws.on('close', () => {
            if (stream) stream.close();
            sshClient.end();
        });

        // Initiate SSH connection
        sshClient.connect({
            host: machine.hostname,
            port: parseInt(process.env.SSH_PORT, 10) || 22,
            username: machine.user,
            privateKey,
            readyTimeout: 10000,
        });
    });

    // --- Action Stream Logic ---
    wssAction.on('connection', async (ws, req) => {
        const params = new url.URL(req.url, 'http://localhost').searchParams;
        const machineId = params.get('machineId');
        const action = params.get('action');

        console.log(`[Action] New request for machineId: ${machineId}, action: ${action}`);

        if (!machineId || !action) {
            ws.send(JSON.stringify({ type: 'error', message: 'Missing machineId or action parameter' }));
            ws.close();
            return;
        }

        const actionDef = ALLOWED_ACTIONS[action];
        if (!actionDef) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid action: ' + action }));
            ws.close();
            return;
        }

        const command = actionDef.command;
        const timeoutMs = actionDef.timeoutMs || 900000;
        let machine;

        try {
            machine = await dbGet('SELECT * FROM machines WHERE id = ?', [machineId]);
        } catch (err) {
            ws.send(JSON.stringify({ type: 'error', message: 'Database error: ' + err.message }));
            ws.close();
            return;
        }

        if (!machine) {
            ws.send(JSON.stringify({ type: 'error', message: 'Machine not found' }));
            ws.close();
            return;
        }

        const privateKey = getKeyForHost(machine.hostname);
        if (!privateKey) {
            ws.send(JSON.stringify({ type: 'error', message: 'No SSH key found for host ' + machine.hostname }));
            ws.close();
            return;
        }

        const sshClient = new SSHClient();
        let activeStream = null;
        let timeoutHandle = null;

        sshClient.on('ready', () => {
            console.log(`[Action] Executing '${command}' on ${machine.hostname}`);
            ws.send(JSON.stringify({ type: 'status', message: `Executing '${action}'...` }));

            sshClient.exec(command, { pty: true }, (err, stream) => {
                if (err) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Exec error: ' + err.message }));
                    sshClient.end();
                    return;
                }

                activeStream = stream;
                timeoutHandle = setTimeout(() => {
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({ type: 'error', message: `Action '${action}' timed out after ${Math.round(timeoutMs / 60000)}m` }));
                    }
                    try { stream.close(); } catch (e) { /* ignore */ }
                    sshClient.end();
                    ws.close();
                }, timeoutMs);

                stream.on('data', (data) => {
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({ type: 'output', data: data.toString() }));
                    }
                });

                stream.stderr.on('data', (data) => {
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({ type: 'output', data: data.toString() })); // Merge stderr into output for simplicity
                    }
                });

                stream.on('close', (code, signal) => {
                    if (timeoutHandle) {
                        clearTimeout(timeoutHandle);
                        timeoutHandle = null;
                    }
                    activeStream = null;
                    console.log(`[Action] Command finished with code ${code}`);
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({ type: 'finished', code, signal }));
                    }
                    sshClient.end();
                    ws.close();
                });
            });
        });

        sshClient.on('error', (err) => {
            console.error(`[Action] SSH Client Error: ${err.message}`);
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
                timeoutHandle = null;
            }
            if (activeStream) {
                try { activeStream.close(); } catch (e) { /* ignore */ }
                activeStream = null;
            }
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'error', message: 'SSH connection error: ' + err.message }));
            }
            ws.close();
        });

        sshClient.connect({
            host: machine.hostname,
            port: parseInt(process.env.SSH_PORT, 10) || 22,
            username: machine.user,
            privateKey,
            readyTimeout: 10000,
        });

        ws.on('close', () => {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
                timeoutHandle = null;
            }
            if (activeStream) {
                try { activeStream.close(); } catch (e) { /* ignore */ }
                activeStream = null;
            }
            try { sshClient.end(); } catch (e) { /* ignore */ }
        });
    });

    return { wss, wssAction };
}

module.exports = { attachTerminalProxy };
