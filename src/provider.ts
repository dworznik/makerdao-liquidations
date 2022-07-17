import 'dotenv/config';
import { ethers } from 'ethers';

/**
 * Read a required RPC endpoint from the environment, failing fast with an
 * actionable message rather than letting ethers emit a cryptic connection error.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env and fill in your RPC endpoints.`);
  }
  return value;
}

export function rpcProvider(url: string): ethers.providers.Provider {
  return new ethers.providers.JsonRpcProvider(url);
}

export function wsProvider(url: string): ethers.providers.Provider {
  return new ethers.providers.WebSocketProvider(url);
}

// NOTE: the historical-state lookups in these scripts (vat.ilks/urns at a past
// blockTag) require an ARCHIVE node, not a regular full node.
export const infuraProvider = () => rpcProvider(requireEnv('MAINNET_RPC_URL'));
export const quickNodeProvider = () => rpcProvider(requireEnv('QUICKNODE_RPC_URL'));
export const chainNodesProvider = () => rpcProvider(requireEnv('CHAINNODES_RPC_URL'));

export const infuraWsProvider = () => wsProvider(requireEnv('MAINNET_WS_URL'));
export const quickNodeWsProvider = () => wsProvider(requireEnv('QUICKNODE_WS_URL'));
