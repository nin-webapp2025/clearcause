import { createHash, randomBytes } from "node:crypto"
import pg from "pg"
import { sealJson, openJson } from "./crypto-storage.js"

const hash = (value) => createHash("sha256").update(value).digest("hex")
export async function createPostgresStore(connectionString) {
  const pool = new pg.Pool({ connectionString, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false })
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users(address CHAR(42) PRIMARY KEY,role VARCHAR(24) NOT NULL DEFAULT 'user',created_at TIMESTAMPTZ NOT NULL DEFAULT now(),last_login_at TIMESTAMPTZ);
    CREATE TABLE IF NOT EXISTS auth_nonces(address CHAR(42) PRIMARY KEY,nonce TEXT NOT NULL,expires_at BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash CHAR(64) PRIMARY KEY,address CHAR(42) NOT NULL REFERENCES users(address),expires_at BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS kyc_applications(address CHAR(42) PRIMARY KEY REFERENCES users(address),proof_hash CHAR(66) NOT NULL,sealed_data TEXT NOT NULL,status VARCHAR(16) NOT NULL DEFAULT 'pending',submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),reviewed_at TIMESTAMPTZ,reviewed_by CHAR(42));
    CREATE INDEX IF NOT EXISTS kyc_status_idx ON kyc_applications(status);
  `)
  return {
    async issueNonce(address) { const nonce=randomBytes(16).toString("hex"); await pool.query("INSERT INTO auth_nonces(address,nonce,expires_at) VALUES($1,$2,$3) ON CONFLICT(address) DO UPDATE SET nonce=$2,expires_at=$3",[address,nonce,Date.now()+300000]); return nonce },
    async consumeNonce(address, nonce) { const {rows}=await pool.query("DELETE FROM auth_nonces WHERE address=$1 AND nonce=$2 AND expires_at>$3 RETURNING address",[address,nonce,Date.now()]); return rows.length===1 },
    async createSession(address, role="user") { const token=randomBytes(32).toString("base64url"),expires=Date.now()+604800000; await pool.query("INSERT INTO users(address,role,last_login_at) VALUES($1,$2,now()) ON CONFLICT(address) DO UPDATE SET role=$2,last_login_at=now()",[address,role]); await pool.query("INSERT INTO sessions(token_hash,address,expires_at) VALUES($1,$2,$3)",[hash(token),address,expires]); return {token,expires} },
    async getSession(token) { if(!token)return null; const {rows}=await pool.query("SELECT s.address,u.role FROM sessions s JOIN users u ON u.address=s.address WHERE s.token_hash=$1 AND s.expires_at>$2",[hash(token),Date.now()]); return rows[0]||null },
    async revokeSession(token) { if(token) await pool.query("DELETE FROM sessions WHERE token_hash=$1",[hash(token)]) },
    async saveKyc(application) { const {address,proofHash,...privateFields}=application; await pool.query("INSERT INTO kyc_applications(address,proof_hash,sealed_data,status,submitted_at) VALUES($1,$2,$3,'pending',now()) ON CONFLICT(address) DO UPDATE SET proof_hash=$2,sealed_data=$3,status='pending',submitted_at=now(),reviewed_at=NULL,reviewed_by=NULL",[address,proofHash,sealJson(privateFields)]) },
    async getKyc(address) { const {rows}=await pool.query("SELECT * FROM kyc_applications WHERE address=$1",[address]); const row=rows[0]; return row?{...row,proofHash:row.proof_hash,submittedAt:row.submitted_at,...openJson(row.sealed_data)}:null },
    async pendingKyc() { const {rows}=await pool.query("SELECT * FROM kyc_applications WHERE status='pending' ORDER BY submitted_at"); return rows.map((row)=>({...row,proofHash:row.proof_hash,submittedAt:row.submitted_at,...openJson(row.sealed_data)})) },
    async reviewKyc(address,status,reviewer) { await pool.query("UPDATE kyc_applications SET status=$1,reviewed_at=now(),reviewed_by=$2 WHERE address=$3",[status,reviewer,address]) },
  }
}
