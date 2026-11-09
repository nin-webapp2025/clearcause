import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import useContract from "../hooks/useContract";
import ClearCauseABI from "../abis/ClearCause.json";

const ClearCauseContext = createContext();

export const useClearCause = () => {
  const context = useContext(ClearCauseContext);
  if (!context) {
    throw new Error("useClearCause must be used within a ClearCauseProvider");
  }
  return context;
};

export const ClearCauseProvider = ({ children }) => {
  const [state, setState] = useState({
    campaigns: [],
    userCampaigns: [],
    loading: true,
  });

  const { address } = useAppKitAccount();
  const contractAddress = import.meta.env.VITE_APP_CONTRACT_ADDRESS;
  const { contract } = useContract(contractAddress, ClearCauseABI);

  const fetchCampaigns = useCallback(async () => {
    if (!contract) return;
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const campaignsData = await contract.getAllCampaigns();
      setState((prev) => ({ ...prev, campaigns: campaignsData, loading: false }));
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [contract]);

  const fetchUserCampaigns = useCallback(async () => {
    if (!contract || !address) return;
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const campaignIds = await contract.getUserCampaigns(address);
      const userCampaignsData = await Promise.all(
        campaignIds.map((id) => contract.getCampaign(id)),
      );
      setState((prev) => ({ ...prev, userCampaigns: userCampaignsData, loading: false }));
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [contract, address]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  useEffect(() => {
    if (address) {
      fetchUserCampaigns();
    }
  }, [fetchUserCampaigns, address]);

  const value = {
    ...state,
    fetchCampaigns,
    fetchUserCampaigns,
  };

  return <ClearCauseContext.Provider value={value}>{children}</ClearCauseContext.Provider>;
};

export default ClearCauseProvider;
