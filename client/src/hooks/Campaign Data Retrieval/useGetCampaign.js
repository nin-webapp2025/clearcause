"use client"

import { useState, useCallback, useEffect } from "react"
import { toast } from "react-toastify"
import { ethers } from "ethers"
import useContract from "../useContract"
import ClearCauseABI from "../../abis/ClearCause.json"
import { CAMPAIGN_STATUS } from "../../constant/campaignStatus"

const useGetCampaign = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isContractReady, setIsContractReady] = useState(false)
  const contractAddress = import.meta.env.VITE_APP_CONTRACT_ADDRESS
  const { contract } = useContract(contractAddress, ClearCauseABI)

  useEffect(() => {
    if (contract) {
      setIsContractReady(true)
    }
  }, [contract])

  const getCampaign = useCallback(
    async (campaignId) => {
      if (!isContractReady || !contract) {
        console.log("Contract not ready yet")
        return null
      }

      if (campaignId === undefined || campaignId === null) {
        console.error("Campaign ID is required")
        setError("Campaign ID is required")
        return null
      }

      setLoading(true)
      setError(null)

      try {
        // Get campaign data, analytics, and fund flow in parallel
        const [campaignData, analytics, fundFlow, payoutAddress] = await Promise.all([
          contract.getCampaign(campaignId),
          contract.getCampaignAnalytics(campaignId),
          contract.getCampaignFundFlow(campaignId),
          contract.getPayoutAddress(campaignId),
        ])

        if (!campaignData) {
          throw new Error("Campaign data is undefined")
        }

        // Destructure analytics according to contract return values
        const [totalBackers, fundingProgress, timeRemaining, currentMilestone] = analytics

        // Destructure fund flow according to contract return values
        const [donations, milestones] = fundFlow

        // Format campaign data matching contract struct exactly
        const formattedCampaign = {
          id: campaignId,
          owner: campaignData.owner,
          payoutAddress,
          title: campaignData.title,
          description: campaignData.description,
          target: ethers.formatEther(campaignData.target),
          deadline: Number(campaignData.deadline),
          amountCollected: ethers.formatEther(campaignData.amountCollected),
          image: campaignData.image,
          donators: campaignData.donators,
          donations: donations.map((d) => ethers.formatEther(d)),
          paidOut: campaignData.paidOut,
          milestones: milestones.map((m) => ethers.formatEther(m)),
          currentMilestone: Number(campaignData.currentMilestone),
          // Map status exactly as defined in contract enum
          status: Number(campaignData.status),
          statusText: CAMPAIGN_STATUS[Number(campaignData.status)],
          analytics: {
            totalBackers: Number(totalBackers), // From getCampaignAnalytics
            fundingProgress: Number(fundingProgress), // Percentage value
            timeRemaining: Number(timeRemaining), // In seconds
            currentMilestoneIndex: Number(currentMilestone),
          },
        }

        return formattedCampaign
      } catch (err) {
        console.error("Error fetching campaign:", err)

        // Match contract error cases exactly
        if (err.message.includes("CampaignNotFound")) {
          setError("Campaign not found")
        } else if (err.message.includes("InvalidAddress")) {
          setError("Invalid address provided")
        } else if (err.message.includes("Unauthorized")) {
          setError("Unauthorized access")
        } else {
          setError("Error fetching campaign: " + (err.message || "Unknown error"))
        }

        toast.error(`Error: ${err.message || "An unknown error occurred"}`)
        return null
      } finally {
        setLoading(false)
      }
    },
    [contract, isContractReady],
  )

  const getAllCampaigns = useCallback(async () => {
    if (!isContractReady || !contract) {
      console.log("Contract not ready yet")
      return null
    }

    setLoading(true)
    setError(null)

    try {
      const campaigns = await contract.getAllCampaigns()

      // Process each campaign with its analytics and fund flow
      const formattedCampaigns = await Promise.all(
        campaigns.map(async (campaign, index) => {
          // Get additional data for each campaign
          const [analytics, fundFlow, payoutAddress] = await Promise.all([
            contract.getCampaignAnalytics(index),
            contract.getCampaignFundFlow(index),
            contract.getPayoutAddress(index),
          ])

          const [donations, milestones] = fundFlow
          const [totalBackers, fundingProgress, timeRemaining, currentMilestone] = analytics

          return {
            id: index,
            owner: campaign.owner,
            payoutAddress,
            title: campaign.title,
            description: campaign.description,
            target: ethers.formatEther(campaign.target),
            deadline: Number(campaign.deadline),
            amountCollected: ethers.formatEther(campaign.amountCollected),
            image: campaign.image,
            donators: campaign.donators,
            donations: donations.map((d) => ethers.formatEther(d)),
            paidOut: campaign.paidOut,
            milestones: milestones.map((m) => ethers.formatEther(m)),
            currentMilestone: Number(campaign.currentMilestone),
            status: Number(campaign.status),
            statusText: CAMPAIGN_STATUS[Number(campaign.status)],
            analytics: {
              totalBackers: Number(totalBackers),
              fundingProgress: Number(fundingProgress),
              timeRemaining: Number(timeRemaining),
              currentMilestoneIndex: Number(currentMilestone),
            },
          }
        }),
      )

      return formattedCampaigns
    } catch (err) {
      console.error("Error fetching all campaigns:", err)
      setError("Error fetching campaigns: " + (err.message || "Unknown error"))
      toast.error(`Error: ${err.message || "An unknown error occurred"}`)
      return null
    } finally {
      setLoading(false)
    }
  }, [contract, isContractReady])

  return {
    getCampaign,
    getAllCampaigns,
    loading,
    error,
    isContractReady,
  }
}

export default useGetCampaign

