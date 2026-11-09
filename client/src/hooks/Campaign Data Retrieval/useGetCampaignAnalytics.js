"use client"

import { useState, useCallback } from "react"
import { toast } from "react-toastify"
import useContract from "../useContract"
import ClearCauseABI from "../../abis/ClearCause.json"

const useGetCampaignAnalytics = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const contractAddress = import.meta.env.VITE_APP_CONTRACT_ADDRESS
  const { contract } = useContract(contractAddress, ClearCauseABI)

  const getCampaignAnalytics = useCallback(
    async (campaignId) => {
      if (!contract) {
        // toast.error("Contract is not available")
        return null
      }

      setLoading(true)
      setError(null)

      try {
        const analytics = await contract.getCampaignAnalytics(campaignId)

        // Format the analytics based on the contract return values
        return {
          totalBackers: Number(analytics.totalBackers),
          fundingProgress: Number(analytics.fundingProgress), // This is a percentage
          timeRemaining: Number(analytics.timeRemaining), // In seconds
          currentMilestone: Number(analytics.currentMilestone),
        }
      } catch (err) {
        console.error("Error fetching campaign analytics:", err)

        // Handle specific contract errors
        if (err.message?.includes("CampaignNotFound")) {
          setError("Campaign not found")
        } else {
          setError("Error fetching campaign analytics: " + (err.message || "Unknown error"))
        }

        toast.error(`Error: ${err.message || "An unknown error occurred."}`)
        return null
      } finally {
        setLoading(false)
      }
    },
    [contract],
  )

  return { getCampaignAnalytics, loading, error }
}

export default useGetCampaignAnalytics

