import { useCallback, useEffect, useState } from "react"
import { AlertCircle, Check, Loader2, ShieldCheck, X } from "lucide-react"
import useIsKYCOwner from "../../hooks/KYC/useIsKYCOwner"
import useVerifyKYC from "../../hooks/KYC/useVerifyKYC"
import useSignerOrProvider from "../../hooks/useSignerOrProvider"
import { useAppKitAccount } from "@reown/appkit/react"
import { ensureIdentitySession, identityFetch } from "../../lib/identityApi"
import { Alert, AlertDescription } from "../ui/alert"
import { Button } from "../ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"

export function KYCVerificationList() {
  const [pendingKYCs, setPendingKYCs] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [processingAddress, setProcessingAddress] = useState(null)
  const { isKYCOwner, checking } = useIsKYCOwner()
  const { verifyKYC, error: verifyError } = useVerifyKYC()
  const { address } = useAppKitAccount()
  const { signer } = useSignerOrProvider()

  const loadPendingKYCs = useCallback(async () => {
    if (!isKYCOwner) return
    setLoading(true)
    setLoadError(null)
    try {
      await ensureIdentitySession(address, signer)
      const result = await identityFetch("/kyc/pending")
      setPendingKYCs(result.applications)
    } catch (error) {
      setLoadError(error.shortMessage || error.reason || error.message || "Could not load pending submissions.")
    } finally {
      setLoading(false)
    }
  }, [address, isKYCOwner, signer])

  useEffect(() => { loadPendingKYCs() }, [loadPendingKYCs])

  const handleVerify = async (address, status) => {
    setProcessingAddress(address)
    try {
      await verifyKYC(address, status)
      await identityFetch(`/kyc/${address}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: status ? "approved" : "rejected" }) })
      await loadPendingKYCs()
    } catch {
      // The hook exposes and displays the transaction error; keep the row in place.
    } finally {
      setProcessingAddress(null)
    }
  }

  if (checking) return <div className="flex items-center gap-2 text-sm text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" />Checking administrator access...</div>
  if (!isKYCOwner) return null

  return (
    <section className="border-t border-neutral-200 pt-8">
      <div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center bg-emerald-50 text-emerald-700"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="text-xl font-semibold">Pending verification requests</h2><p className="text-sm text-neutral-500">Visible only to the KYC contract owner.</p></div></div>
      {(loadError || verifyError) && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{loadError || verifyError}</AlertDescription></Alert>}
      {loading ? <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-emerald-700" /></div> : pendingKYCs.length === 0 ? <p className="border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">No KYC submissions are waiting for review.</p> : (
        <div className="overflow-x-auto border border-neutral-200 bg-white"><Table><TableHeader><TableRow><TableHead>Wallet</TableHead><TableHead>Name</TableHead><TableHead>Nationality</TableHead><TableHead className="text-right">Decision</TableHead></TableRow></TableHeader><TableBody>{pendingKYCs.map((kyc) => <TableRow key={kyc.address}><TableCell className="max-w-48 truncate font-mono text-xs" title={kyc.address}>{kyc.address}</TableCell><TableCell>{kyc.name}</TableCell><TableCell>{kyc.nationality}</TableCell><TableCell><div className="flex justify-end gap-2"><Button size="sm" onClick={() => handleVerify(kyc.address, true)} disabled={Boolean(processingAddress)} className="bg-emerald-700 hover:bg-emerald-800">{processingAddress === kyc.address ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Approve</Button><Button size="sm" onClick={() => handleVerify(kyc.address, false)} disabled={Boolean(processingAddress)} variant="destructive"><X className="mr-2 h-4 w-4" />Reject</Button></div></TableCell></TableRow>)}</TableBody></Table></div>
      )}
    </section>
  )
}
