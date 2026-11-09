"use client"

import { useState, useCallback } from "react"
import { toast } from "react-toastify"
import { ethers } from "ethers"
import useContract from "../useContract"
import ClearCauseABI from "../../abis/ClearCause.json"

const useGetAllProposals = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const contractAddress = import.meta.env.VITE_APP_CONTRACT_ADDRESS
  const { contract } = useContract(contractAddress, ClearCauseABI)

  const getAllProposals = useCallback(async () => {
    if (!contract) {
      console.error("Contract not available")
      // toast.error("Contract is not available")
      return []
    }

    setLoading(true)
    setError(null)

    try {
      const proposals = await contract.getAllProposals()

      // Format proposals and ensure all numeric values are properly converted
      const formattedProposals = proposals
        .filter((proposal) => Number(proposal.id) > 0) // Filter out any zero-id proposals
        .map((proposal) => ({
          id: Number(proposal.id),
          description: proposal.description,
          forVotes: Number(proposal.forVotes),
          againstVotes: Number(proposal.againstVotes),
          executed: proposal.executed,
          endTime: Number(proposal.endTime),
          totalVotes: Number(proposal.totalVotes),
          campaignId: Number(proposal.campaignId),
          proposalType: Number(proposal.proposalType),
          proposalTypeText: ["Unsupported Legacy Type", "Milestone Adjustment"][Number(proposal.proposalType)],
          createdAt: Number(proposal.createdAt),
          creator: proposal.creator,
          newMilestones: proposal.newMilestones?.map((m) => ethers.formatEther(m)) || [],
        }))

      return formattedProposals
    } catch (err) {
      console.error("Error fetching proposals:", err)
      setError("Error fetching proposals: " + (err.message || "Unknown error"))
      toast.error(`Error: ${err.message || "An unknown error occurred."}`)
      return []
    } finally {
      setLoading(false)
    }
  }, [contract])

  return { getAllProposals, loading, error }
}

export default useGetAllProposals

