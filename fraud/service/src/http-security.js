export function allowedOrigins(value = "") {
  return new Set(value.split(",").map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean))
}

export function createCorsOptions(origins, { production = false } = {}) {
  return {
    credentials: true,
    origin(origin, callback) {
      // Requests without Origin are server-to-server calls, health checks, or same-origin tools.
      if (!origin || origins.has(origin.replace(/\/$/, "")) || (!production && origins.size === 0)) {
        return callback(null, true)
      }
      const error = new Error("Origin is not allowed.")
      error.statusCode = 403
      return callback(error)
    },
  }
}

export function createRateLimit({ windowMs = 60_000, max = 60 } = {}) {
  const buckets = new Map()
  return (req, res, next) => {
    const now = Date.now()
    const key = req.ip || req.socket?.remoteAddress || "unknown"
    const current = buckets.get(key)
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current
    bucket.count += 1
    buckets.set(key, bucket)

    res.setHeader("RateLimit-Limit", String(max))
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - bucket.count)))
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)))
    if (bucket.count > max) return res.status(429).json({ error: "Too many requests. Please try again shortly." })
    return next()
  }
}

export function securityHeaders({ production = false } = {}) {
  return (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("X-Frame-Options", "DENY")
    res.setHeader("Referrer-Policy", "no-referrer")
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
    if (production) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    next()
  }
}

export function sessionCookie(token, maxAgeSeconds, { production = process.env.NODE_ENV === "production" } = {}) {
  const parts = [`clearcause_session=${token}`, "HttpOnly", "SameSite=Lax", "Path=/", `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`]
  if (production) parts.push("Secure")
  return parts.join("; ")
}
