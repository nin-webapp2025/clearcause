"use client"

import { useState, useCallback } from "react"
import { toast } from "react-toastify"
import { ethers } from "ethers"
import { useAppKitAccount } from "@reown/appkit/react"
import useSignerOrProvider from "../useSignerOrProvider"
import useContract from "../useContract"
import ClearCauseABI from "../abis/ClearCause.json"
import { findEvent, withRevertName } from "../../lib/receiptEvents"

const useUpdateMilestone = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { address, isConnected } = useAppKitAccount()
  const { signer } = useSignerOrProvider()
  const contractAddress = import.meta.env.VITE_APP_CONTRACT_ADDRESS
  const { contract } = useContract(contractAddress, ClearCauseABI)

  const updateMilestone = useCallback(
    async (campaignId, milestoneIndex, newValue) => {
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
        // Convert newValue to wei
        const newValueInWei = ethers.parseEther(newValue.toString())

        const tx = await contract.updateMilestone(campaignId, milestoneIndex, newValueInWei)
        const receipt = await tx.wait()

        if (receipt.status === 1) {
          // Find the MilestoneUpdated event
          const event = findEvent(receipt, contract, "MilestoneUpdated")

          toast.success("Milestone updated successfully!")
          return {
            success: true,
            milestoneIndex: event?.args?.milestoneIndex.toString(),
            newValue: ethers.formatEther(event?.args?.newValue),
          }
        } else {
          throw new Error("Transaction failed")
        }
      } catch (err) {
        withRevertName(err, contract)
        console.error("Transaction error:", err)

        // Handle specific contract errors
        if (err.message?.includes("Unauthorized")) {
          setError("Only the campaign owner can update milestones.")
        } else if (err.message?.includes("IndexOutOfBounds")) {
          setError("Invalid milestone index.")
        } else {
          setError("Error updating milestone: " + (err.message || "Unknown error"))
        }

        toast.error(`Error: ${err.message || "An unknown error occurred."}`)
        return { success: false, error: err.message }
      } finally {
        setLoading(false)
      }
    },
    [address, isConnected, signer, contract],
  )

  return { updateMilestone, loading, error }
}

export default useUpdateMilestone

