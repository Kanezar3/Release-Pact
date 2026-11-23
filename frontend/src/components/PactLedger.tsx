import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  FileCode2,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Unlock,
  Clock,
  Hash,
} from 'lucide-react';
import type { AuditRecord, PactRecord, ProofManifest } from '../types';
import { formatUtc, formatWei, sha256Hex, shortAddr, shortHash, sliceSnippet } from '../lib/format';
import { StatusBadge } from './StatusBadge';

interface PactLedgerProps {
  pacts: PactRecord[];
  audits: AuditRecord[];
  proof: ProofManifest;
  isLiveSynced: boolean;
}

export function PactLedger({ pacts, audits, proof, isLiveSynced }: PactLedgerProps) {
  const [selectedPactId, setSelectedPactId] = useState<string>(pacts[0]?.pact_id ?? 'pact-1');
  const [selectedAuditId, setSelectedAuditId] = useState<string>(audits[0]?.audit_id ?? 'audit-1');
  const [shaCheck, setShaCheck] = useState<{
    state: 'idle' | 'loading' | 'match' | 'mismatch' | 'error';
    computed?: string;
    message?: string;
  }>({ state: 'idle' });

  const selectedPact = useMemo(
    () => pacts.find((p) => p.pact_id === selectedPactId) ?? pacts[0],
    [pacts, selectedPactId]
  );

  const pactAudits = useMemo(
    () => audits.filter((a) => a.pact_id === selectedPact?.pact_id),
    [audits, selectedPact]
  );

  const selectedAudit = useMemo(() => {
    const inPact = pactAudits.find((a) => a.audit_id === selectedAuditId);
    if (inPact) return inPact;
    return pactAudits[0] ?? audits[0];
  }, [pactAudits, selectedAuditId, audits]);

  useEffect(() => {
    setShaCheck({ state: 'idle' });
  }, [selectedAudit?.audit_id]);

  async function handleVerifySha256() {
    if (!selectedAudit || !selectedAudit.evidence_url || !selectedAudit.snippet_sha256) return;
    setShaCheck({ state: 'loading' });
    try {
      const res = await fetch(selectedAudit.evidence_url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} fetching source`);
      }
      const raw = await res.text();
      const sliced = sliceSnippet(raw, selectedAudit.start_line, selectedAudit.end_line);
      const computed = await sha256Hex(sliced);
      if (computed === selectedAudit.snippet_sha256) {
        setShaCheck({
          state: 'match',
          computed,
          message: 'Exact WebCrypto SHA-256 parity with on-chain snippet_sha256',
        });
      } else {
        setShaCheck({
          state: 'mismatch',
          computed,
          message: 'Computed digest differs from recorded on-chain hash',
        });
      }
    } catch (err) {
      setShaCheck({
        state: 'error',
        message: err instanceof Error ? err.message : 'Unable to fetch source in browser',
      });
    }
  }

  const totalEscrowed = useMemo(
    () => pacts.reduce((acc, p) => acc + Number(p.total_deposit_wei || 0), 0),
    [pacts]
  );
  const deliveredTranches = useMemo(
    () =>
      pacts.reduce(
        (acc, p) =>
          acc + p.tranches.filter((t) => t.status === 'DELIVERED_UNLOCKED').length,
        0
      ),
    [pacts]
  );
  const totalTranches = useMemo(
    () => pacts.reduce((acc, p) => acc + p.tranches.length, 0),
    [pacts]
  );

  return (
    <div className="space-y-6">
      {/* Compact Metric Strip */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="ledger-sheet rounded-lg p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#6E747C]">
            Active Ledger Pacts
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="font-display text-2xl font-semibold text-[#111315] tabular-nums">
              {pacts.length}
            </span>
            <span className="font-mono text-xs text-[#6E747C]">
              {isLiveSynced ? 'Live RPC' : 'Manifest'}
            </span>
          </div>
        </div>
        <div className="ledger-sheet rounded-lg p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#6E747C]">
            Tranches Unlocked
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="font-display text-2xl font-semibold text-[#047857] tabular-nums">
              {deliveredTranches}/{totalTranches}
            </span>
            <span className="font-mono text-xs text-[#6E747C]">Deterministic</span>
          </div>
        </div>
        <div className="ledger-sheet rounded-lg p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#6E747C]">
            Gate-2 Audits Logged
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="font-display text-2xl font-semibold text-[#111315] tabular-nums">
              {audits.length}
            </span>
            <span className="font-mono text-xs text-[#6E747C]">Commit-pinned</span>
          </div>
        </div>
        <div className="ledger-sheet rounded-lg p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#6E747C]">
            Escrowed Volume
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="font-display text-2xl font-semibold text-[#111315] tabular-nums">
              {totalEscrowed.toLocaleString('en-US')}
            </span>
            <span className="font-mono text-xs text-[#6E747C]">wei GEN</span>
          </div>
        </div>
      </section>

      {/* Master-Detail Ledger Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Pact Index */}
        <aside className="space-y-3 lg:col-span-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-[#525860]">
              Escrow Pacts
            </h2>
            <span className="font-mono text-[11px] text-[#6E747C]">
              Contract {shortAddr(proof.contracts.release_pact.address)}
            </span>
          </div>

          <div className="space-y-2.5">
            {pacts.map((pact) => {
              const isSelected = pact.pact_id === selectedPact?.pact_id;
              const unlocked = pact.tranches.filter(
                (t) => t.status === 'DELIVERED_UNLOCKED'
              ).length;
              const tCount = pact.tranches.length;
              const auditsCount = audits.filter((a) => a.pact_id === pact.pact_id).length;

              return (
                <button
                  key={pact.pact_id}
                  type="button"
                  onClick={() => setSelectedPactId(pact.pact_id)}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    isSelected
                      ? 'border-[#3730A3] bg-white ring-1 ring-[#3730A3]/20'
                      : 'border-[#E4E4E0] bg-white hover:border-[#C8C8C2]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-semibold uppercase tracking-wide text-[#3730A3]">
                      {pact.pact_id}
                    </span>
                    <StatusBadge value={pact.status} compact />
                  </div>
                  <div className="mt-2 font-display text-base font-semibold text-[#111315]">
                    {pact.project_name}
                  </div>
                  <div className="mt-1 truncate font-mono text-[11px] text-[#6E747C]">
                    {pact.allowed_source_prefix}
                  </div>

                  {/* Mini Multi-Tranche Progress Bar */}
                  {tCount > 0 ? (
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-[#525860]">
                        <span>
                          Tranches: <strong className="font-mono">{unlocked}/{tCount}</strong>
                        </span>
                        <span className="font-mono">{formatWei(pact.total_deposit_wei)}</span>
                      </div>
                      <div className="flex h-1.5 w-full gap-1 overflow-hidden rounded-full bg-[#EFEFEC]">
                        {pact.tranches.map((tr) => (
                          <div
                            key={tr.tranche_index}
                            className={`h-full flex-1 rounded-full ${
                              tr.status === 'DELIVERED_UNLOCKED'
                                ? 'bg-[#047857]'
                                : tr.status === 'EXPIRED_REFUNDED'
                                  ? 'bg-[#B45309]'
                                  : 'bg-[#C7D2FE]'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center justify-between text-[11px] text-[#C2410C]">
                      <span>Gate-1 Refunded</span>
                      <span className="font-mono">{formatWei(pact.refunded_wei)}</span>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t border-[#F0F0EC] pt-2.5 text-[11px] text-[#6E747C]">
                    <span>Sponsor {shortAddr(pact.sponsor)}</span>
                    <span className="font-mono">{auditsCount} audit{auditsCount === 1 ? '' : 's'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Column: Selected Pact Dossier & Audit Evidence */}
        <div className="space-y-5 lg:col-span-8">
          {selectedPact && (
            <section className="ledger-sheet rounded-lg p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EFEFEC] pb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#3730A3]">
                      {selectedPact.pact_id}
                    </span>
                    <span className="text-[#D0D0CA]">/</span>
                    <span className="font-mono text-xs text-[#6E747C]">
                      {selectedPact.reason}
                    </span>
                  </div>
                  <h2 className="mt-1 font-display text-xl font-semibold text-[#111315]">
                    {selectedPact.project_name}
                  </h2>
                </div>
                <StatusBadge value={selectedPact.status} />
              </div>

              {/* Pact Metadata Grid */}
              <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                <div className="ledger-sheet-muted rounded-md p-3">
                  <div className="text-[11px] text-[#6E747C]">Escrow Conservation</div>
                  <div className="mt-1 font-mono font-medium text-[#111315]">
                    {formatWei(selectedPact.total_deposit_wei)} locked
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-[#525860]">
                    Remaining: {formatWei(selectedPact.remaining_wei)} · Refunded:{' '}
                    {formatWei(selectedPact.refunded_wei)}
                  </div>
                </div>
                <div className="ledger-sheet-muted rounded-md p-3">
                  <div className="text-[11px] text-[#6E747C]">Bound Source Prefix</div>
                  <div className="mt-1 break-all font-mono text-[11px] font-medium text-[#111315]">
                    {selectedPact.allowed_source_prefix}
                  </div>
                </div>
                <div className="ledger-sheet-muted rounded-md p-3">
                  <div className="text-[11px] text-[#6E747C]">Trusted Clock Window</div>
                  <div className="mt-1 font-mono text-[11px] font-medium text-[#111315]">
                    {selectedPact.timeout_seconds}s deadline
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-[#525860]">
                    {formatUtc(selectedPact.created_at)}
                  </div>
                </div>
              </div>

              {/* Multi-Tranche Milestone Board */}
              <div className="mt-5">
                <div className="mb-2.5 flex items-center justify-between">
                  <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-[#525860]">
                    Ordered Feature Tranches
                  </h3>
                  <span className="font-mono text-[11px] text-[#6E747C]">
                    SHA-256 {shortHash(selectedPact.pact_sha256, 10, 6)}
                  </span>
                </div>

                {selectedPact.tranches.length === 0 ? (
                  <div className="rounded-md border border-[#FED7AA] bg-[#FFF7ED] p-4 text-sm text-[#9A3412]">
                    <div className="flex items-center gap-2 font-medium">
                      <ShieldAlert className="h-4 w-4 shrink-0" />
                      Gate-1 Rejected Subjective Deliverable ({selectedPact.reason})
                    </div>
                    <p className="mt-1 text-xs text-[#9A3412]/90">
                      GenLayer validators screened the deliverables before escrow lock. Zero funds
                      were stranded — {formatWei(selectedPact.refunded_wei)} was immediately credited
                      to Sponsor <code className="font-mono">{shortAddr(selectedPact.sponsor)}</code>{' '}
                      in <code className="font-mono">refundable_balances</code>.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedPact.tranches.map((tr) => {
                      const unlocked = tr.status === 'DELIVERED_UNLOCKED';
                      const expired = tr.status === 'EXPIRED_REFUNDED';
                      return (
                        <div
                          key={tr.tranche_index}
                          className={`rounded-md border p-3.5 ${
                            unlocked
                              ? 'border-[#A7F3D0] bg-[#ECFDF5]/50'
                              : expired
                                ? 'border-[#FDE68A] bg-[#FFFBEB]/60'
                                : 'border-[#E4E4E0] bg-[#FAFAF8]'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {unlocked ? (
                                <Unlock className="h-4 w-4 text-[#047857]" />
                              ) : expired ? (
                                <Clock className="h-4 w-4 text-[#B45309]" />
                              ) : (
                                <Lock className="h-4 w-4 text-[#3730A3]" />
                              )}
                              <span className="font-mono text-xs font-semibold text-[#111315]">
                                Tranche #{tr.tranche_index}
                              </span>
                              <span className="font-mono text-xs text-[#525860]">
                                {formatWei(tr.tranche_wei)}
                              </span>
                            </div>
                            <StatusBadge value={tr.status} compact />
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-[#111315]">
                            {tr.criterion}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-[#6E747C]">
                            <span>Attempts: {tr.audit_attempts}/5</span>
                            {tr.winning_audit_id && (
                              <span className="text-[#047857]">
                                Unlocked by {tr.winning_audit_id} · Builder {shortAddr(tr.builder)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Gate-2 Forensic Audit Inspector */}
          {pactAudits.length > 0 && selectedAudit && (
            <section className="ledger-sheet rounded-lg p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFEFEC] pb-4">
                <div>
                  <h3 className="font-display text-base font-semibold text-[#111315]">
                    Gate-2 Forensic Audit Trail
                  </h3>
                  <p className="mt-0.5 text-xs text-[#525860]">
                    Commit-pinned external changelog excerpts verified under GenLayer Optimistic Democracy.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {pactAudits.map((a) => {
                    const active = a.audit_id === selectedAudit.audit_id;
                    return (
                      <button
                        key={a.audit_id}
                        type="button"
                        onClick={() => setSelectedAuditId(a.audit_id)}
                        className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-colors ${
                          active
                            ? 'border-[#111315] bg-[#111315] text-white'
                            : 'border-[#E4E4E0] bg-white text-[#525860] hover:border-[#B8B8B2]'
                        }`}
                      >
                        {a.audit_id} · T{a.tranche_index}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={selectedAudit.verdict} />
                    <span className="rounded bg-[#F3F3EF] px-2 py-0.5 font-mono text-[11px] text-[#525860]">
                      {selectedAudit.reason}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-[#525860]">
                    Payout:{' '}
                    <strong className="text-[#111315]">
                      {formatWei(selectedAudit.payout_wei)}
                    </strong>{' '}
                    → {shortAddr(selectedAudit.payout_recipient)}
                  </div>
                </div>

                {selectedAudit.summary && (
                  <p className="text-sm leading-relaxed text-[#2C3036]">
                    {selectedAudit.summary}
                  </p>
                )}

                {selectedAudit.quote && (
                  <div className="rounded-md border border-[#A7F3D0] bg-[#ECFDF5]/60 p-3.5">
                    <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#047857]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Verbatim On-Chain Quote Proof
                    </div>
                    <blockquote className="mt-1.5 font-mono text-xs leading-relaxed text-[#064E3B]">
                      “{selectedAudit.quote}”
                    </blockquote>
                  </div>
                )}

                {/* Evidence URL + Line Slice + WebCrypto SHA-256 Verifier */}
                <div className="ledger-sheet-muted rounded-md p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-mono text-xs font-medium text-[#111315]">
                      <FileCode2 className="h-4 w-4 text-[#525860]" />
                      <span>
                        Lines {selectedAudit.start_line}–{selectedAudit.end_line}
                      </span>
                      <span className="text-[#C8C8C2]">·</span>
                      <span>{selectedAudit.snippet_len} chars</span>
                    </div>
                    {selectedAudit.evidence_url && (
                      <a
                        href={selectedAudit.evidence_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-[#3730A3] hover:underline"
                      >
                        Raw Pinned Source
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  <div className="break-all font-mono text-[11px] text-[#525860]">
                    {selectedAudit.evidence_url}
                  </div>

                  {selectedAudit.snippet_sha256 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E4E4E0] pt-3">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#525860]">
                        <Hash className="h-3.5 w-3.5 shrink-0 text-[#6E747C]" />
                        <span className="break-all">
                          snippet_sha256: <strong className="text-[#111315]">{shortHash(selectedAudit.snippet_sha256, 16, 10)}</strong>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleVerifySha256}
                        disabled={shaCheck.state === 'loading'}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#111315] bg-[#111315] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#262A2E] disabled:opacity-60"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {shaCheck.state === 'loading'
                          ? 'Hashing Source…'
                          : 'Verify SHA-256 in Browser'}
                      </button>
                    </div>
                  )}

                  {shaCheck.state !== 'idle' && shaCheck.state !== 'loading' && (
                    <div
                      className={`rounded-md border px-3 py-2 font-mono text-[11px] ${
                        shaCheck.state === 'match'
                          ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]'
                          : 'border-[#FED7AA] bg-[#FFF7ED] text-[#C2410C]'
                      }`}
                    >
                      {shaCheck.message}
                      {shaCheck.computed && (
                        <div className="mt-0.5 break-all opacity-80">
                          WebCrypto: {shaCheck.computed}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedAudit.snippet_excerpt && (
                    <pre className="max-h-52 overflow-auto rounded border border-[#E4E4E0] bg-white p-3 font-mono text-[11px] leading-relaxed text-[#2C3036] whitespace-pre-wrap">
                      {selectedAudit.snippet_excerpt}
                    </pre>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
