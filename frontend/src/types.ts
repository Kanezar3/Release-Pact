export interface TrancheRecord {
  tranche_index: number;
  criterion: string;
  tranche_wei: number;
  status: 'OPEN' | 'DELIVERED_UNLOCKED' | 'EXPIRED_REFUNDED' | string;
  audit_attempts: number;
  winning_audit_id: string;
  builder: string;
}

export interface PactRecord {
  pact_id: string;
  sponsor: string;
  project_name: string;
  allowed_source_prefix: string;
  pact_sha256: string;
  total_deposit_wei: number;
  remaining_wei: number;
  refunded_wei: number;
  timeout_seconds: number;
  created_at: number;
  deadline_ts: number;
  tranches: TrancheRecord[];
  status:
    | 'OPEN'
    | 'PARTIALLY_DELIVERED'
    | 'FULLY_DELIVERED'
    | 'EXPIRED_SETTLED'
    | 'TOO_VAGUE'
    | 'REJECTED_INVALID'
    | string;
  verdict: string;
  reason: string;
}

export interface AuditRecord {
  audit_id: string;
  pact_id: string;
  tranche_index: number;
  builder: string;
  evidence_url: string;
  start_line: number;
  end_line: number;
  snippet_sha256: string;
  snippet_len: number;
  snippet_excerpt: string;
  verdict:
    | 'FEATURE_DELIVERED'
    | 'NOT_DELIVERED'
    | 'INSUFFICIENT_EVIDENCE'
    | 'UNVERIFIABLE_FETCH'
    | 'REJECTED_INVALID'
    | string;
  reason: string;
  quote: string;
  summary: string;
  stake_wei: number;
  payout_recipient: string;
  payout_wei: number;
  created_at: number;
  status: string;
}

export interface ContractConfig {
  owner: string;
  min_tranche_wei: number;
  min_stake_wei: number;
  default_timeout_seconds: number;
  max_tranches_per_pact: number;
  max_audit_attempts: number;
  pact_count: number;
  audit_count: number;
}

export interface TxMeta {
  tx_hash: string;
  explorer_url: string;
  status: string;
  result_name: string;
  execution_result: string;
  function?: string;
  value_wei?: number;
  account?: string;
  withdrawn_wei?: number;
  refundable_before_wei?: number;
  refundable_after_wei?: number;
  eoa_balance_before_wei?: string;
  eoa_balance_after_wei?: string;
}

export interface ProofManifest {
  project: string;
  generated_at_utc: string;
  network: {
    name: string;
    chain_id: number;
    rpc_url: string;
    explorer_base: string;
  };
  accounts: {
    sponsor: string;
    builder: string;
  };
  contracts: {
    evidence_probe: {
      address: string;
      explorer_url: string;
      deploy_tx: TxMeta;
    };
    release_pact: {
      address: string;
      explorer_url: string;
      deploy_tx: TxMeta;
    };
  };
  transactions: Record<string, TxMeta>;
  on_chain_state: {
    evidence_probe: {
      url?: string;
      status_code?: number;
      ok?: boolean;
      start_line?: number;
      end_line?: number;
      snippet_len?: number;
      snippet_sha256?: string;
      snippet?: string;
    };
    config: ContractConfig;
    pacts: PactRecord[];
    audits: AuditRecord[];
    post_withdraw_refundable_balances: {
      sponsor_wei: number;
      builder_wei: number;
    };
  };
}

export interface QueuedTx {
  hash: string;
  label: string;
  method: string;
  submittedAt: number;
  status: string;
  resultName: string;
  executionResult: string;
  lastCheckedAt: number;
}

export type ActiveTab = 'ledger' | 'desk' | 'queue';
