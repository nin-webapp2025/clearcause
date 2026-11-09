"use client"

import { useState, useEffect, useCallback } from "react"
import { ethers } from "ethers"
import useContract from "../useContract"
import ClearCauseABI from "../../abis/ClearCause.json"
import { DEPLOY_BLOCK } from "../../constant/chain"

/**
 * Reads the DonationMade events for one campaign straight from the chain.
 * Every donation comes with its transaction hash so anyone can verify it
 * on the block explorer. Newest donation first.
 */
const useGetDonations = (campaignId) => {
  const [donations, setDonations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const contractAddress = import.meta.env.VITE_APP_CONTRACT_ADDRESS
  const { contract } = useContract(contractAddress, ClearCauseABI)

  const refresh = useCallback(async () => {
    if (!contract || campaignId === undefined || campaignId === null || Number.isNaN(campaignId)) return
    setLoading(true)
    setError(null)
    try {
      const events = await contract.queryFilter(contract.filters.DonationMade(campaignId), DEPLOY_BLOCK)
      const rows = events.map((ev) => ({
        donor: ev.args.donator,
        amount: ethers.formatEther(ev.args.amount),
        tokenId: ev.args.tokenId.toString(),
        txHash: ev.transactionHash,
        blockNumber: ev.blockNumber,
      }))
      rows.sort((a, b) => b.blockNumber - a.blockNumber)
      setDonations(rows)
    } catch (err) {
      console.error("Could not load donation history:", err)
      setError("Could not load donation history")
    } finally {
      setLoading(false)
    }
  }, [contract, campaignId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { donations, loading, error, refresh }
}

export default useGetDonations
