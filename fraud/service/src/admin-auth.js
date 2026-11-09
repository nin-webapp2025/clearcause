const sessionCookie = (req) =>
  req.headers.cookie
    ?.split(";")
    .map((value) => value.trim().split("="))
    .find(([key]) => key === "clearcause_session")?.[1]

export function createAdminGuard({ store, getAdminAddress }) {
  return async (req, res, next) => {
    try {
      const current = await store.getSession(sessionCookie(req))
      if (!current) return res.status(401).json({ error: "Wallet authentication required." })
      const adminAddress = String(await getAdminAddress()).toLowerCase()
      if (current.address.toLowerCase() !== adminAddress) {
        return res.status(403).json({ error: "Administrator access required." })
      }
      req.user = current
      return next()
    } catch {
      return res.status(503).json({ error: "Could not verify administrator access." })
    }
  }
}
