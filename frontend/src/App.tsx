import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Radio, CheckCircle2, AlertTriangle } from 'lucide-react';
import proofData from './data/proof.json';
import type { ActiveTab, AuditRecord, PactRecord, ProofManifest, QueuedTx } from './types';
import {
  fetchLiveStudioNetState,
  fetchTxStatus,
  STUDIONET_CHAIN_ID,
  STUDIONET_EXPLORER_BASE,
} from './lib/studionet';
import { shortAddr } from './lib/format';
import { PactLedger } from './components/PactLedger';
import { PactDesk } from './components/PactDesk';
import { StudioNetQueue } from './components/StudioNetQueue';

const PROOF = proofData as unknown as ProofManifest;
const QUEUE_STORAGE_KEY = 'release_pact_studionet_queue_v1';

function loadSavedQueue(): QueuedTx[] {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function App() {
  const [tab, setTab] = useState<ActiveTab>('ledger');
  const [pacts, setPacts] = useState<PactRecord[]>(PROOF.on_chain_state.pacts);
  const [audits, setAudits] = useState<AuditRecord[]>(PROOF.on_chain_state.audits);
  const [rpcState, setRpcState] = useState<{
    status: 'idle' | 'loading' | 'ok' | 'error';
    summary: string;
  }>({ status: 'idle', summary: '' });

  const [queue, setQueue] = useState<QueuedTx[]>(loadSavedQueue);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    } catch {
      // Ignore storage quota errors
    }
  }, [queue]);

  const handleVerifyLiveRpc = useCallback(async () => {
    setRpcState({ status: 'loading', summary: 'Querying StudioNet RPC…' });
    try {
      const snap = await fetchLiveStudioNetState(PROOF.contracts.release_pact.address);
      setPacts(snap.pacts);
      setAudits(snap.audits);
      setRpcState({
        status: 'ok',
        summary: `Live RPC Parity: ${snap.pacts.length} pacts · ${snap.audits.length} audits`,
      });
    } catch (err) {
      setRpcState({
        status: 'error',
        summary: err instanceof Error ? err.message : 'StudioNet RPC unreachable',
      });
    }
  }, []);

  const pollQueue = useCallback(async () => {
    if (queue.length === 0) return;
    setIsPolling(true);
    try {
      const updated = await Promise.all(
        queue.map(async (item) => {
          if (item.status === 'FINALIZED' && item.executionResult) {
            return item;
          }
          try {
            const st = await fetchTxStatus(item.hash);
            return {
              ...item,
              status: st.status || item.status,
              resultName: st.resultName || item.resultName,
              executionResult: st.executionResult || item.executionResult,
              lastCheckedAt: Date.now(),
            };
          } catch {
            return item;
          }
        })
      );
      setQueue(updated);
    } finally {
      setIsPolling(false);
    }
  }, [queue]);

  useEffect(() => {
    const hasPending = queue.some((q) => q.status !== 'FINALIZED');
    if (!hasPending) return;
    const id = window.setInterval(() => {
      void pollQueue();
    }, 7000);
    return () => window.clearInterval(id);
  }, [queue, pollQueue]);

  function handleLoadProofTxs() {
    const seeded: QueuedTx[] = [
      {
        hash: PROOF.contracts.evidence_probe.deploy_tx.tx_hash,
        label: 'Deploy EvidenceProbe',
        method: 'deploy_contract',
        submittedAt: Date.now(),
        status: PROOF.contracts.evidence_probe.deploy_tx.status || 'FINALIZED',
        resultName: PROOF.contracts.evidence_probe.deploy_tx.result_name || '',
        executionResult: PROOF.contracts.evidence_probe.deploy_tx.execution_result || 'SUCCESS',
        lastCheckedAt: Date.now(),
      },
      {
        hash: PROOF.contracts.release_pact.deploy_tx.tx_hash,
        label: 'Deploy ReleasePact',
        method: 'deploy_contract',
        submittedAt: Date.now(),
        status: PROOF.contracts.release_pact.deploy_tx.status || 'FINALIZED',
        resultName: PROOF.contracts.release_pact.deploy_tx.result_name || '',
        executionResult: PROOF.contracts.release_pact.deploy_tx.execution_result || 'SUCCESS',
        lastCheckedAt: Date.now(),
      },
      ...Object.entries(PROOF.transactions).map(([key, meta]) => ({
        hash: meta.tx_hash,
        label: key.replace(/_/g, ' '),
        method: meta.function || 'probe_url_slice',
        submittedAt: Date.now(),
        status: meta.status || 'FINALIZED',
        resultName: meta.result_name || '',
        executionResult: meta.execution_result || 'SUCCESS',
        lastCheckedAt: Date.now(),
      })),
    ];
    setQueue(seeded);
  }

  function handleTxSubmitted(tx: QueuedTx) {
    setQueue((prev) => [tx, ...prev.filter((p) => p.hash !== tx.hash)]);
    setTab('queue');
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#111315]">
      {/* Single-Row Sticky Swiss Topbar */}
      <header className="sticky top-0 z-30 border-b border-[#E4E4E0] bg-[#FFFFFF]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Release Pact emblem"
              className="h-7 w-7 shrink-0 rounded-md border border-[#E4E4E0]"
            />
            <span className="font-display text-base font-bold tracking-tight text-[#111315]">
              Release Pact
            </span>
            <span className="hidden rounded-full border border-[#E4E4E0] bg-[#FAFAF8] px-2 py-0.5 font-mono text-[11px] text-[#525860] sm:inline-block">
              StudioNet · {STUDIONET_CHAIN_ID}
            </span>
          </div>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {(
              [
                ['ledger', '01 · Pact Ledger'],
                ['desk', '02 · Pact Desk'],
                ['queue', '03 · StudioNet Queue'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === id
                    ? 'bg-[#111315] text-white'
                    : 'text-[#525860] hover:bg-[#F2F2EE] hover:text-[#111315]'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleVerifyLiveRpc}
              disabled={rpcState.status === 'loading'}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#E4E4E0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#111315] transition-colors hover:border-[#111315] disabled:opacity-60"
            >
              <Radio
                className={`h-3.5 w-3.5 ${
                  rpcState.status === 'ok'
                    ? 'text-[#047857]'
                    : rpcState.status === 'error'
                      ? 'text-[#C2410C]'
                      : 'text-[#3730A3]'
                }`}
              />
              <span className="hidden sm:inline">
                {rpcState.status === 'loading' ? 'Verifying…' : 'Verify Live RPC'}
              </span>
              <span className="sm:hidden">RPC</span>
            </button>
            <a
              href={`${STUDIONET_EXPLORER_BASE}/address/${PROOF.contracts.release_pact.address}`}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1 rounded-md border border-[#E4E4E0] bg-[#FAFAF8] px-2.5 py-1.5 font-mono text-[11px] text-[#525860] hover:border-[#B8B8B2] hover:text-[#111315] sm:inline-flex"
            >
              {shortAddr(PROOF.contracts.release_pact.address)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Mobile Tab Strip */}
        <div className="flex border-t border-[#EFEFEC] bg-white px-4 py-1.5 md:hidden">
          <div className="grid w-full grid-cols-3 gap-1">
            {(
              [
                ['ledger', '01 Ledger'],
                ['desk', '02 Desk'],
                ['queue', '03 Queue'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded py-1.5 text-center text-xs font-medium ${
                  tab === id ? 'bg-[#111315] text-white' : 'text-[#525860]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Compact Editorial Intro Header */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[#E4E4E0] pb-5">
          <div className="max-w-2xl">
            <div className="font-mono text-[11px] font-medium uppercase tracking-widest text-[#3730A3]">
              Multi-Tranche Feature-Release Escrow · GenLayer Intelligent Contract
            </div>
            <h1 className="mt-1.5 font-display text-2xl font-bold text-[#111315] sm:text-3xl">
              Milestone-gated open-source bounties, unlocked by commit-pinned release proof.
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#525860]">
              Sponsors lock GEN across ordered deliverables bound to an external repository prefix.
              GenLayer validators verify commit-pinned changelog slices under Optimistic Democracy;
              deterministic Python releases each tranche or refunds on expiry.
            </p>
          </div>

          {rpcState.status !== 'idle' && (
            <div
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs ${
                rpcState.status === 'ok'
                  ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]'
                  : rpcState.status === 'error'
                    ? 'border-[#FED7AA] bg-[#FFF7ED] text-[#C2410C]'
                    : 'border-[#E4E4E0] bg-white text-[#525860]'
              }`}
            >
              {rpcState.status === 'ok' ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              ) : rpcState.status === 'error' ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              ) : null}
              <span>{rpcState.summary}</span>
            </div>
          )}
        </div>

        {tab === 'ledger' && (
          <PactLedger
            pacts={pacts}
            audits={audits}
            proof={PROOF}
            isLiveSynced={rpcState.status === 'ok'}
          />
        )}
        {tab === 'desk' && (
          <PactDesk
            contractAddress={PROOF.contracts.release_pact.address}
            onTxSubmitted={handleTxSubmitted}
          />
        )}
        {tab === 'queue' && (
          <StudioNetQueue
            queue={queue}
            proof={PROOF}
            isPolling={isPolling}
            onRefreshNow={() => void pollQueue()}
            onLoadProofTxs={handleLoadProofTxs}
            onClearQueue={() => setQueue([])}
          />
        )}
      </main>

      <footer className="mt-12 border-t border-[#E4E4E0] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-[#6E747C] sm:px-6">
          <div className="font-mono">
            ReleasePact · {shortAddr(PROOF.contracts.release_pact.address)} · GenLayer StudioNet
          </div>
          <div className="flex items-center gap-4 font-mono">
            <span>EvidenceProbe · {shortAddr(PROOF.contracts.evidence_probe.address)}</span>
            <a
              href={`${STUDIONET_EXPLORER_BASE}/address/${PROOF.contracts.release_pact.address}`}
              target="_blank"
              rel="noreferrer"
              className="text-[#3730A3] hover:underline"
            >
              StudioNet Explorer
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
