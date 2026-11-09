"use client"

import { useState, useCallback } from "react"
import { toast } from "react-toastify"
import { ethers } from "ethers"
import { useAppKitAccount } from "@reown/appkit/react"
import useSignerOrProvider from "../useSignerOrProvider"
import useContract from "../useContract"
import ClearCauseABI from "../../abis/ClearCause.json"
import { findEvent, withRevertName } from "../../lib/receiptEvents"

const useClaimRefund = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { address, isConnected } = useAppKitAccount()
  const { signer } = useSignerOrProvider()
  const contractAddress = import.meta.env.VITE_APP_CONTRACT_ADDRESS
  const { contract } = useContract(contractAddress, ClearCauseABI)

  const claimRefund = useCallback(
    async (campaignId) => {
      if (!address || !isConnected) {
        toast.error("Please connect your wallet")
        return { success: false }
      }

      if (!signer || !contract) {
        // toast.error("Contract or signer is not available")
        return { success: false }
      }

      setLoading(true)
      setError(null)

      try {
        const tx = await contract.claimRefund(campaignId)
        const receipt = await tx.wait()

        if (receipt.status === 1) {
          // Find the RefundClaimed event to get the refund amount
          const event = findEvent(receipt, contract, "RefundClaimed")
          const amount = event?.args?.amount

          toast.success("Refund claimed successfully!")
          return { success: true, amount: ethers.formatEther(amount) }
        } else {
          throw new Error("Transaction failed")
        }
      } catch (err) {
        withRevertName(err, contract)
        console.error("Transaction error:", err)

        // Handle specific contract errors
        if (err.message?.includes("CampaignNotFailed")) {
          setError("Campaign is not in failed state. Refunds are only available for failed campaigns.")
        } else if (err.message?.includes("RefundAlreadyClaimed")) {
          setError("You have already claimed your refund for this campaign.")
        } else if (err.message?.includes("InvalidAmount")) {
          setError("You don't have any donations to refund for this campaign.")
        } else {
          setError("Error claiming refund: " + (err.message || "Unknown error"))
        }

        toast.error(`Error: ${err.message || "An unknown error occurred."}`)
        return { success: false, error: err.message }
      } finally {
        setLoading(false)
      }
    },
    [address, isConnected, signer, contract],
  )

  return { claimRefund, loading, error }
}

export default useClaimRefund

