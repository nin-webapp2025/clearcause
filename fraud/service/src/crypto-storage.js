import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

const configured = process.env.DATA_ENCRYPTION_KEY
if (!configured && process.env.NODE_ENV === "production") throw new Error("DATA_ENCRYPTION_KEY is required in production.")
const key = createHash("sha256").update(configured || "clearcause-local-demo-key-not-for-production").digest()

export function encryptBuffer(value) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(value), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted])
}

export function decryptBuffer(value) {
  const decipher = createDecipheriv("aes-256-gcm", key, value.subarray(0, 12))
  decipher.setAuthTag(value.subarray(12, 28))
  return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()])
}

export const sealJson = (value) => encryptBuffer(Buffer.from(JSON.stringify(value))).toString("base64")
export const openJson = (value) => JSON.parse(decryptBuffer(Buffer.from(value, "base64")).toString("utf8"))
