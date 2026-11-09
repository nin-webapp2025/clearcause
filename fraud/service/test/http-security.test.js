import test from "node:test"
import assert from "node:assert/strict"
import { allowedOrigins, createCorsOptions, sessionCookie } from "../src/http-security.js"
import { buildSignInMessage } from "../src/identity.js"

test("production CORS accepts configured origins and rejects other websites", async () => {
  const options = createCorsOptions(allowedOrigins("https://app.example.com, https://admin.example.com/"), { production: true })
  await new Promise((resolve, reject) => options.origin("https://app.example.com", (error, accepted) => error ? reject(error) : (assert.equal(accepted, true), resolve())))
  await new Promise((resolve) => options.origin("https://evil.example", (error) => { assert.equal(error?.statusCode, 403); resolve() }))
})

test("production session cookie is HTTP-only, same-site and secure", () => {
  const value = sessionCookie("token", 60, { production: true })
  assert.match(value, /HttpOnly/)
  assert.match(value, /SameSite=Lax/)
  assert.match(value, /Secure/)
  assert.match(value, /Max-Age=60/)
})

test("wallet sign-in message is bound to the configured application domain", () => {
  const message = buildSignInMessage("0xabc", "1234", "app.example.com")
  assert.match(message, /^app\.example\.com wants you to sign in/)
  assert.match(message, /Wallet: 0xabc/)
  assert.match(message, /Nonce: 1234/)
})
