"use client"
import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "../ui/card"
import { Button } from "../ui/button"
import { Progress } from "../ui/progress"
import { Skeleton } from "../ui/skeleton"
import { Badge } from "../ui/badge"
import { Textarea } from "../ui/textarea"
import { Label } from "../ui/label"
import { Users, Milestone, Clock, TrendingUp, CheckCircle, Loader2, AlertCircle, ExternalLink, ShieldAlert, Hourglass, XCircle } from "lucide-react"
import { Alert, AlertDescription } from "../ui/alert"
import useGetCampaign from "../../hooks/Campaign Data Retrieval/useGetCampaign"
import useCompleteMilestone from "../../hooks/Milestone Management/useCompleteMilestone"
import { toast } from "react-toastify"
import CampaignDonation from "./CampaignDonation"
import CampaignWithdrawal from "./CampaignWithdrawal"
import CampaignRefund from "./CampaignRefund"
import { useAppKitAccount } from "@reown/appkit/react"
import useGetDonations from "../../hooks/Campaign Data Retrieval/useGetDonations"
import useHasClaimedRefund from "../../hooks/Campaign Data Retrieval/useHasClaimedRefund"
import PayoutAddressForm from "./PayoutAddressForm"
import { REFUNDABLE } from "../../constant/campaignStatus"
import { txUrl, addressUrl, shortHash } from "../../constant/chain"

const CampaignDetails = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getCampaign, loading: hookLoading, error: hookError, isContractReady } = useGetCampaign()
  const { completeMilestone, loading: milestoneLoading, error: milestoneError } = useCompleteMilestone()
  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [proof, setProof] = useState("")
  const [userDonationAmount, setUserDonationAmount] = useState("0")
  const [hasClaimedRefund, setHasClaimedRefund] = useState(false)
  const { address } = useAppKitAccount()
  const { donations: onChainDonations } = useGetDonations(Number(id))
  const refundAlreadyClaimed = useHasClaimedRefund(Number(id))
  const [reloadKey, setReloadKey] = useState(0)

  // Fetch campaign data
  useEffect(() => {
    let mounted = true

    const fetchCampaign = async () => {
      if (!id) {
        console.error("Campaign ID is missing or undefined")
        setError("Campaign ID is required")
        setLoading(false)
        return
      }

      if (!isContractReady) {
        console.log("Waiting for contract to be ready...")
        return
      }

      try {
        setLoading(true)
        console.log("Fetching campaign with ID:", id)

        const campaignId = Number.parseInt(id, 10)

        if (isNaN(campaignId)) {
          throw new Error("Invalid campaign ID")
        }

        const result = await getCampaign(campaignId)

        if (!mounted) return

        if (result) {
          console.log("Campaign data received:", result)
          setCampaign(result)

          // Check if the current user has donated to this campaign
          if (address && result.donators) {
            // A donor can give several times: refunds return the total, so add them all up
            const userTotal = result.donators.reduce(
              (sum, donator, i) =>
                donator.toLowerCase() === address.toLowerCase() ? sum + Number.parseFloat(result.donations?.[i] || "0") : sum,
              0,
            )

            if (userTotal > 0 && result.donations) {
              setUserDonationAmount(String(userTotal))

              // In a real implementation, you would check if the user has claimed a refund
              // This would typically be done by calling a contract method
              setHasClaimedRefund(false)
            }
          }
        } else {
          console.log("No campaign data received")
          setError("Failed to fetch campaign data")
        }
      } catch (err) {
        console.error("Error in fetchCampaign:", err)
        if (mounted) {
          const errorMessage = err.message || "An error occurred while fetching the campaign"
          setError(errorMessage)
          toast.error(errorMessage)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchCampaign()

    return () => {
      mounted = false
    }
  }, [id, getCampaign, isContractReady, address, reloadKey])

  const handleCompleteMilestone = async () => {
    if (!proof.trim()) {
      toast.error("Please provide proof of milestone completion")
      return
    }

    try {
      const result = await completeMilestone(Number(id), proof)
      if (result && result.success) {
        toast.success(`Milestone ${Number(result.milestoneIndex) + 1} completed successfully!`)

        // Refresh campaign data
        const updatedCampaign = await getCampaign(Number(id))
        if (updatedCampaign) {
          setCampaign(updatedCampaign)
        }

        // Clear proof input
        setProof("")
      }
    } catch (err) {
      console.error("Error completing milestone:", err)
    }
  }

  if (!id) {
    return (
      <Card className="p-6">
        <div className="text-center text-destructive">Error: Campaign ID is required</div>
      </Card>
    )
  }

  if (!isContractReady || loading || hookLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="w-full h-64 rounded-lg" />
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || hookError) {
    const displayError = error || hookError
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <div className="text-destructive">Error: {displayError}</div>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </Card>
    )
  }

  if (!campaign) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">No campaign data available</div>
      </Card>
    )
  }

  const statusColors = {
    Active: "bg-green-500/10 text-green-500",
    Successful: "bg-blue-500/10 text-blue-500",
    Failed: "bg-red-500/10 text-red-500",
    Paid: "bg-purple-500/10 text-purple-500",
    Pending: "bg-amber-500/10 text-amber-600",
    Rejected: "bg-red-500/10 text-red-500",
    Suspended: "bg-orange-500/10 text-orange-600",
  }

  const formatTimeRemaining = (timeInSeconds) => {
    if (timeInSeconds <= 0) return "Ended"
    const days = Math.floor(timeInSeconds / (24 * 60 * 60))
    const hours = Math.floor((timeInSeconds % (24 * 60 * 60)) / (60 * 60))
    return `${days}d ${hours}h remaining`
  }

  const isEnded = campaign.analytics.timeRemaining <= 0
  const isSuccessful = campaign.statusText === "Successful"
  const isRefundable = REFUNDABLE.includes(campaign.statusText)
  const showDonation = campaign.statusText === "Active"
  const isOwner = address && campaign.owner && address.toLowerCase() === campaign.owner.toLowerCase()
  const canCompleteMilestone =
    isOwner &&
    campaign.statusText === "Active" &&
    campaign.analytics.currentMilestoneIndex < campaign.milestones.length - 1

  // Check if user can claim refund
  const canClaimRefund = isRefundable && Number.parseFloat(userDonationAmount) > 0 && !hasClaimedRefund && !refundAlreadyClaimed

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{campaign.title}</h1>
        <Badge className={statusColors[campaign.statusText]} variant="outline">
          {campaign.statusText}
        </Badge>
      </div>

      <img
        src={campaign.image || "/placeholder.svg"}
        alt={campaign.title}
        className="w-full h-64 object-cover rounded-lg"
        onError={(e) => {
          e.currentTarget.onerror = null
          e.currentTarget.src = "/placeholder.svg"
        }}
      />

      {campaign.statusText === "Pending" && (
        <Alert className="border-amber-300 bg-amber-500/10 text-amber-800">
          <Hourglass className="h-4 w-4" />
          <AlertDescription>
            {isOwner
              ? "Your campaign is waiting for admin review. It cannot receive donations until it is approved."
              : "This campaign is waiting for admin review and cannot receive donations yet."}
          </AlertDescription>
        </Alert>
      )}
      {campaign.statusText === "Rejected" && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>This campaign was rejected by an administrator and cannot receive donations.</AlertDescription>
        </Alert>
      )}
      {campaign.statusText === "Suspended" && (
        <Alert className="border-orange-300 bg-orange-500/10 text-orange-800">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            This campaign was suspended by an administrator. Donations and withdrawals are stopped, and donors can claim
            a refund.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">{campaign.description}</p>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Target: {campaign.target} ETH</span>
              <span>Raised: {campaign.amountCollected} ETH</span>
            </div>
            <Progress value={campaign.analytics.fundingProgress} className="h-2" />
            <div className="flex justify-end">
              <span className="text-xs text-muted-foreground">{campaign.analytics.fundingProgress}% funded</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>Backers: {campaign.analytics.totalBackers}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{formatTimeRemaining(campaign.analytics.timeRemaining)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Milestone className="h-4 w-4 text-muted-foreground" />
              <span>
                Milestone: {campaign.analytics.currentMilestoneIndex + 1} of {campaign.milestones.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span>Next Milestone: {campaign.milestones[campaign.analytics.currentMilestoneIndex] || "0"} ETH</span>
            </div>
          </div>

          {onChainDonations.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">Donations (verifiable on-chain)</h3>
              <div className="space-y-1">
                {onChainDonations.slice(0, 5).map((d) => (
                  <div key={d.txHash + d.tokenId} className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span>
                      {d.amount} ETH from <span className="font-mono">{d.donor.slice(0, 6)}…{d.donor.slice(-4)}</span>
                    </span>
                    {txUrl(d.txHash) ? (
                      <a
                        href={txUrl(d.txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs underline"
                        title={d.txHash}
                      >
                        {shortHash(d.txHash)} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="font-mono text-xs" title={d.txHash}>
                        {shortHash(d.txHash)}
                      </span>
                    )}
                  </div>
                ))}
                {onChainDonations.length > 5 && (
                  <p className="text-xs text-muted-foreground">Showing the latest 5 of {onChainDonations.length} donations.</p>
                )}
              </div>
            </div>
          )}

          <div className="pt-4 border-t">
            <div className="text-sm text-muted-foreground break-all">Owner: {campaign.owner}</div>
            <div className="text-sm text-muted-foreground break-all mt-1">
              Payout address:{" "}
              {addressUrl(campaign.payoutAddress) ? (
                <a href={addressUrl(campaign.payoutAddress)} target="_blank" rel="noreferrer" className="underline">
                  {campaign.payoutAddress}
                </a>
              ) : (
                campaign.payoutAddress
              )}
            </div>
            {isOwner && campaign.statusText === "Pending" && (
              <div className="mt-3">
                <PayoutAddressForm
                  campaignId={Number(id)}
                  current={campaign.payoutAddress}
                  onChanged={() => setReloadKey((k) => k + 1)}
                />
              </div>
            )}
            <div className="text-sm text-muted-foreground mt-1">
              Status: {campaign.paidOut ? "Funds Released" : "Funds Locked"}
            </div>
          </div>

          {/* Milestone Completion Section (Only visible to campaign owner) */}
          {canCompleteMilestone && (
            <Card className="border-2 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Complete Milestone
                </CardTitle>
                <CardDescription>
                  Mark the current milestone as completed to unlock the next funding milestone
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="proof">Proof of Completion</Label>
                  <Textarea
                    id="proof"
                    placeholder="Provide details or links to evidence of milestone completion"
                    value={proof}
                    onChange={(e) => setProof(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Provide evidence that you've completed the current milestone. This could be links to deliverables,
                    progress reports, or other relevant information.
                  </p>
                </div>

                {milestoneError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{milestoneError}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={handleCompleteMilestone}
                  disabled={milestoneLoading || !proof.trim()}
                >
                  {milestoneLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Complete Milestone {campaign.analytics.currentMilestoneIndex + 1}
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          )}

          <div className="space-y-6">
            {/* Donation Component */}
            {showDonation && <CampaignDonation campaignId={Number(id)} isActive={true} minAmount={0.01} />}

            {/* Withdrawal Component */}
            {["Active", "Successful", "Paid"].includes(campaign.statusText) && (
              <CampaignWithdrawal
                campaignId={Number(id)}
                campaignOwner={campaign.owner}
                isEnded={isEnded}
                isSuccessful={isSuccessful}
                isPaidOut={campaign.paidOut}
                amountCollected={campaign.amountCollected}
              />
            )}

            {/* Refund Component */}
            {canClaimRefund && (
              <CampaignRefund
                campaignId={Number(id)}
                campaignTitle={campaign.title}
                isFailed={isRefundable}
                donationAmount={userDonationAmount}
                hasClaimedRefund={hasClaimedRefund}
              />
            )}

            <Button className="w-full" onClick={() => navigate(-1)}>
              Back to Campaigns
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default CampaignDetails

