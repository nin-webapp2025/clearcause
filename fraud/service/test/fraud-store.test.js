import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createLocalFraudStore } from "../src/fraud-store.js"

const report = (scannedAt, block) => ({
  scannedAt,
  block,
  total: 2,
  flagged: 1,
  mlAvailable: true,
  detector: { rulesVersion: "1", modelVersion: "test-model" },
  results: [{ campaignId: 1, score: 80, features: { n_donations: 3 } }],
})

test("fraud scans and detector metadata survive a store restart", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "clearcause-fraud-"))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const filename = path.join(directory, "scans.json")

  const first = createLocalFraudStore(filename)
  await first.saveScan(report("2026-01-01T00:00:00.000Z", 10))

  const restarted = createLocalFraudStore(filename)
  assert.equal((await restarted.getLatest()).results[0].features.n_donations, 3)
  assert.equal((await restarted.getHistory())[0].detector.modelVersion, "test-model")
})

test("local fraud history is bounded while retaining the latest full report", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "clearcause-fraud-"))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const store = createLocalFraudStore(path.join(directory, "scans.json"), { historyLimit: 2 })

  await store.saveScan(report("2026-01-01T00:00:00.000Z", 1))
  await store.saveScan(report("2026-01-02T00:00:00.000Z", 2))
  await store.saveScan(report("2026-01-03T00:00:00.000Z", 3))

  assert.equal((await store.getHistory(100)).length, 2)
  assert.equal((await store.getLatest()).block, 3)
})
