import fs from "node:fs"
import path from "node:path"
import { Router, raw } from "express"
import { ethers } from "ethers"
import { encryptBuffer } from "./crypto-storage.js"
import { sessionCookie } from "./http-security.js"

const cookie = (req, name) => req.headers.cookie?.split(";").map((v) => v.trim().split("=")).find(([key]) => key === name)?.[1]
const cleanAddress = (value) => ethers.getAddress(value).toLowerCase()
export const buildSignInMessage = (address, nonce, domain) =>
  `${domain} wants you to sign in to ClearCause\nWallet: ${address}\nNonce: ${nonce}`

export function createIdentityRouter({ store, provider, kycAddress, uploadDir, authDomain = "ClearCause local demo" }) {
  const router = Router()
  const ownerContract = new ethers.Contract(kycAddress, ["function owner() view returns (address)"], provider)
  const session = async (req, res, next) => {
    const current = await store.getSession(cookie(req, "clearcause_session"))
    if (!current) return res.status(401).json({ error: "Wallet authentication required." })
    req.user = current
    next()
  }
  const reviewer = async (req, res, next) => {
    try {
      if (cleanAddress(await ownerContract.owner()) !== req.user.address) return res.status(403).json({ error: "KYC reviewer access required." })
      next()
    } catch { res.status(503).json({ error: "Could not verify the KYC reviewer on-chain." }) }
  }

  router.post("/auth/nonce", async (req, res) => {
    try {
      const address = cleanAddress(req.body.address)
      const nonce = await store.issueNonce(address)
      res.json({ message: buildSignInMessage(address, nonce, authDomain), nonce })
    } catch { res.status(400).json({ error: "A valid wallet address is required." }) }
  })
  router.post("/auth/verify", async (req, res) => {
    try {
      const address = cleanAddress(req.body.address)
      const recovered = cleanAddress(ethers.verifyMessage(req.body.message, req.body.signature))
      const nonce = /Nonce: ([a-f0-9]+)/.exec(req.body.message)?.[1]
      const expectedMessage = nonce ? buildSignInMessage(address, nonce, authDomain) : ""
      if (recovered !== address || req.body.message !== expectedMessage || !(await store.consumeNonce(address, nonce))) return res.status(401).json({ error: "The wallet signature is invalid or expired." })
      const role = cleanAddress(await ownerContract.owner()) === address ? "admin" : "user"
      const { token, expires } = await store.createSession(address, role)
      res.setHeader("Set-Cookie", sessionCookie(token, (expires - Date.now()) / 1000))
      res.json({ address, role })
    } catch { res.status(401).json({ error: "Wallet authentication failed." }) }
  })
  router.get("/auth/session", async (req, res) => {
    const current = await store.getSession(cookie(req, "clearcause_session"))
    res.json(current ? { ...current, authenticated: true } : { authenticated: false })
  })
  router.post("/auth/logout", session, async (req, res) => { await store.revokeSession(cookie(req, "clearcause_session")); res.setHeader("Set-Cookie", sessionCookie("", 0)); res.status(204).end() })

  router.post("/kyc/document", session, raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "2mb" }), (req, res) => {
    const types = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" }
    const extension = types[req.headers["content-type"]]
    if (!extension || !Buffer.isBuffer(req.body) || !req.body.length) return res.status(415).json({ error: "Upload a JPEG, PNG, or WebP image." })
    fs.mkdirSync(uploadDir, { recursive: true })
    const filename = `${req.user.address.replace("0x", "")}-${Date.now()}${extension}.enc`
    fs.writeFileSync(path.join(uploadDir, filename), encryptBuffer(req.body), { flag: "wx", mode: 0o600 })
    res.status(201).json({ documentId: filename })
  })
  router.post("/kyc", session, async (req, res) => {
    const { name, email, nationality, idNumber, documentId } = req.body
    if (![name,email,nationality,idNumber,documentId].every((v) => typeof v === "string" && v.trim())) return res.status(400).json({ error: "All KYC fields are required." })
    const documentPath = path.resolve(uploadDir, path.basename(documentId))
    if (!documentPath.startsWith(path.resolve(uploadDir)) || !fs.existsSync(documentPath)) return res.status(400).json({ error: "Upload the identity image first." })
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes(`${req.user.address}:${name}:${email}:${nationality}:${idNumber}:${documentId}`))
    await store.saveKyc({ address: req.user.address, name, email, nationality, idNumber, documentPath, proofHash })
    res.status(201).json({ proofHash, status: "pending" })
  })
  router.get("/kyc/me", session, async (req, res) => { const row=await store.getKyc(req.user.address); res.json(row ? { status: row.status, proofHash: row.proofHash, submittedAt: row.submittedAt } : { status: "not_submitted" }) })
  router.get("/kyc/pending", session, reviewer, async (_req, res) => res.json({ applications: await store.pendingKyc() }))
  router.patch("/kyc/:address", session, reviewer, async (req, res) => { const status=req.body.status; if(!["approved","rejected"].includes(status)) return res.status(400).json({error:"Invalid status."}); await store.reviewKyc(cleanAddress(req.params.address),status,req.user.address); res.json({status}) })
  return router
}
