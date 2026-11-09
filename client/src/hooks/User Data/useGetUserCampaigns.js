"use client"

import { useState, useCallback } from "react"
import { toast } from "react-toastify"
import useContract from "../useContract"
import ClearCauseABI from "../../abis/ClearCause.json"

const useGetUserCampaigns = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const contractAddress = import.meta.env.VITE_APP_CONTRACT_ADDRESS
  const { contract } = useContract(contractAddress, ClearCauseABI)

  const getUserCampaigns = useCallback(
    async (userAddress) => {
      if (!contract) {
        // toast.error("Contract is not available")
        return null
      }

      setLoading(true)
      setError(null)

      try {
        const campaignIds = await contract.getUserCampaigns(userAddress)
        return campaignIds.map((id) => id.toNumber())
      } catch (err) {
        console.error("Error fetching user campaigns:", err)
        setError("Error fetching user campaigns: " + (err.message || "Unknown error"))
        toast.error(`Error: ${err.message || "An unknown error occurred."}`)
        return null
      } finally {
        setLoading(false)
      }
    },
    [contract],
  )

  return { getUserCampaigns, loading, error }
}

export default useGetUserCampaigns

