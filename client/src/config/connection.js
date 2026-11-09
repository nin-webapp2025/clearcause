import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { activeChain, IS_LOCAL_CHAIN } from "../constant/chain";

// 1. Get projectId
const configuredProjectId = import.meta.env.VITE_APP_APPKIT_PROJECT_ID?.trim();
const hasReownProjectId = Boolean(configuredProjectId && configuredProjectId !== "demo-local-project-id");
const projectId = hasReownProjectId ? configuredProjectId : "local-injected-wallets-only";

if (!hasReownProjectId && !IS_LOCAL_CHAIN) {
  console.warn("WalletConnect is disabled. Set VITE_APP_APPKIT_PROJECT_ID to enable it.");
}

// 2. Set the networks
// const networks = [crossFiTestnet, sepolia];

// 3. Create a metadata object - optional
const metadata = {
  name: "Transparent Charity DApp",
  description: "Transparent, fraud-aware charity donations on the blockchain",
  url: window.location.origin,
  icons: [],
};

// 4. Create a AppKit instance
export const appkit = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [activeChain],
  metadata,
  projectId,
  enableWalletConnect: hasReownProjectId,
  enableWalletGuide: hasReownProjectId,
  allowUnsupportedChain: false,
  allWallets: hasReownProjectId ? "SHOW" : "HIDE",
  defaultNetwork: activeChain,
  enableEIP6963: true,
  themeVariables: {
    '--w3m-color-mix': '#1c1917',
    '--w3m-color-mix-strength': 40,
    "--wcm-accent-color": "#4CAF50",  },
  themeMode: "dark",
  features: {
    analytics: false,
    allWallets: hasReownProjectId,
    email: false,
    socials: [],
  },
});
