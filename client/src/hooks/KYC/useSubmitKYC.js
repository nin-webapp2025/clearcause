import { useState, useCallback } from "react"
import { toast } from "react-toastify"
import { useAppKitAccount } from "@reown/appkit/react"
import useContract from "../useContract"
import ABI from "../../abis/KYCManager.json"

const useSubmitKYC = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { address, isConnected } = useAppKitAccount()
  const contractAddress = import.meta.env.VITE_APP_KYC_MANAGER_ADDRESS
  const { contract } = useContract(contractAddress, ABI)

  const submitKYC = useCallback(
    async (proofHash) => {
      if (!address || !isConnected) throw new Error("Connect your wallet before submitting KYC.")
      if (!contract) throw new Error("The KYC contract is not ready. Check the configured address and network.")

      setLoading(true)
      setError(null)

      try {
        const tx = await contract.submitKYC(proofHash)
        const receipt = await tx.wait()

        if (receipt.status === 1) {
          toast.success("KYC submitted successfully!")
          return receipt.hash
        } else {
          throw new Error("Transaction failed")
        }
      } catch (err) {
        console.error("Error submitting KYC:", err)
        const message = err.shortMessage || err.reason || err.message || "KYC submission failed."
        toast.error(message)
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [address, isConnected, contract],
  )

  return { submitKYC, loading, error }
}

export default useSubmitKYC
