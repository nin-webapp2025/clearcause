"use client"

import { useState, useCallback } from "react"
import { toast } from "react-toastify"
import { ethers } from "ethers"
import { useAppKitAccount } from "@reown/appkit/react"
import useSignerOrProvider from "../useSignerOrProvider"
import useContract from "../useContract"
import ClearCauseABI from "../../abis/ClearCause.json"
import { findEvent, withRevertName } from "../../lib/receiptEvents"

const useCreateProposal = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { address, isConnected } = useAppKitAccount()
  const { signer } = useSignerOrProvider()
  const contractAddress = import.meta.env.VITE_APP_CONTRACT_ADDRESS
  const { contract } = useContract(contractAddress, ClearCauseABI)

  const createProposal = useCallback(
    async (campaignId, description, votingPeriod, proposalType, newMilestones = []) => {
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
        // Convert voting period to seconds
        const votingPeriodInSeconds = votingPeriod * 24 * 60 * 60 // days to seconds

        // Convert milestone values to wei if provided
        const milestonesInWei = newMilestones.map((milestone) => ethers.parseEther(milestone.toString()))

        const tx = await contract.createProposal(
          campaignId,
          description,
          votingPeriodInSeconds,
          proposalType,
          milestonesInWei,
        )

        // Wait for the transaction to be mined and get the receipt
        const receipt = await tx.wait()

        // Check for the ProposalCreated event
        const event = findEvent(receipt, contract, "ProposalCreated")
        if (!event) {
          throw new Error("Proposal creation event not found")
        }

        const proposalId = event.args.proposalId.toString()

        toast.success("Proposal created successfully!")
        return { success: true, proposalId }
      } catch (err) {
        withRevertName(err, contract)
        console.error("Transaction error:", err)

        // Handle specific contract errors
        if (err.message?.includes("InvalidDuration")) {
          setError("Voting period must be between 1 and 7 days.")
        } else if (err.message?.includes("InvalidMilestoneCount")) {
          setError("Invalid milestone count. Must be between 1 and 10.")
        } else if (err.message?.includes("CampaignNotFound")) {
          setError("Campaign not found.")
        } else if (err.message?.includes("InvalidKYC")) {
          setError("You must complete KYC verification first.")
        } else {
          setError("Error creating proposal: " + (err.message || "Unknown error"))
        }

        toast.error(`Error: ${err.message || "An unknown error occurred."}`)
        return { success: false, error: err.message }
      } finally {
        setLoading(false)
      }
    },
    [address, isConnected, signer, contract],
  )

  return { createProposal, loading, error }
}

export default useCreateProposal

