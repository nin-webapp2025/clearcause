"use client"

import { useState, useCallback } from "react"
import { toast } from "react-toastify"
import { useAppKitAccount } from "@reown/appkit/react"
import useSignerOrProvider from "../useSignerOrProvider"
import useContract from "../useContract"
import ClearCauseABI from "../../abis/ClearCause.json"
import { withRevertName } from "../../lib/receiptEvents"

const friendlyError = (err) => {
  const name = err?.revert?.name || ""
  const text = `${name} ${err?.shortMessage || ""} ${err?.message || ""}`
  if (err?.code === "ACTION_REJECTED" || /user rejected/i.test(text)) return "Transaction was rejected in the wallet."
  if (/AccessControlUnauthorizedAccount/.test(text)) return "This wallet does not have the admin role."
  if (/InvalidStatus/.test(text)) return "The campaign is not in a state that allows this action."
  if (/DeadlinePassed/.test(text)) return "The campaign deadline has already passed, so it can no longer be approved."
  if (/EnforcedPause/.test(text)) return "The contract is paused."
  if (/insufficient funds/i.test(text)) return "Insufficient funds for gas."
  return err?.shortMessage || err?.message || "Unknown error"
}

/** Admin-only actions: approve, reject and suspend campaigns. */
const useCampaignReview = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { address, isConnected } = useAppKitAccount()
  const { signer } = useSignerOrProvider()
  const contractAddress = import.meta.env.VITE_APP_CONTRACT_ADDRESS
  const { contract } = useContract(contractAddress, ClearCauseABI)

  const run = useCallback(
    async (label, send) => {
      if (!address || !isConnected) {
        toast.error("Please connect your wallet")
        return { success: false }
      }
      if (!signer || !contract) {
        toast.error("Wallet or contract not ready yet")
        return { success: false }
      }

      setLoading(true)
      setError(null)
      try {
        const tx = await send(contract)
        toast.info(`${label}: transaction submitted, waiting for confirmation...`)
        const receipt = await tx.wait()
        if (receipt.status !== 1) throw new Error("Transaction failed")
        toast.success(`${label}: confirmed`)
        return { success: true, txHash: tx.hash }
      } catch (err) {
        withRevertName(err, contract)
        console.error(`${label} error:`, err)
        const message = friendlyError(err)
        setError(message)
        toast.error(message)
        return { success: false, error: message }
      } finally {
        setLoading(false)
      }
    },
    [address, isConnected, signer, contract],
  )

  const approveCampaign = useCallback((id) => run("Approve", (c) => c.approveCampaign(id)), [run])
  const rejectCampaign = useCallback((id, reason) => run("Reject", (c) => c.rejectCampaign(id, reason)), [run])
  const suspendCampaign = useCallback((id, reason) => run("Suspend", (c) => c.suspendCampaign(id, reason)), [run])

  return { approveCampaign, rejectCampaign, suspendCampaign, loading, error }
}

export default useCampaignReview
