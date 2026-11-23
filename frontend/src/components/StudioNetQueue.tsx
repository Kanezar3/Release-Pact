import { ExternalLink, RefreshCw, Database, Trash2, Shield } from 'lucide-react';
import type { ProofManifest, QueuedTx } from '../types';
import {
  classifyTxState,
  consensusStageIndex,
  PIPELINE_STAGES,
  shortHash,
} from '../lib/format';
import { STUDIONET_EXPLORER_BASE } from '../lib/studionet';
import { StatusBadge } from './StatusBadge';

interface StudioNetQueueProps {
  queue: QueuedTx[];
  proof: ProofManifest;
  isPolling: boolean;
  onRefreshNow: () => void;
  onLoadProofTxs: () => void;
  onClearQueue: () => void;
}

export function StudioNetQueue({
  queue,
  proof,
  isPolling,
  onRefreshNow,
  onLoadProofTxs,
  onClearQueue,
}: StudioNetQueueProps) {
  const totalProofTxs = 2 + Object.keys(proof.transactions).length;

  return (
    <div className="space-y-5">
      <section className="ledger-sheet rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-[#111315]">
              GenLayer Optimistic Democracy &amp; Appeal Window Queue
            </h2>
            <p className="mt-0.5 text-xs text-[#525860]">
              Resumable 7-second StudioNet poller tracking Submitted → Pending → Proposing →
              Accepted (Appeal Window) → Finalized (Success or Error).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onLoadProofTxs}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#111315] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#262A2E]"
            >
              <Database className="h-3.5 w-3.5" />
              Load {totalProofTxs} Finalized Proof Txs
            </button>
            <button
              type="button"
              onClick={onRefreshNow}
              disabled={isPolling || queue.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#E4E4E0] bg-white px-3 py-1.5 text-xs font-medium text-[#111315] hover:border-[#B8B8B2] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isPolling ? 'animate-spin' : ''}`} />
              Poll RPC Now
            </button>
            {queue.length > 0 && (
              <button
                type="button"
                onClick={onClearQueue}
                className="inline-flex items-center gap-1 rounded-md border border-[#E4E4E0] bg-white px-2.5 py-1.5 text-xs text-[#6E747C] hover:border-[#C2410C] hover:text-[#C2410C]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="mt-3.5 flex items-start gap-2 rounded-md border border-[#C7D2FE] bg-[#EEF2FF]/70 px-3.5 py-2.5 text-xs text-[#312E81]">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#3730A3]" />
          <span>
            <strong>Native Appeal Window:</strong> Release Pact relies on GenLayer&apos;s native
            protocol appeal window between <strong>ACCEPTED</strong> and <strong>FINALIZED</strong>{' '}
            rather than a custom court. External EOA payouts via{' '}
            <code className="font-mono">emit_transfer</code> settle strictly upon finalization.
          </span>
        </div>
      </section>

      {queue.length === 0 ? (
        <section className="ledger-sheet-muted rounded-lg p-8 text-center">
          <p className="text-sm font-medium text-[#111315]">No transactions in queue yet.</p>
          <p className="mt-1 text-xs text-[#525860]">
            Click <strong>Load {totalProofTxs} Finalized Proof Txs</strong> above to inspect every
            recorded StudioNet transaction, or submit a live write in <strong>02 · Pact Desk</strong>.
          </p>
        </section>
      ) : (
        <div className="space-y-3">
          {queue.map((tx) => {
            const stageIdx = consensusStageIndex(tx.status);
            const terminalState = classifyTxState(tx.status, tx.executionResult);
            const isFinalError = terminalState === 'FINALIZED_ERROR';

            return (
              <article key={tx.hash} className="ledger-sheet rounded-lg p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-semibold text-[#111315]">
                        {tx.label}
                      </span>
                      <span className="rounded bg-[#F3F3EF] px-2 py-0.5 font-mono text-[11px] text-[#525860]">
                        {tx.method}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-[#6E747C]">
                      <span>{shortHash(tx.hash, 12, 8)}</span>
                      <a
                        href={`${STUDIONET_EXPLORER_BASE}/tx/${tx.hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[#3730A3] hover:underline"
                      >
                        Explorer
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge value={terminalState} compact />
                    {tx.resultName && (
                      <span className="rounded bg-[#F3F3EF] px-2 py-0.5 font-mono text-[10px] text-[#525860]">
                        {tx.resultName}
                      </span>
                    )}
                  </div>
                </div>

                {/* 5-Stage Consensus & Appeal Window Bar */}
                <div className="mt-4 grid grid-cols-5 gap-1.5">
                  {PIPELINE_STAGES.map((stage, idx) => {
                    const reached = idx <= stageIdx;
                    const barColor = !reached
                      ? 'bg-[#E8E8E4]'
                      : isFinalError && idx === 4
                        ? 'bg-[#C2410C]'
                        : stageIdx === 4
                          ? 'bg-[#047857]'
                          : 'bg-[#3730A3]';

                    return (
                      <div key={stage} className="space-y-1">
                        <div className={`h-1.5 w-full rounded-full ${barColor}`} />
                        <div
                          className={`truncate font-mono text-[10px] ${
                            reached ? 'font-medium text-[#111315]' : 'text-[#8C929A]'
                          }`}
                        >
                          {idx === 4 && isFinalError ? 'FINALIZED · ERR' : stage}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
