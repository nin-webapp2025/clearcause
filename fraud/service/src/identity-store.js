import { createHash, randomBytes } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { openJson, sealJson } from "./crypto-storage.js"

const now = () => new Date().toISOString()
const hash = (value) => createHash("sha256").update(value).digest("hex")

// Durable local adapter. Production deployments use db/postgres.sql and should
// replace this adapter with their managed PostgreSQL connection.
export function createIdentityStore(filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true })
  let data = { users: {}, nonces: {}, sessions: {}, kyc: {} }
  if (fs.existsSync(filename)) {
    try { data = { ...data, ...JSON.parse(fs.readFileSync(filename, "utf8")) } } catch { /* start with an empty local store */ }
  }
  const save = () => {
    const temporary = `${filename}.tmp`
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2))
    fs.renameSync(temporary, filename)
  }

  return {
    issueNonce(address) {
      const nonce = randomBytes(16).toString("hex")
      data.nonces[address] = { nonce, expiresAt: Date.now() + 5 * 60_000 }
      save(); return nonce
    },
    consumeNonce(address, nonce) {
      const row = data.nonces[address]; delete data.nonces[address]; save()
      return Boolean(row && row.nonce === nonce && row.expiresAt > Date.now())
    },
    createSession(address, role = "user") {
      const token = randomBytes(32).toString("base64url")
      const expires = Date.now() + 7 * 24 * 60 * 60_000
      data.users[address] = { ...(data.users[address] || {}), address, role, createdAt: data.users[address]?.createdAt || now(), lastLoginAt: now() }
      data.sessions[hash(token)] = { address, expiresAt: expires }; save()
      return { token, expires }
    },
    getSession(token) {
      if (!token) return null
      const row = data.sessions[hash(token)]
      if (!row || row.expiresAt <= Date.now()) return null
      return { address: row.address, role: data.users[row.address]?.role || "user" }
    },
    revokeSession(token) { if (token) { delete data.sessions[hash(token)]; save() } },
    saveKyc(application) {
      const { address, proofHash, ...privateFields } = application
      data.kyc[address] = { address, proofHash, sealed: sealJson(privateFields), status: "pending", submittedAt: now(), reviewedAt: null, reviewedBy: null }
      save()
    },
    getKyc(address) { const row=data.kyc[address]; return row ? { ...row, ...openJson(row.sealed), sealed: undefined } : null },
    pendingKyc() { return Object.values(data.kyc).filter((row) => row.status === "pending").map((row) => ({ ...row, ...openJson(row.sealed), sealed: undefined })).sort((a,b) => a.submittedAt.localeCompare(b.submittedAt)) },
    reviewKyc(address, status, reviewer) { if (data.kyc[address]) { Object.assign(data.kyc[address], { status, reviewedAt: now(), reviewedBy: reviewer }); save() } },
  }
}

export async function createConfiguredIdentityStore(filename) {
  if (process.env.DATABASE_URL) {
    const { createPostgresStore } = await import("./postgres-store.js")
    return createPostgresStore(process.env.DATABASE_URL)
  }
  return createIdentityStore(filename)
}
