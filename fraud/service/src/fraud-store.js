import fs from "node:fs"
import path from "node:path"
import pg from "pg"

const DEFAULT_HISTORY_LIMIT = 50

function scanSummary(scan) {
  return {
    scannedAt: scan.scannedAt,
    block: scan.block,
    total: scan.total,
    flagged: scan.flagged,
    mlAvailable: scan.mlAvailable,
    detector: scan.detector,
  }
}

export function createLocalFraudStore(filename, { historyLimit = DEFAULT_HISTORY_LIMIT } = {}) {
  fs.mkdirSync(path.dirname(filename), { recursive: true })
  let data = { latest: null, history: [] }
  if (fs.existsSync(filename)) {
    try {
      data = { ...data, ...JSON.parse(fs.readFileSync(filename, "utf8")) }
    } catch {
      // A damaged cache must not prevent fresh on-chain scans.
    }
  }

  const save = () => {
    const temporary = `${filename}.tmp`
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2))
    fs.renameSync(temporary, filename)
  }

  return {
    async getLatest() {
      return data.latest
    },
    async saveScan(scan) {
      data.latest = scan
      data.history = [scanSummary(scan), ...data.history].slice(0, historyLimit)
      save()
    },
    async getHistory(limit = 20) {
      return data.history.slice(0, Math.max(1, Math.min(Number(limit) || 20, historyLimit)))
    },
  }
}

export async function createPostgresFraudStore(connectionString, { historyLimit = 1000 } = {}) {
  const pool = new pg.Pool({
    connectionString,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
  })
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fraud_scans (
      id BIGSERIAL PRIMARY KEY,
      scanned_at TIMESTAMPTZ NOT NULL,
      block_number BIGINT,
      total INTEGER NOT NULL,
      flagged INTEGER NOT NULL,
      ml_available BOOLEAN NOT NULL,
      detector JSONB NOT NULL DEFAULT '{}'::jsonb,
      report JSONB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS fraud_scans_scanned_at_idx ON fraud_scans(scanned_at DESC);
  `)

  return {
    async getLatest() {
      const { rows } = await pool.query("SELECT report FROM fraud_scans ORDER BY id DESC LIMIT 1")
      return rows[0]?.report ?? null
    },
    async saveScan(scan) {
      await pool.query(
        "INSERT INTO fraud_scans(scanned_at,block_number,total,flagged,ml_available,detector,report) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [scan.scannedAt, scan.block, scan.total, scan.flagged, scan.mlAvailable, scan.detector || {}, scan],
      )
      await pool.query(
        "DELETE FROM fraud_scans WHERE id NOT IN (SELECT id FROM fraud_scans ORDER BY id DESC LIMIT $1)",
        [historyLimit],
      )
    },
    async getHistory(limit = 20) {
      const bounded = Math.max(1, Math.min(Number(limit) || 20, 100))
      const { rows } = await pool.query(
        "SELECT scanned_at AS \"scannedAt\",block_number AS block,total,flagged,ml_available AS \"mlAvailable\",detector FROM fraud_scans ORDER BY id DESC LIMIT $1",
        [bounded],
      )
      return rows
    },
  }
}

export function createConfiguredFraudStore(filename) {
  return process.env.DATABASE_URL
    ? createPostgresFraudStore(process.env.DATABASE_URL, { historyLimit: Number(process.env.FRAUD_HISTORY_LIMIT) || 1000 })
    : createLocalFraudStore(filename)
}
