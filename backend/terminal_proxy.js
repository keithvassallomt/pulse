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

const SSH_KEY_PATH = process.env.SSH_KEY_PATH || path.join(process.env.HOME, '.ssh', 'id_rsa');

// Helper to promisify db.get
const dbGet = (sql, params) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

/**
 * Attach a WebSocket server to an existing HTTP server.
 * Clients connect to ws://host:port/ws/terminal?machineId=<id>
 *
 * Protocol:
 *   - Client sends JSON: { type: 'resize', cols, rows } for terminal resize
 *   - Client sends JSON: { type: 'input', data: '...' } for keystrokes
 *   - Server sends JSON: { type: 'output', data: '...' } for shell output
 *   - Server sends JSON: { type: 'error', message: '...' } on errors
 *   - Server sends JSON: { type: 'connected' } when shell is ready
 */
function attachTerminalProxy(server) {
    const wss = new WebSocketServer({
        server,
        path: '/ws/terminal',
    });

    console.log('Terminal proxy WebSocket server attached on /ws/terminal');

    wss.on('connection', async (ws, req) => {
        const params = new url.URL(req.url, 'http://localhost').searchParams;
        const machineId = params.get('machineId');

        if (!machineId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Missing machineId parameter' }));
            ws.close();
            return;
        }

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

        // Read SSH private key
        let privateKey;
        try {
            privateKey = fs.readFileSync(SSH_KEY_PATH);
        } catch (err) {
            ws.send(JSON.stringify({ type: 'error', message: 'SSH key not found at ' + SSH_KEY_PATH }));
            ws.close();
            return;
        }

        const sshClient = new SSHClient();
        let stream = null;

        sshClient.on('ready', () => {
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
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'error', message: 'SSH error: ' + err.message }));
            }
            ws.close();
        });

        ws.on('message', (raw) => {
            let msg;
            try {
                msg = JSON.parse(raw);
            } catch {
                return; // ignore non-JSON
            }

            if (msg.type === 'input' && stream) {
                stream.write(msg.data);
            } else if (msg.type === 'resize' && stream) {
                stream.setWindow(msg.rows || 24, msg.cols || 80, 0, 0);
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

    return wss;
}

module.exports = { attachTerminalProxy };
