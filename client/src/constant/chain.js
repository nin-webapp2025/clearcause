import { defineChain } from "@reown/appkit/networks";

// Which network the app talks to. Set VITE_APP_CHAIN=localhost to test against
// `npx hardhat node`; anything else (or nothing) means Sepolia.
export const IS_LOCAL_CHAIN = import.meta.env.VITE_APP_CHAIN === "localhost";

// The unlocked Hardhat account is an explicit local-development convenience.
// Even a mistakenly copied production environment cannot enable it off localhost.
export const ENABLE_DEMO_WALLET =
  IS_LOCAL_CHAIN && import.meta.env.VITE_ENABLE_DEMO_WALLET === "true";

export const CURRENCY_SYMBOL = "ETH";

// Block the contract was deployed in. Event queries start here so public RPC
// providers do not reject a scan from block 0. The deploy script prints it.
export const DEPLOY_BLOCK = Number(import.meta.env.VITE_APP_DEPLOY_BLOCK || 0);

export const RPC_URL = IS_LOCAL_CHAIN
  ? import.meta.env.VITE_APP_RPC_URL || "http://127.0.0.1:8545"
  : import.meta.env.VITE_APP_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

// No block explorer exists for the local chain, so links are disabled there.
export const EXPLORER_URL = IS_LOCAL_CHAIN
  ? ""
  : (import.meta.env.VITE_APP_EXPLORER_URL || "https://sepolia.etherscan.io").replace(/\/$/, "");

export const activeChain = IS_LOCAL_CHAIN
  ? defineChain({
      id: 31337,
      caipNetworkId: "eip155:31337",
      chainNamespace: "eip155",
      name: "Hardhat Local",
      nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
      rpcUrls: { default: { http: [RPC_URL] } },
    })
  : defineChain({
      id: 11155111,
      caipNetworkId: "eip155:11155111",
      chainNamespace: "eip155",
      name: "Sepolia",
      nativeCurrency: { decimals: 18, name: "Sepolia Ether", symbol: "ETH" },
      rpcUrls: { default: { http: [RPC_URL] } },
      blockExplorers: { default: { name: "Etherscan", url: EXPLORER_URL } },
      testnet: true,
    });

/** Link to a transaction on the block explorer, or null if there is none. */
export const txUrl = (hash) => (EXPLORER_URL && hash ? `${EXPLORER_URL}/tx/${hash}` : null);

/** Link to an address on the block explorer, or null if there is none. */
export const addressUrl = (addr) => (EXPLORER_URL && addr ? `${EXPLORER_URL}/address/${addr}` : null);

export const shortHash = (hash) => (hash ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : "");
