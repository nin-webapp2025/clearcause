import test from "node:test"
import assert from "node:assert/strict"
import { scoreWithMl, scan } from "../src/scanner.js"

const featureRows = [{ n_donations: 1 }]

test("ML client accepts scores and model metadata", async () => {
  const result = await scoreWithMl("http://model", featureRows, async () => ({
    ok: true,
    json: async () => ({ scores: [{ score: 0.8, isAnomaly: true }], modelVersion: "model:abc", sklearnVersion: "1.9" }),
  }))
  assert.equal(result.modelVersion, "model:abc")
  assert.equal(result.scores[0].isAnomaly, true)
})

test("ML client falls back safely when the response is malformed", async () => {
  const result = await scoreWithMl("http://model", featureRows, async () => ({ ok: true, json: async () => ({ scores: [] }) }))
  assert.equal(result, null)
})

test("scan records detector metadata from the model response", async () => {
  const snapshot = {
    block: 42,
    campaigns: [{ id: 1, title: "Test", owner: "0x1", payout: "0x1", status: "Active", target: 10, createdAt: 1, approvedAt: 1, donations: [] }],
  }
  const result = await scan(snapshot, {
    mlUrl: "http://model",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ scores: [{ score: 0.2, isAnomaly: false }], modelVersion: "model:abc", sklearnVersion: "1.9" }),
    }),
  })
  assert.equal(result.detector.modelVersion, "model:abc")
  assert.equal(result.detector.rulesVersion, "1")
  assert.equal(result.mlAvailable, true)
})
