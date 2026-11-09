"use client"

import { useEffect, useState } from "react"
import { ethers } from "ethers"
import { useAppKitAccount } from "@reown/appkit/react"
import useContract from "../useContract"
import ClearCauseABI from "../../abis/ClearCause.json"

// Same value as `keccak256("ADMIN_ROLE")` in ClearCause.sol
const ADMIN_ROLE = ethers.id("ADMIN_ROLE")

/** True when the connected wallet holds ADMIN_ROLE on the ClearCause contract. */
const useIsAdmin = () => {
  const { address, isConnected } = useAppKitAccount()
  const contractAddress = import.meta.env.VITE_APP_CONTRACT_ADDRESS
  const { contract } = useContract(contractAddress, ClearCauseABI)
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      if (!isConnected || !address || !contract) {
        setIsAdmin(false)
        setChecking(!contract && isConnected)
        return
      }
      setChecking(true)
      try {
        const result = await contract.hasRole(ADMIN_ROLE, address)
        if (!cancelled) setIsAdmin(Boolean(result))
      } catch (err) {
        console.error("Admin role check failed:", err)
        if (!cancelled) setIsAdmin(false)
      } finally {
        if (!cancelled) setChecking(false)
      }
    }

    check()
    return () => {
      cancelled = true
    }
  }, [address, isConnected, contract])

  return { isAdmin, checking }
}

export default useIsAdmin
