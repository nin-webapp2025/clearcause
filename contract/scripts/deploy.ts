import { ethers, network, artifacts } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { verify } from "../utils/verify";

/**
 * Deploys KYCManager and ClearCause, then:
 *  - saves the addresses to deployments/<network>.json
 *  - copies the ABIs into the React client (client/src/abis)
 *  - prints the lines to paste into client/.env
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network localhost
 *   npx hardhat run scripts/deploy.ts --network sepolia
 *
 * QUORUM_VOTES (optional): votes needed for a governance proposal to pass.
 * One vote = one donation receipt NFT held, so keep this a small whole number.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const quorumVotes = BigInt(process.env.QUORUM_VOTES ?? "3");
  const onLiveNetwork = !["hardhat", "localhost"].includes(network.name);
  const confirmations = onLiveNetwork ? 2 : 1;

  console.log(`Network:  ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance:  ${ethers.formatEther(balance)} ETH`);
  if (balance === 0n) {
    throw new Error("Deployer has no ETH. Get Sepolia test ETH from a faucet first.");
  }

  console.log("\nDeploying KYCManager...");
  const kycManager = await (await ethers.getContractFactory("KYCManager")).deploy();
  await kycManager.deploymentTransaction()?.wait(confirmations);
  const kycManagerAddress = await kycManager.getAddress();
  console.log("KYCManager:", kycManagerAddress);

  console.log("Deploying ClearCause...");
  const clearCause = await (await ethers.getContractFactory("ClearCause")).deploy(
    kycManagerAddress,
    quorumVotes
  );
  await clearCause.deploymentTransaction()?.wait(confirmations);
  const contractAddress = await clearCause.getAddress();
  console.log("ClearCause:    ", contractAddress);

  // Save addresses
  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const record = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    kycManager: kycManagerAddress,
    clearCause: contractAddress,
    quorumVotes: quorumVotes.toString(),
    deployedAt: new Date().toISOString(),
    clearCauseTxHash: clearCause.deploymentTransaction()?.hash,
    deployBlock: (await clearCause.deploymentTransaction()?.wait())?.blockNumber,
  };
  fs.writeFileSync(path.join(outDir, `${network.name}.json`), JSON.stringify(record, null, 2));

  // Copy ABIs to the client
  await exportAbis();

  if (onLiveNetwork && process.env.ETHERSCAN_API_KEY) {
    console.log("\nVerifying on Etherscan...");
    try {
      await verify(kycManagerAddress, []);
      await verify(contractAddress, [kycManagerAddress, quorumVotes]);
    } catch (e) {
      console.error("Verification failed (you can retry later):", e);
    }
  }

  console.log("\nAdd these to client/.env:");
  console.log(`VITE_APP_KYC_MANAGER_ADDRESS=${kycManagerAddress}`);
  console.log(`VITE_APP_CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`VITE_APP_DEPLOY_BLOCK=${record.deployBlock}`);
  console.log(
    "\nThe deployer wallet is the contract admin AND the KYC owner. Keep that wallet safe."
  );
}

export async function exportAbis() {
  const clientAbis = path.join(__dirname, "..", "..", "client", "src", "abis");
  if (!fs.existsSync(clientAbis)) return;
  for (const name of ["ClearCause", "KYCManager"]) {
    const { abi } = await artifacts.readArtifact(name);
    fs.writeFileSync(path.join(clientAbis, `${name}.json`), JSON.stringify(abi, null, 2));
  }
  console.log("ABIs copied to client/src/abis");
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Deployment failed:", error);
      process.exit(1);
    });
}
