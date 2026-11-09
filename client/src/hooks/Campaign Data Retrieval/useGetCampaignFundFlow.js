"use client"

import { useState, useCallback } from "react"
import { toast } from "react-toastify"
import { ethers } from "ethers"
import useContract from "../useContract"
import ClearCauseABI from "../../abis/ClearCause.json"

const useGetCampaignFundFlow = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const contractAddress = import.meta.env.VITE_APP_CONTRACT_ADDRESS
  const { contract } = useContract(contractAddress, ClearCauseABI)

  const getCampaignFundFlow = useCallback(
    async (campaignId) => {
      if (!contract) {
        // toast.error("Contract is not available")
        return null
      }

      setLoading(true)
      setError(null)

      try {
        const fundFlow = await contract.getCampaignFundFlow(campaignId)
        return {
          donations: fundFlow[0].map((d) => ethers.formatEther(d)),
          milestones: fundFlow[1].map((m) => ethers.formatEther(m)),
        }
      } catch (err) {
        console.error("Error fetching campaign fund flow:", err)
        setError("Error fetching campaign fund flow: " + (err.message || "Unknown error"))
        toast.error(`Error: ${err.message || "An unknown error occurred."}`)
        return null
      } finally {
        setLoading(false)
      }
    },
    [contract],
  )

  return { getCampaignFundFlow, loading, error }
}

export default useGetCampaignFundFlow

