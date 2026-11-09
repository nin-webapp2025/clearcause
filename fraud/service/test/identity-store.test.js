import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createIdentityStore } from "../src/identity-store.js"

test("identity records and sessions survive a store restart", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "clearcause-identity-"))
  const filename = path.join(directory, "identity.json")
  const address = "0x0000000000000000000000000000000000000001"
  const first = createIdentityStore(filename)
  const nonce = first.issueNonce(address)
  assert.equal(first.consumeNonce(address, nonce), true)
  const { token } = first.createSession(address, "user")
  first.saveKyc({ address, name: "Demo User", email: "demo@example.com", nationality: "NG", idNumber: "SAMPLE", documentPath: "private/sample.png", proofHash: "0xproof" })

  const restarted = createIdentityStore(filename)
  assert.equal(restarted.getSession(token).address, address)
  assert.equal(restarted.getKyc(address).status, "pending")
  assert.equal(restarted.pendingKyc().length, 1)
  restarted.reviewKyc(address, "approved", address)
  assert.equal(restarted.getKyc(address).status, "approved")
  fs.rmSync(directory, { recursive: true, force: true })
})
