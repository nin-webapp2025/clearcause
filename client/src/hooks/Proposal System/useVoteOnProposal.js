"use client"

import { useState, useCallback } from "react"
import { toast } from "react-toastify"
import { useAppKitAccount } from "@reown/appkit/react"
import useSignerOrProvider from "../useSignerOrProvider"
import useContract from "../useContract"
import ClearCauseABI from "../../abis/ClearCause.json"
import { findEvent, withRevertName } from "../../lib/receiptEvents"

// Error mapping for known error messages
const ERROR_MESSAGES = {
  AlreadyVoted: "You have already voted on this proposal",
  ProposalNotFound: "This proposal does not exist",
  Unauthorized: "You are not authorized to vote",
  DeadlinePassed: "The voting period has ended",
  "execution reverted": "Transaction failed - you may not have enough voting power",
  "user rejected transaction": "You rejected the transaction",
}

// Function to get human readable error message
const getReadableError = (error) => {
  // Check if it's a known contract error
  for (const [key, message] of Object.entries(ERROR_MESSAGES)) {
    if (error.message?.includes(key)) {
      return message
    }
  }

  if (error.code) {
    switch (error.code) {
      case 4001:
        return "You rejected the transaction"
      case -32603:
        if (error.message?.includes("insufficient funds")) {
          return "You don't have enough funds to complete this transaction"
        }
        break
      case "ACTION_REJECTED":
        return "You rejected the transaction"
    }
  }

  // Check for specific error messages in the error object
  if (error.reason) return error.reason
  if (error.data?.message) return error.data.message
  if (error.message) {
    // Clean up common blockchain error messages
    const message = error.message
      .replace("execution reverted:", "")
      .replace("MetaMask Tx Signature:", "")
      .replace("Error:", "")
      .trim()

    return message.charAt(0).toUpperCase() + message.slice(1)
  }

  return "An unexpected error occurred. Please try again."
}

const useVoteOnProposal = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { address, isConnected } = useAppKitAccount()
  const { signer } = useSignerOrProvider()
  const contractAddress = import.meta.env.VITE_APP_CONTRACT_ADDRESS
  const { contract } = useContract(contractAddress, ClearCauseABI)

  const voteOnProposal = useCallback(
    async (proposalId, support) => {
      if (!address || !isConnected) {
        const message = "Please connect your wallet"
        setError(message)
        toast.error(message)
        return { success: false }
      }

      if (!signer || !contract) {
        const message = "Contract or signer is not available"
        setError(message)
        // toast.error(message)
        return { success: false }
      }

      setLoading(true)
      setError(null)

      try {
        // First check if user can vote
        const proposal = await contract.proposals(proposalId)
        const now = Math.floor(Date.now() / 1000)

        if (!proposal || proposal.id.toString() === "0") {
          throw new Error("ProposalNotFound")
        }

        const hasVoted = await contract.hasVoted(address, proposalId)
        if (hasVoted) {
          throw new Error("AlreadyVoted")
        }

        if (proposal.executed) {
          throw new Error("Proposal has already been executed")
        }

        if (now > proposal.endTime) {
          throw new Error("DeadlinePassed")
        }

        // If all checks pass, cast the vote
        const tx = await contract.voteOnProposal(proposalId, support, {
          gasLimit: 300000, // Add a gas limit to prevent unexpected reverts
        })

        // Wait for the transaction to be mined
        const receipt = await tx.wait()

        if (receipt.status === 1) {
          // Find the Voted event
          const event = findEvent(receipt, contract, "Voted")
          const votes = event?.args?.votes

          toast.success("Vote cast successfully!")
          return {
            success: true,
            votes: votes?.toString(),
            support,
          }
        } else {
          throw new Error("Transaction failed")
        }
      } catch (err) {
        withRevertName(err, contract)
        console.error("Transaction error:", err)
        const readableError = getReadableError(err)
        setError(readableError)
        toast.error(readableError)
        return { success: false, error: readableError }
      } finally {
        setLoading(false)
      }
    },
    [address, isConnected, signer, contract],
  )

  return { voteOnProposal, loading, error }
}

export default useVoteOnProposal

