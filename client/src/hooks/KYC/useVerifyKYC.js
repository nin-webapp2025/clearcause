import { useState, useCallback } from "react"
import { toast } from "react-toastify"
import { useAppKitAccount } from "@reown/appkit/react"
import useContract from "../useContract"
import ABI from "../../abis/KYCManager.json"

const useVerifyKYC = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { address, isConnected } = useAppKitAccount()
  const contractAddress = import.meta.env.VITE_APP_KYC_MANAGER_ADDRESS
  const { contract } = useContract(contractAddress, ABI)

  const verifyKYC = useCallback(
    async (userAddress, status) => {
      if (!address || !isConnected) throw new Error("Connect the KYC administrator wallet first.")
      if (!contract) throw new Error("The KYC contract is not ready. Check the configured address and network.")

      setLoading(true)
      setError(null)

      try {
        const owner = await contract.owner()
        if (owner.toLowerCase() !== address.toLowerCase()) {
          throw new Error("Only the KYC contract owner can approve or reject submissions.")
        }
        const tx = await contract.verifyKYC(userAddress, status)
        const receipt = await tx.wait()

        if (receipt.status === 1) {
          toast.success(`KYC ${status ? "approved" : "rejected"} successfully.`)
          return receipt.hash
        } else {
          throw new Error("Transaction failed")
        }
      } catch (err) {
        console.error("Error verifying KYC:", err)
        const message = err.shortMessage || err.reason || err.message || "KYC verification failed."
        toast.error(message)
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [address, isConnected, contract],
  )

  return { verifyKYC, loading, error }
}

export default useVerifyKYC
