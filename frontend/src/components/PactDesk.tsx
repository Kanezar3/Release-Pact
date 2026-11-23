import { useState } from 'react';
import { Wallet, Send, Sparkles, RefreshCw, ArrowUpRight, AlertCircle } from 'lucide-react';
import {
  ensureStudioNetWallet,
  fetchRefundableBalance,
  STUDIONET_CHAIN_ID,
  STUDIONET_RPC_URL,
  writeStudioNetContract,
} from '../lib/studionet';
import { formatWei, shortAddr } from '../lib/format';
import type { QueuedTx } from '../types';

interface PactDeskProps {
  contractAddress: string;
  onTxSubmitted: (tx: QueuedTx) => void;
}

const FLASK_PINNED_URL =
  'https://raw.githubusercontent.com/pallets/flask/41cb747cd5a9b43da43bf809ad974722542603db/CHANGES.rst';

export function PactDesk({ contractAddress, onTxSubmitted }: PactDeskProps) {
  const [account, setAccount] = useState<string>('');
  const [refundableWei, setRefundableWei] = useState<number | null>(null);
  const [busy, setBusy] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [notice, setNotice] = useState<string>('');

  // Create Pact form
  const [projectName, setProjectName] = useState('Pallets Flask 3.2.0');
  const [deliverablesText, setDeliverablesText] = useState(
    'Add the app.query route decorator for handling the HTTP QUERY method.'
  );
  const [sourcePrefix, setSourcePrefix] = useState(
    'https://raw.githubusercontent.com/pallets/flask/'
  );
  const [minReleaseDate, setMinReleaseDate] = useState('2025-01-01');
  const [timeoutSec, setTimeoutSec] = useState('900');
  const [depositWei, setDepositWei] = useState('100');

  // Submit Delivery Proof form
  const [pactId, setPactId] = useState('pact-3');
  const [trancheIndex, setTrancheIndex] = useState('0');
  const [evidenceUrl, setEvidenceUrl] = useState(FLASK_PINNED_URL);
  const [startLine, setStartLine] = useState('1');
  const [endLine, setEndLine] = useState('33');
  const [stakeWei, setStakeWei] = useState('20');

  // Settle Expired Pact
  const [settlePactId, setSettlePactId] = useState('pact-5');

  async function handleConnect() {
    setError('');
    setNotice('');
    setBusy('connect');
    try {
      const addr = await ensureStudioNetWallet();
      setAccount(addr);
      const bal = await fetchRefundableBalance(contractAddress, addr);
      setRefundableWei(bal);
      setNotice(`Connected ${shortAddr(addr)} on GenLayer StudioNet (Chain ${STUDIONET_CHAIN_ID}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wallet connection failed');
    } finally {
      setBusy('');
    }
  }

  async function refreshBalance() {
    if (!account) return;
    setError('');
    try {
      const bal = await fetchRefundableBalance(contractAddress, account);
      setRefundableWei(bal);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch refundable balance');
    }
  }

  function applyPreset(preset: 'flask32' | 'vague' | 'proof32') {
    setError('');
    setNotice('');
    if (preset === 'flask32') {
      setProjectName('Pallets Flask 3.2.0');
      setDeliverablesText(
        'Add the app.query route decorator for handling the HTTP QUERY method.'
      );
      setSourcePrefix('https://raw.githubusercontent.com/pallets/flask/');
      setMinReleaseDate('2025-01-01');
      setTimeoutSec('900');
      setDepositWei('100');
    } else if (preset === 'vague') {
      setProjectName('Pallets Flask UX');
      setDeliverablesText(
        'Make Flask feel dramatically more ergonomic, clean, and joyful for modern developers.'
      );
      setSourcePrefix('https://raw.githubusercontent.com/pallets/flask/');
      setMinReleaseDate('');
      setTimeoutSec('900');
      setDepositWei('100');
    } else {
      setPactId('pact-3');
      setTrancheIndex('0');
      setEvidenceUrl(FLASK_PINNED_URL);
      setStartLine('1');
      setEndLine('33');
      setStakeWei('20');
    }
  }

  async function submitWrite(
    label: string,
    functionName: string,
    args: unknown[],
    valueWei: bigint
  ) {
    if (!account) {
      setError('Connect MetaMask on GenLayer StudioNet (Chain 61999) first.');
      return;
    }
    setError('');
    setNotice('');
    setBusy(functionName);
    try {
      const hash = await writeStudioNetContract({
        account,
        contractAddress,
        functionName,
        args,
        valueWei,
      });
      onTxSubmitted({
        hash,
        label,
        method: functionName,
        submittedAt: Date.now(),
        status: 'SUBMITTED',
        resultName: '',
        executionResult: '',
        lastCheckedAt: Date.now(),
      });
      setNotice(`Submitted ${functionName} (${hash.slice(0, 12)}…). Tracking in StudioNet Queue.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${functionName} failed`);
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="space-y-6">
      {/* Wallet Connection Bar */}
      <section className="ledger-sheet rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-[#3730A3]" />
              <h2 className="font-display text-base font-semibold text-[#111315]">
                StudioNet Execution Desk
              </h2>
            </div>
            <p className="mt-1 text-xs text-[#525860]">
              Network: <code className="font-mono">Chain ID {STUDIONET_CHAIN_ID}</code> · RPC{' '}
              <code className="font-mono">{STUDIONET_RPC_URL}</code> · Withdrawals execute strictly
              on GenLayer finalization after the native Appeal Window.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {account ? (
              <>
                <div className="rounded-md border border-[#E4E4E0] bg-[#FAFAF8] px-3 py-1.5 font-mono text-xs text-[#111315]">
                  {shortAddr(account)} · Refundable:{' '}
                  <strong>{refundableWei !== null ? formatWei(refundableWei) : '…'}</strong>
                </div>
                <button
                  type="button"
                  onClick={refreshBalance}
                  className="inline-flex items-center gap-1 rounded-md border border-[#E4E4E0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#525860] hover:border-[#B8B8B2]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </button>
                <button
                  type="button"
                  disabled={busy !== ''}
                  onClick={() => submitWrite('withdraw_refundable', 'withdraw_refundable', [], 0n)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#047857] bg-[#047857] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#065F46] disabled:opacity-50"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Withdraw Refundable
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                disabled={busy === 'connect'}
                className="inline-flex items-center gap-2 rounded-md bg-[#111315] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#262A2E] disabled:opacity-60"
              >
                <Wallet className="h-3.5 w-3.5" />
                {busy === 'connect' ? 'Connecting…' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-[#FED7AA] bg-[#FFF7ED] px-3.5 py-2.5 text-xs text-[#C2410C]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="mt-4 rounded-md border border-[#A7F3D0] bg-[#ECFDF5] px-3.5 py-2.5 font-mono text-xs text-[#047857]">
            {notice}
          </div>
        )}
      </section>

      {/* Two-Column Action Cards with mt-auto Footer Buttons */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Card 1: Create Release Pact */}
        <section className="ledger-sheet flex flex-col rounded-lg p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFEFEC] pb-3.5">
            <div>
              <h3 className="font-display text-base font-semibold text-[#111315]">
                1. Create Release Pact
              </h3>
              <p className="text-xs text-[#525860]">
                Lock GEN across 1–3 concrete deliverables bound to a repo prefix.
              </p>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => applyPreset('flask32')}
                className="inline-flex items-center gap-1 rounded border border-[#E4E4E0] bg-[#FAFAF8] px-2 py-1 text-[11px] font-medium text-[#111315] hover:border-[#B8B8B2]"
              >
                <Sparkles className="h-3 w-3 text-[#047857]" />
                Flask 3.2 Preset
              </button>
              <button
                type="button"
                onClick={() => applyPreset('vague')}
                className="inline-flex items-center gap-1 rounded border border-[#E4E4E0] bg-[#FAFAF8] px-2 py-1 text-[11px] font-medium text-[#111315] hover:border-[#B8B8B2]"
              >
                Too-Vague Preset
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3.5 text-xs">
            <div>
              <label className="mb-1 block font-medium text-[#525860]">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full rounded-md border border-[#E4E4E0] bg-white px-3 py-2 text-sm text-[#111315] focus:border-[#3730A3] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium text-[#525860]">
                Deliverables (1–3 lines, one tranche per line)
              </label>
              <textarea
                rows={3}
                value={deliverablesText}
                onChange={(e) => setDeliverablesText(e.target.value)}
                className="w-full rounded-md border border-[#E4E4E0] bg-white px-3 py-2 text-sm text-[#111315] focus:border-[#3730A3] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium text-[#525860]">
                Bound Canonical Source Prefix (&lt;owner&gt;/&lt;repo&gt;/)
              </label>
              <input
                type="text"
                value={sourcePrefix}
                onChange={(e) => setSourcePrefix(e.target.value)}
                className="w-full rounded-md border border-[#E4E4E0] bg-white px-3 py-2 font-mono text-xs text-[#111315] focus:border-[#3730A3] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block font-medium text-[#525860]">
                  Min Release Date
                </label>
                <input
                  type="text"
                  placeholder="YYYY-MM-DD"
                  value={minReleaseDate}
                  onChange={(e) => setMinReleaseDate(e.target.value)}
                  className="w-full rounded-md border border-[#E4E4E0] bg-white px-2.5 py-2 font-mono text-xs text-[#111315] focus:border-[#3730A3] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-[#525860]">Timeout (s)</label>
                <input
                  type="number"
                  min={15}
                  value={timeoutSec}
                  onChange={(e) => setTimeoutSec(e.target.value)}
                  className="w-full rounded-md border border-[#E4E4E0] bg-white px-2.5 py-2 font-mono text-xs text-[#111315] focus:border-[#3730A3] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-[#525860]">Deposit (wei)</label>
                <input
                  type="number"
                  min={100}
                  value={depositWei}
                  onChange={(e) => setDepositWei(e.target.value)}
                  className="w-full rounded-md border border-[#E4E4E0] bg-white px-2.5 py-2 font-mono text-xs text-[#111315] focus:border-[#3730A3] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="mt-auto pt-5">
            <button
              type="button"
              disabled={busy !== ''}
              onClick={() => {
                const lines = deliverablesText
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean);
                submitWrite(
                  `create_release_pact (${projectName})`,
                  'create_release_pact',
                  [
                    projectName,
                    JSON.stringify(lines),
                    sourcePrefix,
                    Number(timeoutSec) || 900,
                    minReleaseDate.trim(),
                  ],
                  BigInt(depositWei || '100')
                );
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#111315] px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-[#262A2E] disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {busy === 'create_release_pact' ? 'Submitting…' : 'Create Release Pact'}
            </button>
          </div>
        </section>

        {/* Card 2: Submit Delivery Proof + Expiry Settlement */}
        <section className="ledger-sheet flex flex-col rounded-lg p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFEFEC] pb-3.5">
            <div>
              <h3 className="font-display text-base font-semibold text-[#111315]">
                2. Submit Delivery Proof
              </h3>
              <p className="text-xs text-[#525860]">
                Prove a tranche with a commit-pinned changelog line slice (non-sponsor EOA).
              </p>
            </div>
            <button
              type="button"
              onClick={() => applyPreset('proof32')}
              className="inline-flex items-center gap-1 rounded border border-[#E4E4E0] bg-[#FAFAF8] px-2 py-1 text-[11px] font-medium text-[#111315] hover:border-[#B8B8B2]"
            >
              <Sparkles className="h-3 w-3 text-[#047857]" />
              Flask 3.2 Proof Preset
            </button>
          </div>

          <div className="mt-4 space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-[#525860]">Pact ID</label>
                <input
                  type="text"
                  value={pactId}
                  onChange={(e) => setPactId(e.target.value)}
                  className="w-full rounded-md border border-[#E4E4E0] bg-white px-3 py-2 font-mono text-xs text-[#111315] focus:border-[#3730A3] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-[#525860]">Tranche Index</label>
                <input
                  type="number"
                  min={0}
                  max={2}
                  value={trancheIndex}
                  onChange={(e) => setTrancheIndex(e.target.value)}
                  className="w-full rounded-md border border-[#E4E4E0] bg-white px-3 py-2 font-mono text-xs text-[#111315] focus:border-[#3730A3] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-[#525860]">
                Commit-Pinned Evidence URL
              </label>
              <input
                type="text"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                className="w-full rounded-md border border-[#E4E4E0] bg-white px-3 py-2 font-mono text-xs text-[#111315] focus:border-[#3730A3] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block font-medium text-[#525860]">Start Line</label>
                <input
                  type="number"
                  min={1}
                  value={startLine}
                  onChange={(e) => setStartLine(e.target.value)}
                  className="w-full rounded-md border border-[#E4E4E0] bg-white px-3 py-2 font-mono text-xs text-[#111315] focus:border-[#3730A3] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-[#525860]">End Line</label>
                <input
                  type="number"
                  min={1}
                  value={endLine}
                  onChange={(e) => setEndLine(e.target.value)}
                  className="w-full rounded-md border border-[#E4E4E0] bg-white px-3 py-2 font-mono text-xs text-[#111315] focus:border-[#3730A3] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-[#525860]">Stake (wei)</label>
                <input
                  type="number"
                  min={20}
                  value={stakeWei}
                  onChange={(e) => setStakeWei(e.target.value)}
                  className="w-full rounded-md border border-[#E4E4E0] bg-white px-3 py-2 font-mono text-xs text-[#111315] focus:border-[#3730A3] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="mt-auto space-y-3 pt-5">
            <button
              type="button"
              disabled={busy !== ''}
              onClick={() =>
                submitWrite(
                  `submit_delivery_proof (${pactId} T${trancheIndex})`,
                  'submit_delivery_proof',
                  [
                    pactId,
                    Number(trancheIndex) || 0,
                    evidenceUrl,
                    Number(startLine) || 1,
                    Number(endLine) || 33,
                  ],
                  BigInt(stakeWei || '20')
                )
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#3730A3] px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-[#312E81] disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {busy === 'submit_delivery_proof' ? 'Submitting…' : 'Submit Delivery Proof'}
            </button>

            <div className="flex items-center gap-2 border-t border-[#EFEFEC] pt-3">
              <input
                type="text"
                value={settlePactId}
                onChange={(e) => setSettlePactId(e.target.value)}
                placeholder="pact-5"
                className="w-28 rounded-md border border-[#E4E4E0] bg-white px-2.5 py-1.5 font-mono text-xs text-[#111315]"
              />
              <button
                type="button"
                disabled={busy !== ''}
                onClick={() =>
                  submitWrite(
                    `settle_expired_pact (${settlePactId})`,
                    'settle_expired_pact',
                    [settlePactId],
                    0n
                  )
                }
                className="flex-1 rounded-md border border-[#E4E4E0] bg-[#FAFAF8] px-3 py-1.5 text-xs font-medium text-[#111315] hover:border-[#B8B8B2] disabled:opacity-50"
              >
                Settle Expired Pact
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
