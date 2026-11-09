import { useState, useCallback } from "react"
import useContract from "../useContract"
import ABI from "../../abis/KYCManager.json"

const useGetPendingVerifications = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const contractAddress = import.meta.env.VITE_APP_KYC_MANAGER_ADDRESS
  const { contract } = useContract(contractAddress, ABI)

  const getPendingVerifications = useCallback(async () => {
    if (!contract) return []
  
    setLoading(true);
    setError(null);
  
    try {
      console.log("Calling getPendingVerifications() from contract...");
      const pendingVerifications = await contract.getPendingVerifications();
      console.log("getPendingVerifications response:", pendingVerifications);
      return pendingVerifications;
    } catch (err) {
      console.error("Error getting pending verifications:", err);
      // toast.error(`Error: ${err.message || "An unknown error occurred."}`);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [contract]);
  

  return { getPendingVerifications, loading, error }
}

export default useGetPendingVerifications
