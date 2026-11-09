"use client"

import { useEffect, useState } from "react"
import { useAppKitAccount } from "@reown/appkit/react"
import useContract from "../useContract"
import ClearCauseABI from "../../abis/ClearCause.json"
import { DEPLOY_BLOCK } from "../../constant/chain"

/** True if the connected wallet already claimed its refund for this campaign (read from RefundClaimed events). */
const useHasClaimedRefund = (campaignId) => {
  const { address } = useAppKitAccount()
  const contractAddress = import.meta.env.VITE_APP_CONTRACT_ADDRESS
  const { contract } = useContract(contractAddress, ClearCauseABI)
  const [claimed, setClaimed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      if (!contract || !address || Number.isNaN(campaignId)) {
        setClaimed(false)
        return
      }
      try {
        const events = await contract.queryFilter(contract.filters.RefundClaimed(campaignId, address), DEPLOY_BLOCK)
        if (!cancelled) setClaimed(events.length > 0)
      } catch (err) {
        console.warn("Could not check refund status:", err)
      }
    }
    check()
    return () => {
      cancelled = true
    }
  }, [contract, address, campaignId])

  return claimed
}

export default useHasClaimedRefund
