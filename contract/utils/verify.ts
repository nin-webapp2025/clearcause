import { run } from "hardhat";

export async function verify(contractAddress: string, constructorArguments: any[]) {
  console.log(`Verifying contract at ${contractAddress}...`);
  
  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: constructorArguments,
    });
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("Contract is already verified!");
    } else {
      throw error;
    }
  }
} 