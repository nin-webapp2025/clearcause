import { useEffect, useState } from "react"
import { useAppKitAccount } from "@reown/appkit/react"
import useContract from "../useContract"
import ABI from "../../abis/KYCManager.json"

const useIsKYCOwner = () => {
  const { address, isConnected } = useAppKitAccount()
  const { contract } = useContract(import.meta.env.VITE_APP_KYC_MANAGER_ADDRESS, ABI)
  const [isKYCOwner, setIsKYCOwner] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    const checkOwner = async () => {
      if (!isConnected || !address || !contract) {
        if (!cancelled) {
          setIsKYCOwner(false)
          setChecking(false)
        }
        return
      }
      setChecking(true)
      try {
        const owner = await contract.owner()
        if (!cancelled) setIsKYCOwner(owner.toLowerCase() === address.toLowerCase())
      } catch (error) {
        console.error("KYC owner check failed:", error)
        if (!cancelled) setIsKYCOwner(false)
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    checkOwner()
    return () => { cancelled = true }
  }, [address, contract, isConnected])

  return { isKYCOwner, checking }
}

export default useIsKYCOwner
