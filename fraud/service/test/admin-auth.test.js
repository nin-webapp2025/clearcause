import test from "node:test"
import assert from "node:assert/strict"
import { createAdminGuard } from "../src/admin-auth.js"

const ADMIN = "0x0000000000000000000000000000000000000001"
const USER = "0x0000000000000000000000000000000000000002"

function response() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.payload = payload; return this },
  }
}

test("admin guard rejects missing and non-admin sessions", async () => {
  const sessions = new Map([["user-token", { address: USER, role: "user" }]])
  const guard = createAdminGuard({ store: { getSession: (token) => sessions.get(token) }, getAdminAddress: async () => ADMIN })

  const missing = response()
  await guard({ headers: {} }, missing, () => assert.fail("missing session reached handler"))
  assert.equal(missing.statusCode, 401)

  const forbidden = response()
  await guard({ headers: { cookie: "clearcause_session=user-token" } }, forbidden, () => assert.fail("user reached handler"))
  assert.equal(forbidden.statusCode, 403)
})

test("admin guard permits the authenticated on-chain administrator", async () => {
  const guard = createAdminGuard({
    store: { getSession: async () => ({ address: ADMIN.toUpperCase().replace("0X", "0x"), role: "admin" }) },
    getAdminAddress: async () => ADMIN,
  })
  let called = false
  await guard({ headers: { cookie: "clearcause_session=admin-token" } }, response(), () => { called = true })
  assert.equal(called, true)
})
