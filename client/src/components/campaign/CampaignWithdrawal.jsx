"use client"

import { useState, useEffect } from "react"
import { Wallet, Loader2, AlertCircle, RefreshCw, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAppKitAccount } from "@reown/appkit/react"
import useWithdrawCampaignFunds from "../../hooks/Campaign Management/useWithdrawCampaignFunds"
import useCheckCampaignStatus from "../../hooks/Campaign Management/useCheckCampaignStatus"

const CampaignWithdrawal = ({ campaignId, campaignOwner, isEnded, isSuccessful, isPaidOut, amountCollected }) => {
  const { withdrawCampaignFunds, loading: withdrawLoading, error: withdrawError } = useWithdrawCampaignFunds()
  const { checkCampaignStatus, loading: checkLoading, error: checkError } = useCheckCampaignStatus()

  const { address } = useAppKitAccount()
  const [isWithdrawn, setIsWithdrawn] = useState(false)
  const [statusUpdated, setStatusUpdated] = useState(false)
  const [currentStatus, setCurrentStatus] = useState(isSuccessful ? "Successful" : isEnded ? "Ended" : "Active")

  // Normalize addresses for comparison (convert to lowercase)
  const normalizedOwner = campaignOwner?.toLowerCase()
  const normalizedAddress = address?.toLowerCase()

  const isOwner = normalizedOwner === normalizedAddress
  const loading = withdrawLoading || checkLoading
  const error = withdrawError || checkError

  // Check if campaign status needs to be updated when component mounts
  useEffect(() => {
    if (isEnded && !isSuccessful && !isPaidOut && isOwner) {
      handleCheckStatus()
    }
  }, [isEnded, isSuccessful, isPaidOut, isOwner, campaignId])

  // If any of these conditions are not met, don't show the withdrawal component
  if (!isEnded) {
    return null
  }

  if (isPaidOut) {
    return (
      <Card className="border-2 border-green-500/20 bg-green-500/5">
        <CardContent className="pt-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-lg">Funds Already Withdrawn</h3>
            <p className="text-sm text-muted-foreground">
              {amountCollected} ETH has been transferred to the campaign owner's wallet
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!address || !campaignOwner) {
    return null
  }

  if (!isOwner) {
    return null
  }

  const handleCheckStatus = async () => {
    try {
      const result = await checkCampaignStatus(campaignId)
      if (result.success) {
        if (result.statusChanged) {
          setCurrentStatus(result.newStatus)
          setStatusUpdated(true)
        }
      }
    } catch (err) {
      console.error("Status check error:", err)
    }
  }

  const handleWithdraw = async () => {
    try {
      const result = await withdrawCampaignFunds(campaignId)
      if (result.success) {
        setIsWithdrawn(true)
      }
    } catch (err) {
      console.error("Withdrawal error:", err)
    }
  }

  if (isWithdrawn) {
    return (
      <Card className="border-2 border-green-500/20 bg-green-500/5">
        <CardContent className="pt-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Wallet className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-lg">Funds Withdrawn Successfully!</h3>
            <p className="text-sm text-muted-foreground">{amountCollected} ETH has been transferred to your wallet</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // If campaign has ended but is not marked as successful yet
  if (isEnded && !isSuccessful) {
    return (
      <Card className="border-2 border-yellow-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-yellow-500" />
            Update Campaign Status
          </CardTitle>
          <CardDescription>
            Your campaign has ended but needs to be updated to determine if it was successful
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span>Current status:</span>
              <span className="font-semibold">{currentStatus}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Before you can withdraw funds, the campaign status needs to be updated on the blockchain.
            </p>
          </div>

          {statusUpdated && currentStatus === "Successful" && (
            <Alert className="bg-green-500/10 text-green-700 border-green-200">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Status updated successfully! Your campaign was successful and you can now withdraw funds.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button
            className="w-full"
            onClick={handleCheckStatus}
            disabled={loading || (statusUpdated && currentStatus === "Successful")}
          >
            {checkLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking Status...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Check Campaign Status
              </>
            )}
          </Button>

          {statusUpdated && currentStatus === "Successful" && (
            <Button className="w-full" onClick={handleWithdraw} disabled={loading} variant="default">
              {withdrawLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing Withdrawal...
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Withdraw {amountCollected} ETH
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    )
  }

  // Default case: Campaign is successful and ready for withdrawal
  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Withdraw Campaign Funds
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span>Available to withdraw:</span>
            <span className="font-semibold">{amountCollected} ETH</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Your campaign has successfully reached its goal. You can now withdraw the collected funds to your wallet.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={handleWithdraw} disabled={loading}>
          {withdrawLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing Withdrawal...
            </>
          ) : (
            <>
              <Wallet className="mr-2 h-4 w-4" />
              Withdraw {amountCollected} ETH
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

export default CampaignWithdrawal

