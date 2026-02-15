const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../pulse.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Machines Table
  db.run(`CREATE TABLE IF NOT EXISTS machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    hostname TEXT NOT NULL UNIQUE,
    user TEXT NOT NULL,
    last_seen DATETIME,
    status TEXT DEFAULT 'unknown',
    capabilities TEXT DEFAULT '{}'
  )`);

  // Metrics Table (History)
  db.run(`CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER,
    cpu_usage REAL,
    memory_used INTEGER,
    memory_total INTEGER,
    disk_used INTEGER,
    disk_total INTEGER,
    load_1 REAL,
    load_5 REAL,
    load_15 REAL,
    zfs_used INTEGER,
    zfs_total INTEGER,
    zfs_health TEXT,
    zfs_pools TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(machine_id) REFERENCES machines(id)
  )`);

  // Add columns if they don't exist (migration for existing DBs)
  const newCols = [
    ['metrics', 'load_1', 'REAL'],
    ['metrics', 'load_5', 'REAL'],
    ['metrics', 'load_15', 'REAL'],
    ['metrics', 'zfs_used', 'INTEGER'],
    ['metrics', 'zfs_total', 'INTEGER'],
    ['metrics', 'zfs_health', 'TEXT'],
    ['metrics', 'zfs_pools', 'TEXT'],
    ['machines', 'capabilities', "TEXT DEFAULT '{}'"]
  ];
  for (const [table, col, type] of newCols) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`, () => {});
  }

  // Containers Table
  db.run(`CREATE TABLE IF NOT EXISTS containers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER,
    container_id TEXT NOT NULL,
    name TEXT,
    image TEXT,
    state TEXT,
    status TEXT,
    health_status TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    source_type TEXT DEFAULT 'direct',
    source_vmid INTEGER,
    proxmox_host_id INTEGER,
    FOREIGN KEY(machine_id) REFERENCES machines(id),
    UNIQUE(machine_id, container_id)
  )`);

  // Migration: add last_error to proxmox_hosts for diagnostics
  db.run(`ALTER TABLE proxmox_hosts ADD COLUMN last_error TEXT`, () => {});

  // Migration: add source columns for Docker-in-LXC tracking
  const containerCols = [
    ['containers', 'source_type', "TEXT DEFAULT 'direct'"],  // 'direct' or 'lxc'
    ['containers', 'source_vmid', 'INTEGER'],                // LXC VMID if source_type='lxc'
    ['containers', 'proxmox_host_id', 'INTEGER'],            // proxmox_hosts.id if via LXC
  ];
  for (const [table, col, type] of containerCols) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`, () => {});
  }

  // Container Policies Table
  db.run(`CREATE TABLE IF NOT EXISTS container_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    container_table_id INTEGER,
    max_retries INTEGER DEFAULT 3,
    grace_period INTEGER DEFAULT 60,
    current_retries INTEGER DEFAULT 0,
    last_restart DATETIME,
    FOREIGN KEY(container_table_id) REFERENCES containers(id)
  )`);

  // Logs Table
  db.run(`CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER,
    level TEXT,
    message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(machine_id) REFERENCES machines(id)
  )`);

  // Webhooks Table
  db.run(`CREATE TABLE IF NOT EXISTS webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'generic',
    url TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    events TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Alert Profiles Table
  db.run(`CREATE TABLE IF NOT EXISTS alert_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    target_type TEXT NOT NULL, -- 'machine', 'global'
    target_id TEXT, -- machine_id (int) or NULL for global
    metric TEXT NOT NULL, -- 'cpu', 'memory', 'disk', 'load_1', etc.
    condition TEXT NOT NULL, -- '>', '<', '>=', '<='
    threshold REAL NOT NULL,
    duration INTEGER DEFAULT 0, -- minutes condition must persist
    severity TEXT DEFAULT 'warning', -- 'info', 'warning', 'critical'
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Alert History Table
  db.run(`CREATE TABLE IF NOT EXISTS alert_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    severity TEXT,
    title TEXT,
    message TEXT,
    machine TEXT,
    sent_to TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // --- Optimization: Indexes for Pruning ---
  db.run(`CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_alert_history_timestamp ON alert_history(timestamp)`);
});

module.exports = db;
