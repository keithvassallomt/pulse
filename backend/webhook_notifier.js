/**
 * Webhook Notifier — sends alert notifications to Discord and Telegram webhooks.
 * 
 * Monitors: offline machines, high CPU/memory/disk load, unhealthy containers.
 * Sends formatted POST requests to configured webhook URLs.
 */

const db = require('./db');

// Thresholds (overridable via env)
const CPU_THRESHOLD = parseFloat(process.env.ALERT_CPU_THRESHOLD) || 90;
const MEMORY_THRESHOLD = parseFloat(process.env.ALERT_MEMORY_THRESHOLD) || 90;
const DISK_THRESHOLD = parseFloat(process.env.ALERT_DISK_THRESHOLD) || 85;
const ALERT_COOLDOWN_MS = parseInt(process.env.ALERT_COOLDOWN_MS) || 300000; // 5 min

// In-memory cooldown tracker: key -> last alert timestamp
const cooldowns = new Map();

function shouldAlert(key) {
  const now = Date.now();
  const last = cooldowns.get(key);
  if (last && (now - last) < ALERT_COOLDOWN_MS) return false;
  cooldowns.set(key, now);
  return true;
}

// ─── DB helpers (promisified) ───────────────────────────────────

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}

// ─── Webhook sending ────────────────────────────────────────────

async function sendDiscordWebhook(url, alert) {
  const color = alert.severity === 'critical' ? 0xff0000 : alert.severity === 'high' ? 0xff8800 : 0xffcc00;
  const payload = {
    embeds: [{
      title: `🚨 Pulse Alert: ${alert.title}`,
      description: alert.message,
      color,
      fields: [
        { name: 'Severity', value: alert.severity, inline: true },
        { name: 'Machine', value: alert.machine || 'N/A', inline: true },
        { name: 'Type', value: alert.type, inline: true },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Pulse Infrastructure Monitor' },
    }],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Discord webhook failed: ${res.status}`);
}

async function sendTelegramWebhook(url, alert) {
  // Telegram Bot API: url should be https://api.telegram.org/bot<TOKEN>/sendMessage
  // We extract the base and send with chat_id from the stored URL
  // Expected format: https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>
  const emoji = alert.severity === 'critical' ? '🔴' : alert.severity === 'high' ? '🟠' : '🟡';
  const text = `${emoji} *Pulse Alert: ${alert.title}*\n\n${alert.message}\n\n*Severity:* ${alert.severity}\n*Machine:* ${alert.machine || 'N/A'}\n*Type:* ${alert.type}`;

  const urlObj = new URL(url);
  const chatId = urlObj.searchParams.get('chat_id');
  const baseUrl = `${urlObj.origin}${urlObj.pathname}`;

  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  };

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Telegram webhook failed: ${res.status}`);
}

async function sendGenericWebhook(url, alert) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'pulse',
      timestamp: new Date().toISOString(),
      ...alert,
    }),
  });
  if (!res.ok) throw new Error(`Webhook failed: ${res.status}`);
}

async function sendAlert(alert) {
  const webhooks = await dbAll('SELECT * FROM webhooks WHERE enabled = 1');
  const results = [];

  for (const wh of webhooks) {
    // Check if this webhook cares about this alert type
    try {
      const events = JSON.parse(wh.events || '[]');
      if (events.length > 0 && !events.includes(alert.type)) continue;
    } catch { /* send to all if events parsing fails */ }

    try {
      if (wh.type === 'discord') {
        await sendDiscordWebhook(wh.url, alert);
      } else if (wh.type === 'telegram') {
        await sendTelegramWebhook(wh.url, alert);
      } else {
        await sendGenericWebhook(wh.url, alert);
      }
      results.push({ webhook: wh.name, status: 'sent' });
    } catch (err) {
      console.error(`Webhook "${wh.name}" failed:`, err.message);
      results.push({ webhook: wh.name, status: 'failed', error: err.message });
    }
  }

  // Log to alert_history
  try {
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO alert_history (type, severity, title, message, machine, sent_to) VALUES (?, ?, ?, ?, ?, ?)',
        [alert.type, alert.severity, alert.title, alert.message, alert.machine || null, JSON.stringify(results)],
        (err) => err ? reject(err) : resolve()
      );
    });
  } catch (err) {
    console.error('Failed to log alert:', err.message);
  }

  return results;
}

// ─── Alert checks ───────────────────────────────────────────────

async function checkOfflineMachines() {
  const machines = await dbAll("SELECT * FROM machines WHERE status = 'offline' OR status = 'error'");
  const alerts = [];
  for (const m of machines) {
    const key = `offline:${m.id}`;
    if (!shouldAlert(key)) continue;
    alerts.push({
      type: 'machine_offline',
      severity: 'critical',
      title: `Machine Offline: ${m.name || m.hostname}`,
      message: `Machine ${m.name || m.hostname} (${m.hostname}) is ${m.status}. Last seen: ${m.last_seen || 'never'}.`,
      machine: m.name || m.hostname,
    });
  }
  return alerts;
}

async function checkHighLoad() {
  // Get latest metrics per machine
  const rows = await dbAll(`
    SELECT m.id, m.name, m.hostname, mt.cpu_usage, mt.memory_used, mt.memory_total, mt.disk_used, mt.disk_total
    FROM machines m
    JOIN (
      SELECT machine_id, cpu_usage, memory_used, memory_total, disk_used, disk_total
      FROM metrics WHERE id IN (SELECT MAX(id) FROM metrics GROUP BY machine_id)
    ) mt ON m.id = mt.machine_id
    WHERE m.status = 'online'
  `);

  const alerts = [];
  for (const r of rows) {
    const machineName = r.name || r.hostname;

    if (r.cpu_usage != null && r.cpu_usage > CPU_THRESHOLD) {
      const key = `cpu:${r.id}`;
      if (shouldAlert(key)) {
        alerts.push({
          type: 'high_cpu',
          severity: r.cpu_usage > 95 ? 'critical' : 'high',
          title: `High CPU: ${machineName}`,
          message: `CPU usage on ${machineName} is ${Math.round(r.cpu_usage)}% (threshold: ${CPU_THRESHOLD}%).`,
          machine: machineName,
        });
      }
    }

    if (r.memory_total > 0) {
      const memPct = (r.memory_used / r.memory_total) * 100;
      if (memPct > MEMORY_THRESHOLD) {
        const key = `mem:${r.id}`;
        if (shouldAlert(key)) {
          alerts.push({
            type: 'high_memory',
            severity: memPct > 95 ? 'critical' : 'high',
            title: `High Memory: ${machineName}`,
            message: `Memory usage on ${machineName} is ${Math.round(memPct)}% (${r.memory_used}/${r.memory_total} MB).`,
            machine: machineName,
          });
        }
      }
    }

    if (r.disk_total > 0) {
      const diskPct = (r.disk_used / r.disk_total) * 100;
      if (diskPct > DISK_THRESHOLD) {
        const key = `disk:${r.id}`;
        if (shouldAlert(key)) {
          alerts.push({
            type: 'high_disk',
            severity: diskPct > 95 ? 'critical' : 'high',
            title: `High Disk Usage: ${machineName}`,
            message: `Disk usage on ${machineName} is ${Math.round(diskPct)}% (${r.disk_used}/${r.disk_total} MB).`,
            machine: machineName,
          });
        }
      }
    }
  }
  return alerts;
}

async function checkUnhealthyContainers() {
  const containers = await dbAll(`
    SELECT c.*, m.name as machine_name, m.hostname
    FROM containers c
    JOIN machines m ON c.machine_id = m.id
    WHERE c.health_status = 'unhealthy' OR (c.state != 'running' AND c.state != 'created' AND c.state != 'paused')
  `);

  const alerts = [];
  for (const c of containers) {
    const key = `container:${c.id}`;
    if (!shouldAlert(key)) continue;
    const machineName = c.machine_name || c.hostname;
    alerts.push({
      type: 'unhealthy_container',
      severity: c.health_status === 'unhealthy' ? 'high' : 'warning',
      title: `Container Issue: ${c.name}`,
      message: `Container ${c.name} on ${machineName} is ${c.health_status || c.state}. Image: ${c.image}.`,
      machine: machineName,
    });
  }
  return alerts;
}

// ─── Main check loop ────────────────────────────────────────────

async function runAlertChecks() {
  try {
    const webhooks = await dbAll('SELECT * FROM webhooks WHERE enabled = 1');
    if (webhooks.length === 0) return []; // No webhooks configured, skip checks

    const allAlerts = [
      ...await checkOfflineMachines(),
      ...await checkHighLoad(),
      ...await checkUnhealthyContainers(),
    ];

    for (const alert of allAlerts) {
      await sendAlert(alert);
    }

    if (allAlerts.length > 0) {
      console.log(`[AlertCheck] Sent ${allAlerts.length} alert(s) to ${webhooks.length} webhook(s)`);
    }

    return allAlerts;
  } catch (err) {
    console.error('[AlertCheck] Error:', err.message);
    return [];
  }
}

// ─── Test webhook ───────────────────────────────────────────────

async function testWebhook(webhookId) {
  const wh = await dbGet('SELECT * FROM webhooks WHERE id = ?', [webhookId]);
  if (!wh) throw new Error('Webhook not found');

  const testAlert = {
    type: 'test',
    severity: 'info',
    title: 'Test Alert',
    message: 'This is a test alert from Pulse. If you see this, your webhook is configured correctly!',
    machine: 'test-machine',
  };

  if (wh.type === 'discord') {
    await sendDiscordWebhook(wh.url, testAlert);
  } else if (wh.type === 'telegram') {
    await sendTelegramWebhook(wh.url, testAlert);
  } else {
    await sendGenericWebhook(wh.url, testAlert);
  }

  return { status: 'sent', webhook: wh.name };
}

module.exports = { runAlertChecks, sendAlert, testWebhook };
