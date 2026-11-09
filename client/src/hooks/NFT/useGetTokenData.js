"use client"

import { useState, useCallback } from "react"
import { toast } from "react-toastify"
import { ethers } from "ethers"
import useContract from "../useContract"
import ClearCauseABI from "../../abis/ClearCause.json"

const useGetTokenData = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const contractAddress = import.meta.env.VITE_APP_CONTRACT_ADDRESS
  const { contract } = useContract(contractAddress, ClearCauseABI)

  const getTokenData = useCallback(
    async (tokenId) => {
      if (!contract) {
        // toast.error("Contract is not available")
        return null
      }

      setLoading(true)
      setError(null)

      try {
        // Get token data and URI in parallel
        const [tokenData, tokenURI] = await Promise.all([contract.getTokenData(tokenId), contract.tokenURI(tokenId)])

        return {
          campaignId: tokenData.campaignId.toString(),
          donationAmount: ethers.formatEther(tokenData.donationAmount),
          tokenURI,
        }
      } catch (err) {
        console.error("Error fetching token data:", err)

        // Handle specific contract errors
        if (err.message?.includes("NonExistentToken")) {
          setError("Token does not exist")
        } else {
          setError("Error fetching token data: " + (err.message || "Unknown error"))
        }

        toast.error(`Error: ${err.message || "An unknown error occurred."}`)
        return null
      } finally {
        setLoading(false)
      }
    },
    [contract],
  )

  return { getTokenData, loading, error }
}

export default useGetTokenData

