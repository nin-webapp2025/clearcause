import { useCallback, useEffect, useState } from "react"
import { ensureIdentitySession } from "../../lib/identityApi"

// Optional link to the fraud-detection service (fraud/service). If VITE_FRAUD_API_URL is not set, or the
// service is down, the admin screen works exactly as before: the service only adds advice, and the
// admin always makes the final on-chain decision.
const BASE = (import.meta.env.VITE_FRAUD_API_URL || "").replace(/\/$/, "")

const useFraudRisk = ({ address, signer } = {}) => {
  const [risks, setRisks] = useState({}) // campaignId -> result
  const [state, setState] = useState(BASE ? "loading" : "off") // off | loading | ok | down
  const [meta, setMeta] = useState(null)
  const [rescanning, setRescanning] = useState(false)
  const [rescanError, setRescanError] = useState("")

  const refresh = useCallback(async () => {
    if (!BASE) return
    try {
      const res = await fetch(`${BASE}/api/risk`, { credentials: "include" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setRisks(Object.fromEntries(data.results.map((r) => [String(r.campaignId), r])))
      setMeta({ scannedAt: data.scannedAt, mlAvailable: data.mlAvailable, flagged: data.flagged })
      setState("ok")
    } catch {
      setState("down")
    }
  }, [])

  const rescan = useCallback(async () => {
    if (!BASE) return
    setRescanning(true)
    setRescanError("")
    try {
      if (!address || !signer) throw new Error("Connect the administrator wallet before rescanning.")
      await ensureIdentitySession(address, signer)
      const response = await fetch(`${BASE}/api/rescan`, { method: "POST", credentials: "include" })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "The fraud scan could not be started.")
      await refresh()
    } catch (error) {
      setRescanError(error.message || "The fraud scan could not be started.")
    } finally {
      setRescanning(false)
    }
  }, [address, refresh, signer])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { risks, state, meta, refresh, rescan, rescanning, rescanError }
}

export default useFraudRisk
