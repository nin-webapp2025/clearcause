const API_URL = (import.meta.env.VITE_FRAUD_API_URL || "http://127.0.0.1:4000").replace(/\/$/, "")

export async function identityFetch(path, options = {}) {
  const response = await fetch(`${API_URL}/api${path}`, { credentials: "include", ...options })
  const payload = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error || "Identity service request failed.")
  return payload
}

export async function ensureIdentitySession(address, signer) {
  const current = await identityFetch("/auth/session")
  if (current.authenticated) return current
  const challenge = await identityFetch("/auth/nonce", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address }) })
  const signature = await signer.signMessage(challenge.message)
  return identityFetch("/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address, message: challenge.message, signature }) })
}
