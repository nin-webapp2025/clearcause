"use client"

import { useState, useCallback } from "react"
import { toast } from "react-toastify"
import { ethers } from "ethers"
import useContract from "../useContract"
import ClearCauseABI from "../../abis/ClearCause.json"
import { CAMPAIGN_STATUS } from "../../constant/campaignStatus"
import { DEPLOY_BLOCK } from "../../constant/chain"

const useGetUserActivities = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const contractAddress = import.meta.env.VITE_APP_CONTRACT_ADDRESS
  const { contract } = useContract(contractAddress, ClearCauseABI)

  const getUserActivities = useCallback(
    async (userAddress, options = {}) => {
      if (!contract || !userAddress) {
        return []
      }

      setLoading(true)
      setError(null)

      // Default options with fallbacks - respect the 10,000 block limit
      const {
        fromBlock = DEPLOY_BLOCK,
        toBlock = "latest",
        maxRetries = 3,
        retryDelay = 1000,
      } = options

      let retries = 0

      const fetchEvents = async () => {
        try {
          let resolvedFromBlock = fromBlock
          if (typeof fromBlock === "number" && fromBlock < 0) {
            const latestBlock = await contract.runner.provider.getBlockNumber()
            resolvedFromBlock = Math.max(DEPLOY_BLOCK, latestBlock + fromBlock)
          }

          // Define filter with configurable block range
          const filter = {
            fromBlock: resolvedFromBlock,
            toBlock,
          }

          // Get campaign created events
          const campaignCreatedEvents = await contract.queryFilter(
            contract.filters.CampaignCreated(null, userAddress),
            filter.fromBlock,
            filter.toBlock,
          )

          // Get donation events
          const donationEvents = await contract.queryFilter(
            contract.filters.DonationMade(null, userAddress),
            filter.fromBlock,
            filter.toBlock,
          )

          // Get proposal events
          const proposalEvents = await contract.queryFilter(
            contract.filters.ProposalCreated(null, userAddress),
            filter.fromBlock,
            filter.toBlock,
          )

          // Get vote events
          const voteEvents = await contract.queryFilter(
            contract.filters.Voted(null, userAddress),
            filter.fromBlock,
            filter.toBlock,
          )

          // Get campaign payout events
          const payoutEvents = await contract.queryFilter(
            contract.filters.CampaignPaidOut(null, userAddress),
            filter.fromBlock,
            filter.toBlock,
          )

          // Get reputation update events
          const reputationEvents = await contract.queryFilter(
            contract.filters.ReputationUpdated(userAddress),
            filter.fromBlock,
            filter.toBlock,
          )

          // Get user campaigns first to filter other events
          const userCampaigns = await contract.getUserCampaigns(userAddress)
          const userCampaignIds = userCampaigns.map((id) => id.toString())

          // Get campaign status change events only for user's campaigns
          const statusChangeEvents = []
          for (const campaignId of userCampaignIds) {
            try {
              const events = await contract.queryFilter(
                contract.filters.CampaignStatusChanged(campaignId),
                filter.fromBlock,
                filter.toBlock,
              )
              statusChangeEvents.push(...events)
            } catch (err) {
              console.warn(`Error fetching status events for campaign ${campaignId}:`, err)
            }
          }

          // Get milestone update events only for user's campaigns
          const milestoneEvents = []
          for (const campaignId of userCampaignIds) {
            try {
              const events = await contract.queryFilter(
                contract.filters.MilestoneUpdated(campaignId),
                filter.fromBlock,
                filter.toBlock,
              )
              milestoneEvents.push(...events)
            } catch (err) {
              console.warn(`Error fetching milestone events for campaign ${campaignId}:`, err)
            }
          }

          // Process all events and get their timestamps from blocks
          const campaignCreatedActivities = await Promise.all(
            campaignCreatedEvents.map(async (event) => {
              const block = await event.getBlock()
              return {
                type: "CAMPAIGN_CREATED",
                title: "Created a new campaign",
                description: `Campaign "${event.args.title}" created`,
                timestamp: block.timestamp * 1000, // Convert from seconds to milliseconds
                metadata: {
                  campaignId: event.args.campaignId.toString(),
                  target: `${ethers.formatEther(event.args.target)} ETH`,
                },
              }
            }),
          )

          const donationActivities = await Promise.all(
            donationEvents.map(async (event) => {
              const block = await event.getBlock()
              return {
                type: "DONATION_MADE",
                title: "Made a donation",
                description: `Donated to campaign #${event.args.campaignId}`,
                timestamp: block.timestamp * 1000,
                metadata: {
                  amount: `${ethers.formatEther(event.args.amount)} ETH`,
                  campaignId: event.args.campaignId.toString(),
                  tokenId: event.args.tokenId.toString(),
                },
              }
            }),
          )

          const proposalActivities = proposalEvents.map((event) => ({
            type: "PROPOSAL_CREATED",
            title: "Created a proposal",
            description: event.args.description,
            timestamp: Number(event.args.createdAt) * 1000, // Using createdAt from the contract
            metadata: {
              proposalId: event.args.proposalId.toString(),
              campaignId: event.args.campaignId.toString(),
              endTime: new Date(Number(event.args.endTime) * 1000).toLocaleDateString(),
            },
          }))

          const voteActivities = await Promise.all(
            voteEvents.map(async (event) => {
              const block = await event.getBlock()
              return {
                type: "VOTE_CAST",
                title: "Voted on proposal",
                description: `Cast a ${event.args.support ? "supporting" : "opposing"} vote`,
                timestamp: block.timestamp * 1000,
                metadata: {
                  proposalId: event.args.proposalId.toString(),
                  weight: event.args.votes.toString(),
                },
              }
            }),
          )

          const payoutActivities = await Promise.all(
            payoutEvents.map(async (event) => {
              const block = await event.getBlock()
              return {
                type: "CAMPAIGN_PAID",
                title: "Campaign funds withdrawn",
                description: `Withdrew funds from campaign #${event.args.campaignId}`,
                timestamp: block.timestamp * 1000,
                metadata: {
                  campaignId: event.args.campaignId.toString(),
                  amount: `${ethers.formatEther(event.args.amount)} ETH`,
                },
              }
            }),
          )

          const reputationActivities = await Promise.all(
            reputationEvents.map(async (event) => {
              const block = await event.getBlock()
              return {
                type: "REPUTATION_UPDATED",
                title: "Reputation increased",
                description: "Your reputation score has increased",
                timestamp: block.timestamp * 1000,
                metadata: {
                  newScore: event.args.newScore.toString(),
                  newTier: event.args.newTier.toString(),
                },
              }
            }),
          )

          const statusChangeActivities = await Promise.all(
            statusChangeEvents.map(async (event) => {
              const block = await event.getBlock()
              return {
                type: "STATUS_CHANGED",
                title: "Campaign status changed",
                description: `Campaign #${event.args.campaignId} status updated to ${getStatusName(event.args.newStatus)}`,
                timestamp: block.timestamp * 1000,
                metadata: {
                  campaignId: event.args.campaignId.toString(),
                  status: getStatusName(event.args.newStatus),
                },
              }
            }),
          )

          const milestoneActivities = await Promise.all(
            milestoneEvents.map(async (event) => {
              const block = await event.getBlock()
              return {
                type: "MILESTONE_UPDATED",
                title: "Campaign milestone updated",
                description: `Updated milestone for campaign #${event.args.campaignId}`,
                timestamp: block.timestamp * 1000,
                metadata: {
                  campaignId: event.args.campaignId.toString(),
                  milestoneIndex: event.args.milestoneIndex.toString(),
                  newValue: ethers.formatEther(event.args.newValue) + " ETH",
                },
              }
            }),
          )

          // Combine all activities
          const allActivities = [
            ...campaignCreatedActivities,
            ...donationActivities,
            ...proposalActivities,
            ...voteActivities,
            ...payoutActivities,
            ...reputationActivities,
            ...statusChangeActivities,
            ...milestoneActivities,
          ]

          // Deduplicate activities
          const uniqueActivities = []
          const seen = new Set()

          allActivities.forEach((activity) => {
            // Create a unique key for each activity
            const key = `${activity.type}-${activity.metadata?.campaignId || ""}-${activity.metadata?.proposalId || ""}`

            if (!seen.has(key)) {
              seen.add(key)
              uniqueActivities.push(activity)
            }
          })

          // Sort by timestamp, most recent first
          return uniqueActivities.sort((a, b) => b.timestamp - a.timestamp)
        } catch (err) {
          console.error("Error fetching activities:", err)

          // Check for block range limit error
          if (err.message && err.message.includes("maximum [from, to] blocks distance")) {
            // Reduce the block range and try again
            const newOptions = {
              ...options,
              fromBlock: Math.max(fromBlock / 2, -9000), // Halve the range but keep it reasonable
            }
            console.log("Block range too large, reducing to:", newOptions.fromBlock)
            return getUserActivities(userAddress, newOptions)
          }

          // Implement retry logic for network errors
          if (retries < maxRetries && (err.code === "SERVER_ERROR" || err.message?.includes("502"))) {
            retries++
            console.log(`Retrying fetch (${retries}/${maxRetries}) after ${retryDelay}ms...`)
            await new Promise((resolve) => setTimeout(resolve, retryDelay))
            return fetchEvents() // Retry the fetch
          }

          setError("Error fetching activities: " + err.message)
          toast.error("Failed to load activities. Please try again later.")
          return []
        }
      }

      try {
        const activities = await fetchEvents()
        setLoading(false)
        return activities
      } catch (err) {
        setLoading(false)
        return []
      }
    },
    [contract],
  )

  // Helper function to convert status enum to readable string
  const getStatusName = (statusCode) => {
    const statuses = CAMPAIGN_STATUS
    return statuses[statusCode] || "Unknown"
  }

  return { getUserActivities, loading, error }
}

export default useGetUserActivities

