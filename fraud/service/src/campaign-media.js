import fs from "node:fs"
import path from "node:path"
import { randomBytes } from "node:crypto"
import { Router, raw } from "express"

const extensions = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
}

const sessionCookie = (req) =>
  req.headers.cookie
    ?.split(";")
    .map((value) => value.trim().split("="))
    .find(([key]) => key === "clearcause_session")?.[1]

export function createCampaignMediaRouter({ store, uploadDir, publicBaseUrl = "" }) {
  const router = Router()

  router.post(
    "/campaign/image",
    raw({ type: Object.keys(extensions), limit: "5mb" }),
    async (req, res) => {
      const current = await store.getSession(sessionCookie(req))
      if (!current) return res.status(401).json({ error: "Wallet authentication required." })

      const extension = extensions[req.headers["content-type"]]
      if (!extension || !Buffer.isBuffer(req.body) || !req.body.length) {
        return res.status(415).json({ error: "Upload a JPEG, PNG, or WebP image." })
      }

      fs.mkdirSync(uploadDir, { recursive: true })
      const filename = `${Date.now()}-${randomBytes(8).toString("hex")}${extension}`
      fs.writeFileSync(path.join(uploadDir, filename), req.body, { flag: "wx", mode: 0o644 })
      const base = publicBaseUrl.replace(/\/$/, "") || `${req.protocol}://${req.get("host")}`
      const imageUrl = `${base}/campaign-images/${filename}`
      return res.status(201).json({ imageUrl })
    },
  )

  return router
}
