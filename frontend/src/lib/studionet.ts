import { createAccount, createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import type { AuditRecord, ContractConfig, PactRecord } from '../types';

export const STUDIONET_CHAIN_ID = 61999;
export const STUDIONET_CHAIN_HEX = '0xf22f';
export const STUDIONET_RPC_URL = 'https://studio.genlayer.com/api';
export const STUDIONET_EXPLORER_BASE = 'https://explorer-studio.genlayer.com';

const READ_ONLY_ACCOUNT = createAccount();

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getInjectedProvider(): Eip1193Provider | undefined {
  return (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
}

async function createInitializedClient(options?: {
  account?: string | ReturnType<typeof createAccount>;
  provider?: Eip1193Provider;
}) {
  const client = createClient({
    chain: studionet,
    endpoint: STUDIONET_RPC_URL,
    account: (options?.account ?? READ_ONLY_ACCOUNT) as `0x${string}`,
    ...(options?.provider ? { provider: options.provider as never } : {}),
  });
  await client.initializeConsensusSmartContract();
  return client;
}

export interface LiveStudioNetSnapshot {
  config: ContractConfig;
  pacts: PactRecord[];
  audits: AuditRecord[];
  fetchedAt: number;
}

export async function fetchLiveStudioNetState(
  contractAddress: string
): Promise<LiveStudioNetSnapshot> {
  const client = await createInitializedClient();
  const [configRaw, pactsRaw, auditsRaw] = await Promise.all([
    client.readContract({
      address: contractAddress as `0x${string}`,
      functionName: 'get_config',
      args: [],
    }),
    client.readContract({
      address: contractAddress as `0x${string}`,
      functionName: 'list_pacts',
      args: [],
    }),
    client.readContract({
      address: contractAddress as `0x${string}`,
      functionName: 'list_audits',
      args: [],
    }),
  ]);

  return {
    config: JSON.parse(String(configRaw)) as ContractConfig,
    pacts: JSON.parse(String(pactsRaw)) as PactRecord[],
    audits: JSON.parse(String(auditsRaw)) as AuditRecord[],
    fetchedAt: Date.now(),
  };
}

export async function fetchRefundableBalance(
  contractAddress: string,
  account: string
): Promise<number> {
  const client = await createInitializedClient();
  const raw = await client.readContract({
    address: contractAddress as `0x${string}`,
    functionName: 'get_refundable_balance',
    args: [account],
  });
  return Number(raw ?? 0);
}

export interface TxRpcStatus {
  status: string;
  resultName: string;
  executionResult: string;
}

export async function fetchTxStatus(txHash: string): Promise<TxRpcStatus> {
  const res = await fetch(STUDIONET_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getTransactionByHash',
      params: [txHash],
    }),
  });
  if (!res.ok) {
    throw new Error(`StudioNet RPC HTTP ${res.status}`);
  }
  const payload = await res.json();
  const tx = payload?.result;
  if (!tx) {
    return { status: 'SUBMITTED', resultName: '', executionResult: '' };
  }
  const leader = tx?.consensus_data?.leader_receipt?.[0];
  return {
    status: String(tx.status_name || tx.status || 'PENDING'),
    resultName: String(tx.result_name || ''),
    executionResult: String(leader?.execution_result || ''),
  };
}

export async function ensureStudioNetWallet(): Promise<string> {
  const eth = getInjectedProvider();
  if (!eth) {
    throw new Error('MetaMask (or an EIP-1193 wallet) was not detected in this browser.');
  }

  const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
  if (!accounts || accounts.length === 0) {
    throw new Error('No wallet account authorized.');
  }

  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: STUDIONET_CHAIN_HEX }],
    });
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 4902) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: STUDIONET_CHAIN_HEX,
            chainName: 'GenLayer StudioNet',
            rpcUrls: [STUDIONET_RPC_URL],
            nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
            blockExplorerUrls: [STUDIONET_EXPLORER_BASE],
          },
        ],
      });
    } else {
      throw err;
    }
  }

  return accounts[0];
}

export async function writeStudioNetContract(params: {
  account: string;
  contractAddress: string;
  functionName: string;
  args: unknown[];
  valueWei?: bigint;
}): Promise<string> {
  const eth = getInjectedProvider();
  if (!eth) {
    throw new Error('MetaMask (or an EIP-1193 wallet) was not detected in this browser.');
  }

  // Always await consensus main contract discovery before signing a write tx
  const client = await createInitializedClient({
    account: params.account,
    provider: eth,
  });

  const txHash = await client.writeContract({
    address: params.contractAddress as `0x${string}`,
    functionName: params.functionName,
    args: params.args as never[],
    value: params.valueWei ?? 0n,
  });

  return String(txHash);
}
