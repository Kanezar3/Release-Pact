/**
 * Deterministic text normalization, line slicing, WebCrypto SHA-256 verification,
 * inline quote highlighting, and GenLayer Optimistic Democracy stage helpers.
 */

export const MAX_LINE_WINDOW = 120;
export const MAX_SNIPPET_CHARS = 3000;

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '-');
}

export function sliceSnippet(rawText: string, startLine: number, endLine: number): string {
  const sLine = Math.max(1, Math.floor(startLine));
  let eLine = Math.max(sLine, Math.floor(endLine));
  if (eLine - sLine + 1 > MAX_LINE_WINDOW) {
    eLine = sLine + MAX_LINE_WINDOW - 1;
  }
  const normalized = normalizeText(rawText);
  const lines = normalized.split('\n');
  const selected = lines.slice(sLine - 1, eLine);
  const joined = selected.join('\n');
  const collapsed = joined
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return collapsed.slice(0, MAX_SNIPPET_CHARS);
}

export function splitExcerptWithQuote(
  excerpt: string,
  quote: string
): { before: string; match: string; after: string } | null {
  if (!excerpt || !quote) return null;
  const idx = excerpt.indexOf(quote);
  if (idx === -1) return null;
  return {
    before: excerpt.slice(0, idx),
    match: excerpt.slice(idx, idx + quote.length),
    after: excerpt.slice(idx + quote.length),
  };
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function shortAddr(addr: string | undefined, head = 6, tail = 4): string {
  if (!addr) return '—';
  const clean = addr.trim();
  if (clean.length <= head + tail + 2) return clean;
  return `${clean.slice(0, head)}…${clean.slice(-tail)}`;
}

export function shortHash(hash: string | undefined, head = 10, tail = 6): string {
  if (!hash) return '—';
  const clean = hash.trim();
  if (clean.length <= head + tail + 2) return clean;
  return `${clean.slice(0, head)}…${clean.slice(-tail)}`;
}

export function formatUtc(epochSec: number | undefined): string {
  if (!epochSec) return '—';
  const d = new Date(epochSec * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

export function formatWei(wei: number | undefined): string {
  const n = Number(wei ?? 0);
  return `${n.toLocaleString('en-US')} wei`;
}

export interface BadgeTone {
  bg: string;
  text: string;
  border: string;
  dot: string;
}

export function verdictTone(code: string): BadgeTone {
  switch (code) {
    case 'FEATURE_DELIVERED':
    case 'DELIVERED_UNLOCKED':
    case 'FULLY_DELIVERED':
    case 'OBSERVABLE_DELIVERABLE':
    case 'FINALIZED':
    case 'FINALIZED_SUCCESS':
    case 'SUCCESS':
      return {
        bg: 'bg-[#ECFDF5]',
        text: 'text-[#047857]',
        border: 'border-[#A7F3D0]',
        dot: 'bg-[#047857]',
      };
    case 'NOT_DELIVERED':
    case 'TOO_VAGUE':
    case 'REJECTED_INVALID':
    case 'FINALIZED_ERROR':
    case 'ERROR':
      return {
        bg: 'bg-[#FFF7ED]',
        text: 'text-[#C2410C]',
        border: 'border-[#FED7AA]',
        dot: 'bg-[#C2410C]',
      };
    case 'OPEN':
    case 'PARTIALLY_DELIVERED':
    case 'ACCEPTED_APPEAL_WINDOW':
      return {
        bg: 'bg-[#EEF2FF]',
        text: 'text-[#3730A3]',
        border: 'border-[#C7D2FE]',
        dot: 'bg-[#3730A3]',
      };
    default:
      return {
        bg: 'bg-[#FFFBEB]',
        text: 'text-[#B45309]',
        border: 'border-[#FDE68A]',
        dot: 'bg-[#B45309]',
      };
  }
}

export const PIPELINE_STAGES = [
  'SUBMITTED',
  'PENDING',
  'PROPOSING',
  'ACCEPTED · APPEAL',
  'FINALIZED',
] as const;

export function consensusStageIndex(status: string): number {
  const upper = (status || '').toUpperCase();
  if (upper.includes('FINAL')) return 4;
  if (upper.includes('ACCEPT') || upper.includes('APPEAL') || upper.includes('UNDETERMINED')) {
    return 3;
  }
  if (upper.includes('PROPOS') || upper.includes('COMMIT') || upper.includes('REVEAL')) {
    return 2;
  }
  if (upper.includes('PEND')) return 1;
  return 0;
}

export function classifyTxState(status: string, executionResult: string): string {
  const st = (status || '').toUpperCase();
  const ex = (executionResult || '').toUpperCase();
  if (st.includes('FINAL')) {
    if (ex && ex !== 'SUCCESS') return 'FINALIZED_ERROR';
    return 'FINALIZED_SUCCESS';
  }
  if (st.includes('ACCEPT') || st.includes('APPEAL')) {
    return 'ACCEPTED_APPEAL_WINDOW';
  }
  if (st.includes('PEND') || st.includes('PROPOS') || st.includes('COMMIT') || st.includes('REVEAL')) {
    return 'PENDING';
  }
  return 'SUBMITTED';
}
