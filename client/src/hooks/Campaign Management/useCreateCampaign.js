"use client"

import { useState, useCallback } from "react"
import { toast } from "react-toastify"
import { ethers } from "ethers"
import { useAppKitAccount } from "@reown/appkit/react"
import useSignerOrProvider from "../useSignerOrProvider"
import useContract from "../useContract"
import ClearCauseABI from "../../abis/ClearCause.json"
import { findEvent, withRevertName } from "../../lib/receiptEvents"

const useCreateCampaign = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { address, isConnected } = useAppKitAccount()
  const { signer } = useSignerOrProvider()
  const contractAddress = import.meta.env.VITE_APP_CONTRACT_ADDRESS
  const { contract } = useContract(contractAddress, ClearCauseABI)

  const createCampaign = useCallback(
    async (title, description, target, deadline, image, milestones, payoutAddress) => {
      if (!address || !isConnected) {
        const message = "Please connect your wallet"
        setError(message)
        toast.error(message)
        return { success: false }
      }

      if (!signer || !contract) {
        const message = "Contract or signer is not available"
        setError(message)
        toast.error(message)
        return { success: false }
      }

      setLoading(true)
      setError(null)

      try {
        // Convert milestones to wei
        const milestonesInWei = milestones.map((milestone) => ethers.parseEther(milestone.toString()))
        
        // Prepare transaction options with explicit gas settings
        const options = {
          gasLimit: 1000000, // Set a higher gas limit to ensure transaction goes through
        }
        
        // Try to estimate gas first to check if the transaction will fail
        try {
          const gasEstimate = await contract.createCampaign.estimateGas(
            title,
            description,
            ethers.parseEther(target.toString()),
            Math.floor(new Date(deadline).getTime() / 1000),
            image,
            milestonesInWei
          )
          
          // Add 20% buffer to gas estimate
          options.gasLimit = Math.floor(gasEstimate.toString() * 1.2)
          console.log("Estimated gas with buffer:", options.gasLimit)
        } catch (estimateError) {
          console.warn("Gas estimation failed, using default limit:", options.gasLimit)
          console.error("Gas estimation error:", estimateError)
          // Continue with default gas limit
        }

        console.log("Sending transaction with options:", options)
        console.log("Transaction data:", {
          title,
          description,
          target: ethers.parseEther(target.toString()),
          deadline: Math.floor(new Date(deadline).getTime() / 1000),
          image,
          milestones: milestonesInWei
        })

        const tx = await contract.createCampaign(
          title,
          description,
          ethers.parseEther(target.toString()),
          Math.floor(new Date(deadline).getTime() / 1000),
          image,
          milestonesInWei,
          options
        )

        console.log("Transaction sent:", tx.hash)
        toast.info("Transaction submitted! Waiting for confirmation...")

        const receipt = await tx.wait()
        console.log("Transaction receipt:", receipt)

        if (receipt.status === 1) {
          // Find the CampaignCreated event to get the campaign ID
          const event = findEvent(receipt, contract, "CampaignCreated")
          const campaignId = event?.args?.campaignId?.toString()

          toast.success("Campaign created. It must be approved by an admin before it can receive donations.")

          // Optional second transaction: pay out to a different address than the creator's wallet.
          // The admin sees this address during review, and it is locked after approval.
          let payoutSet = false
          if (
            payoutAddress &&
            campaignId !== undefined &&
            payoutAddress.toLowerCase() !== address.toLowerCase()
          ) {
            try {
              toast.info("Now confirm the second transaction to set the payout address...")
              const payoutTx = await contract.setPayoutAddress(campaignId, payoutAddress)
              await payoutTx.wait()
              payoutSet = true
            } catch (payoutErr) {
              console.error("Setting payout address failed:", payoutErr)
              toast.warning(
                "Campaign created, but the payout address was not saved. Funds will go to your own wallet unless you set it from the campaign page before approval.",
              )
            }
          }

          return { success: true, campaignId, txHash: tx.hash, payoutSet }
        } else {
          throw new Error("Transaction failed")
        }
      } catch (err) {
        withRevertName(err, contract)
        console.error("Transaction error:", err)
        let message

        // Contract reverts can arrive with RPC code -32603, so inspect the
        // custom error name before treating that code as a network failure.
        if (err.message?.includes("InvalidAmount")) {
          message = "Target amount is too low. Minimum is 0.1 ETH."
        } else if (err.message?.includes("DeadlinePassed")) {
          message = "Deadline must be in the future."
        } else if (err.message?.includes("InvalidDuration")) {
          message = "Campaign duration must be between 1 and 90 days."
        } else if (err.message?.includes("InvalidMilestoneCount")) {
          message = "Too many milestones. Maximum is 10."
        } else if (err.message?.includes("InvalidKYC")) {
          message = "Your wallet must be KYC verified before it can create a campaign."
        } else if (err.message?.includes("user rejected")) {
          message = "Transaction was rejected by the user."
        } else if (err.code === "ACTION_REJECTED") {
          message = "Transaction was rejected by the user."
        } else if (err.message?.includes("insufficient funds")) {
          message = "Insufficient funds to complete this transaction."
        } else if (err.message?.includes("eth_gasPrice") || err.code === -32603) {
          message = "The transaction could not be processed by the connected network."
        } else {
          message = "The campaign could not be created. Please check the form and try again."
        }

        setError(message)
        toast.error(message)
        return { success: false, error: message }
      } finally {
        setLoading(false)
      }
    },
    [address, isConnected, signer, contract],
  )

  return { createCampaign, loading, error }
}

export default useCreateCampaign
