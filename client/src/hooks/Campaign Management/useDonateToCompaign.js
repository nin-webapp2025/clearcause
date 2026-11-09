"use client"

import { useState, useCallback } from "react"
import { toast } from "react-toastify"
import { ethers } from "ethers"
import { useAppKitAccount } from "@reown/appkit/react"
import useSignerOrProvider from "../useSignerOrProvider"
import useContract from "../useContract"
import ClearCauseABI from "../../abis/ClearCause.json"
import { findEvent, withRevertName } from "../../lib/receiptEvents"

const useDonateToCompaign = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { address, isConnected } = useAppKitAccount()
  const { signer } = useSignerOrProvider()
  const contractAddress = import.meta.env.VITE_APP_CONTRACT_ADDRESS
  const { contract } = useContract(contractAddress, ClearCauseABI)

  const donateToCampaign = useCallback(
    async (campaignId, amount) => {
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
        const tx = await contract.donateCampaign(campaignId, {
          value: ethers.parseEther(amount.toString()),
        })

        const receipt = await tx.wait()

        if (receipt.status === 1) {
          // Find the DonationMade event to get the token ID
          const event = findEvent(receipt, contract, "DonationMade")
          const tokenId = event?.args?.tokenId?.toString()

          toast.success("Donation successful! NFT minted.")
          return { success: true, tokenId, txHash: tx.hash }
        } else {
          throw new Error("Transaction failed")
        }
      } catch (err) {
        withRevertName(err, contract)
        console.error("Transaction error:", err)

        // Handle specific contract errors
        if (err.message?.includes("DeadlinePassed")) {
          setError("Campaign deadline has passed.")
        } else if (err.message?.includes("InvalidAmount")) {
          setError("Donation amount must be greater than 0.")
        } else if (err.message?.includes("InvalidStatus")) {
          setError("Campaign is not active.")
        } else {
          setError("Error donating to campaign: " + (err.message || "Unknown error"))
        }

        toast.error(`Error: ${err.message || "An unknown error occurred."}`)
        return { success: false, error: err.message }
      } finally {
        setLoading(false)
      }
    },
    [address, isConnected, signer, contract],
  )

  return { donateToCampaign, loading, error }
}

export default useDonateToCompaign

