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
    status TEXT DEFAULT 'unknown'
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
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(machine_id) REFERENCES machines(id)
  )`);

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
    FOREIGN KEY(machine_id) REFERENCES machines(id),
    UNIQUE(machine_id, container_id)
  )`);

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
});

module.exports = db;
