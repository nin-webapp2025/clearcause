import { JsonRpcProvider } from "ethers";
import { RPC_URL } from "./chain";

export const readOnlyProvider = new JsonRpcProvider(RPC_URL);
