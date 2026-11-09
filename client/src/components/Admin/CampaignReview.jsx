"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useAppKitAccount } from "@reown/appkit/react"
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw, ShieldAlert, ShieldCheck, XCircle } from "lucide-react"
import { Alert, AlertDescription } from "../ui/alert"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import useGetCampaign from "../../hooks/Campaign Data Retrieval/useGetCampaign"
import useIsAdmin from "../../hooks/Admin/useIsAdmin"
import useCampaignReview from "../../hooks/Admin/useCampaignReview"
import useFraudRisk from "../../hooks/Admin/useFraudRisk"
import useSignerOrProvider from "../../hooks/useSignerOrProvider"
import { addressUrl } from "../../constant/chain"

const statusStyle = {
  Pending: "bg-amber-500/10 text-amber-600",
  Active: "bg-green-500/10 text-green-600",
  Successful: "bg-blue-500/10 text-blue-600",
  Failed: "bg-red-500/10 text-red-600",
  Paid: "bg-purple-500/10 text-purple-600",
  Rejected: "bg-red-500/10 text-red-600",
  Suspended: "bg-orange-500/10 text-orange-600",
}

const riskStyle = {
  high: "border-red-300 bg-red-500/10 text-red-800",
  medium: "border-amber-300 bg-amber-500/10 text-amber-800",
  low: "border-green-300 bg-green-500/10 text-green-800",
}

const RiskPanel = ({ risk }) => {
  if (!risk) return null
  return (
    <div className={`space-y-2 rounded-md border p-3 text-sm ${riskStyle[risk.level]}`}>
      <div className="flex items-center justify-between gap-2 font-medium">
        <span>
          Fraud risk: {risk.level.toUpperCase()} ({risk.score}/100)
        </span>
        {risk.flagged && <Badge variant="destructive">Flagged</Badge>}
      </div>
      {risk.reasons.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5">
          {risk.reasons.map((r) => (
            <li key={r.rule}>
              <span className="font-medium">{r.title}.</span> {r.message}
            </li>
          ))}
        </ul>
      ) : (
        <p>No warning signs found.</p>
      )}
      <p className="text-xs opacity-80">
        Automated advice only. It can be wrong, so check the campaign before deciding.
      </p>
    </div>
  )
}

const FILTERS = [
  { key: "pending", label: "Awaiting review", match: (c) => c.statusText === "Pending" },
  { key: "live", label: "Live", match: (c) => c.statusText === "Active" || c.statusText === "Successful" },
  {
    key: "closed",
    label: "Closed",
    match: (c) => ["Rejected", "Suspended", "Failed", "Paid"].includes(c.statusText),
  },
  { key: "all", label: "All", match: () => true },
]

const short = (a) => (a ? `${a.slice(0, 8)}…${a.slice(-6)}` : "")

const AddressLink = ({ address }) => {
  const href = addressUrl(address)
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
      {short(address)} <ExternalLink className="h-3 w-3" />
    </a>
  ) : (
    <span title={address}>{short(address)}</span>
  )
}

const ReviewCard = ({ campaign, risk, busy, onApprove, onReject, onSuspend }) => {
  const [reason, setReason] = useState("")
  // offer the service's findings as the (editable) on-chain reason
  const suggestedReason = risk?.flagged
    ? `Flagged by fraud service: ${risk.reasons.map((r) => r.rule).join(", ")}`.slice(0, 200)
    : ""
  const payoutDiffers =
    campaign.payoutAddress && campaign.owner && campaign.payoutAddress.toLowerCase() !== campaign.owner.toLowerCase()
  const canReview = campaign.statusText === "Pending"
  const canSuspend = campaign.statusText === "Active" || campaign.statusText === "Successful"
  const reasonOk = reason.trim().length >= 5

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">
              <Link to={`/dashboard/campaigns/${campaign.id}`} className="hover:underline">
                #{campaign.id} · {campaign.title}
              </Link>
            </CardTitle>
            <CardDescription className="mt-1 line-clamp-2">{campaign.description}</CardDescription>
          </div>
          <Badge variant="outline" className={statusStyle[campaign.statusText]}>
            {campaign.statusText}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Target: </span>
            {campaign.target} ETH
          </div>
          <div>
            <span className="text-muted-foreground">Raised: </span>
            {campaign.amountCollected} ETH
          </div>
          <div>
            <span className="text-muted-foreground">Deadline: </span>
            {new Date(campaign.deadline * 1000).toLocaleDateString()}
          </div>
          <div>
            <span className="text-muted-foreground">Backers: </span>
            {campaign.analytics.totalBackers}
          </div>
          <div>
            <span className="text-muted-foreground">Creator: </span>
            <AddressLink address={campaign.owner} />
          </div>
          <div>
            <span className="text-muted-foreground">Payout address: </span>
            <AddressLink address={campaign.payoutAddress} />
          </div>
        </div>

        <RiskPanel risk={risk} />

        {payoutDiffers && (
          <Alert className="border-amber-300 bg-amber-500/10 text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Funds will be paid to a different address than the creator&apos;s wallet. Check that this is intended
              before approving. The payout address cannot be changed after approval.
            </AlertDescription>
          </Alert>
        )}

        {(canReview || canSuspend) && (
          <div className="space-y-3 border-t pt-4">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={canReview ? "Reason (required to reject)" : "Reason for suspension (stored on-chain)"}
              disabled={busy}
            />
            <div className="flex flex-wrap gap-2">
              {canReview && (
                <>
                  <Button onClick={() => onApprove(campaign.id)} disabled={busy}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                  </Button>
                  <Button variant="destructive" onClick={() => onReject(campaign.id, reason.trim())} disabled={busy || !reasonOk}>
                    <XCircle className="mr-2 h-4 w-4" /> Reject
                  </Button>
                </>
              )}
              {canSuspend && (
                <Button variant="destructive" onClick={() => onSuspend(campaign.id, reason.trim())} disabled={busy || !reasonOk}>
                  <ShieldAlert className="mr-2 h-4 w-4" /> Suspend and open refunds
                </Button>
              )}
            </div>
            {suggestedReason && !reason && (
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setReason(suggestedReason)}>
                Use the fraud service findings as the reason
              </Button>
            )}
            {!reasonOk && (canReview || canSuspend) && (
              <p className="text-xs text-muted-foreground">
                Rejecting or suspending needs a reason of at least 5 characters. It is recorded publicly on-chain.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const CampaignReview = () => {
  const { address, isConnected } = useAppKitAccount()
  const { signer } = useSignerOrProvider()
  const { isAdmin, checking } = useIsAdmin()
  const { getAllCampaigns, isContractReady } = useGetCampaign()
  const { approveCampaign, rejectCampaign, suspendCampaign, loading: busy } = useCampaignReview()
  const { risks, state: riskState, meta: riskMeta, rescan, rescanning, rescanError } = useFraudRisk({ address, signer })
  const [campaigns, setCampaigns] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [filter, setFilter] = useState("flagged")

  const refresh = useCallback(async () => {
    if (!isContractReady) return
    setLoadingList(true)
    const data = await getAllCampaigns()
    if (data) setCampaigns(data)
    setLoadingList(false)
  }, [getAllCampaigns, isContractReady])

  useEffect(() => {
    refresh()
  }, [refresh])

  const filters = useMemo(
    () =>
      riskState === "ok"
        ? [
            {
              key: "flagged",
              label: "Flagged by fraud service",
              match: (c) =>
                risks[String(c.id)]?.flagged && ["Pending", "Active", "Successful"].includes(c.statusText),
            },
            ...FILTERS,
          ]
        : FILTERS,
    [riskState, risks],
  )
  const counts = useMemo(
    () => Object.fromEntries(filters.map((f) => [f.key, campaigns.filter(f.match).length])),
    [campaigns, filters],
  )
  const visible = useMemo(() => {
    const active = filters.find((f) => f.key === filter) || FILTERS[0]
    return campaigns
      .filter(active.match)
      .sort((a, b) => (filter === "flagged" ? (risks[String(b.id)]?.score ?? 0) - (risks[String(a.id)]?.score ?? 0) : b.id - a.id))
  }, [campaigns, filters, filter, risks])

  const act = (fn) => async (...args) => {
    const result = await fn(...args)
    if (result?.success) refresh()
  }

  if (!isConnected) {
    return (
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>Connect the admin wallet to review campaigns.</AlertDescription>
      </Alert>
    )
  }

  if (checking) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>This page is for administrators only. Your wallet does not hold the admin role.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Campaign Review</h1>
        <p className="text-muted-foreground">
          Approve campaigns before they can receive donations. Suspending a live campaign stops donations and
          withdrawals and lets donors reclaim their money.
        </p>
      </div>

      {riskState === "down" && (
        <Alert className="border-amber-300 bg-amber-500/10 text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            The fraud-detection service cannot be reached, so no risk scores are shown. Reviewing still works normally.
          </AlertDescription>
        </Alert>
      )}
      {riskState === "ok" && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>
            Fraud service: {riskMeta?.flagged ?? 0} flagged · {riskMeta?.mlAvailable ? "rules + anomaly model" : "rules only"} · last scan{" "}
            {riskMeta?.scannedAt ? new Date(riskMeta.scannedAt).toLocaleTimeString() : "n/a"}
          </span>
          <Button variant="outline" size="sm" onClick={rescan} disabled={rescanning}>
            {rescanning ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />} Rescan
          </Button>
        </div>
      )}
      {rescanError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{rescanError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button key={f.key} variant={filter === f.key ? "default" : "outline"} size="sm" onClick={() => setFilter(f.key)}>
            {f.label} ({counts[f.key] ?? 0})
          </Button>
        ))}
      </div>

      {loadingList ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">Nothing here right now.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visible.map((c) => (
            <ReviewCard
              key={c.id}
              campaign={c}
              risk={risks[String(c.id)]}
              busy={busy}
              onApprove={act(approveCampaign)}
              onReject={act(rejectCampaign)}
              onSuspend={act(suspendCampaign)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default CampaignReview
