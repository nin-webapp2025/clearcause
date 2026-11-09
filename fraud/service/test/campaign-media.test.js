import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import express from "express"
import { createCampaignMediaRouter } from "../src/campaign-media.js"

test("authenticated campaign images are stored and publicly readable", async (t) => {
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "clearcause-campaign-images-"))
  t.after(() => fs.rmSync(uploadDir, { recursive: true, force: true }))

  const app = express()
  const store = { getSession: async (token) => token === "valid" ? { address: "0x1" } : null }
  app.use("/api", createCampaignMediaRouter({ store, uploadDir }))
  app.use("/campaign-images", express.static(uploadDir))
  const server = app.listen(0)
  t.after(() => server.close())
  await new Promise((resolve) => server.once("listening", resolve))
  const base = `http://127.0.0.1:${server.address().port}`

  const unauthorized = await fetch(`${base}/api/campaign/image`, {
    method: "POST",
    headers: { "content-type": "image/png" },
    body: Buffer.from("png-data"),
  })
  assert.equal(unauthorized.status, 401)

  const uploaded = await fetch(`${base}/api/campaign/image`, {
    method: "POST",
    headers: { "content-type": "image/png", cookie: "clearcause_session=valid" },
    body: Buffer.from("png-data"),
  })
  assert.equal(uploaded.status, 201)
  const { imageUrl } = await uploaded.json()
  assert.match(imageUrl, /\/campaign-images\/.+\.png$/)

  const image = await fetch(imageUrl)
  assert.equal(image.status, 200)
  assert.equal(Buffer.from(await image.arrayBuffer()).toString(), "png-data")
})
