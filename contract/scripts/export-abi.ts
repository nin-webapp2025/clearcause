import { exportAbis } from "./deploy";

// Copies the compiled ABIs into the React client without deploying anything.
// Usage: npx hardhat run scripts/export-abi.ts
exportAbis().catch((e) => {
  console.error(e);
  process.exit(1);
});
