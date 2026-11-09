"use client"

import { useState, useCallback } from "react"
import { toast } from "react-toastify"
import useContract from "../useContract"
import ClearCauseABI from "../../abis/ClearCause.json"

// Error mapping for known error messages
const ERROR_MESSAGES = {
  UserNotFound: "User stats not found",
  InvalidAddress: "Invalid wallet address provided",
}

const getReadableError = (error) => {
  // Check if it's a known contract error
  for (const [key, message] of Object.entries(ERROR_MESSAGES)) {
    if (error.message?.includes(key)) {
      return message
    }
  }

  // Check for specific error messages in the error object
  if (error.reason) return error.reason
  if (error.data?.message) return error.data.message
  if (error.message) {
    const message = error.message.replace("execution reverted:", "").replace("Error:", "").trim()
    return message.charAt(0).toUpperCase() + message.slice(1)
  }

  return "Failed to fetch user statistics. Please try again."
}

const useGetUserStats = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const contractAddress = import.meta.env.VITE_APP_CONTRACT_ADDRESS
  const { contract } = useContract(contractAddress, ClearCauseABI)

  const getUserStats = useCallback(
    async (userAddress) => {
      if (!contract) {
        const message = "Contract is not available"
        setError(message)
        // toast.error(message)
        return null
      }

      if (!userAddress) {
        const message = "No wallet address provided"
        setError(message)
        toast.error(message)
        return null
      }

      setLoading(true)
      setError(null)

      try {
        const userStats = await contract.getUserStats(userAddress)

        // Format the stats
        const formattedStats = {
          campaignsCreated: Number(userStats.campaignsCreated || 0),
          campaignsBacked: Number(userStats.campaignsBacked || 0),
          proposalsCreated: Number(userStats.proposalsCreated || 0),
          proposalsVoted: Number(userStats.proposalsVoted || 0),
          totalDonated: Number(userStats.totalDonated || 0) / 1e18, // Convert from wei to ETH
          reputationScore: Number(userStats.reputationScore || 0),
          reputationTier: Number(userStats.reputationTier || 0),
          lastActivityTimestamp: Number(userStats.lastActivityTimestamp || 0),
        }

        return formattedStats
      } catch (err) {
        console.error("Error fetching user stats:", err)
        const readableError = getReadableError(err)
        setError(readableError)
        toast.error(readableError)
        return null
      } finally {
        setLoading(false)
      }
    },
    [contract],
  )

  return { getUserStats, loading, error }
}

export default useGetUserStats

