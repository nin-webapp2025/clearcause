"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, ArrowDownToLine, CheckCircle, Ban } from "lucide-react"
import { useAppKitAccount } from "@reown/appkit/react"
import useClaimRefund from "../../hooks/Campaign Management/useClaimRefund"
import { toast } from "react-toastify"

const CampaignRefund = ({
  campaignId,
  campaignTitle,
  isFailed = false,
  donationAmount = "0",
  hasClaimedRefund = false,
}) => {
  const [isRefunded, setIsRefunded] = useState(hasClaimedRefund)
  const [refundAmount, setRefundAmount] = useState(null)
  const { claimRefund, loading, error } = useClaimRefund()
  const { address, isConnected } = useAppKitAccount()

  // If campaign is not failed, don't show the refund component
  if (!isFailed) {
    return null
  }

  // If user has already claimed a refund, show the claimed state
  if (isRefunded || hasClaimedRefund) {
    return (
      <Card className="border-2 border-green-500/20 bg-green-500/5">
        <CardContent className="pt-6 pb-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-lg">Refund Claimed</h3>
            <p className="text-sm text-muted-foreground">
              {refundAmount ? `${refundAmount} ETH has been refunded to your wallet` : "Your refund has been processed"}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // If user has no donations to refund, show empty state
  if (Number.parseFloat(donationAmount) <= 0) {
    return (
      <Card className="border-2 border-muted/20">
        <CardContent className="pt-6 pb-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Ban className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg">No Refund Available</h3>
            <p className="text-sm text-muted-foreground">You don't have any donations to refund for this campaign</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const handleClaimRefund = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet to claim a refund")
      return
    }

    try {
      const result = await claimRefund(campaignId)
      if (result && result.success) {
        setRefundAmount(result.amount)
        setIsRefunded(true)
      }
    } catch (err) {
      console.error("Refund error:", err)
    }
  }

  return (
    <Card className="border-2 border-yellow-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowDownToLine className="h-5 w-5 text-yellow-500" />
          Claim Your Refund
        </CardTitle>
        <CardDescription>This campaign can no longer pay out, so donations are being returned</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span>Available to refund:</span>
            <span className="font-semibold">{donationAmount} ETH</span>
          </div>
          <p className="text-sm text-muted-foreground">
            The campaign "{campaignTitle}" failed to reach its goal or was suspended by an administrator, so you can
            claim a refund for your donation.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!isConnected && (
          <Alert variant="warning" className="bg-yellow-500/10 text-yellow-700 border-yellow-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Please connect your wallet to claim your refund</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={handleClaimRefund} disabled={loading || !isConnected}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing Refund...
            </>
          ) : (
            <>
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              Claim {donationAmount} ETH Refund
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

export default CampaignRefund

