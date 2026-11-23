import { describe, expect, it } from 'vitest';
import {
  classifyTxState,
  consensusStageIndex,
  normalizeText,
  sha256Hex,
  shortAddr,
  sliceSnippet,
  splitExcerptWithQuote,
  verdictTone,
} from '../format';

describe('Release Pact deterministic helpers', () => {
  it('normalizes CRLF and typographic quotes identically to contracts/release_pact.py', () => {
    const raw = 'Line 1\r\n\u201cSupport\u201d \u2014 \u2018fallback\u2019\rLine 3';
    expect(normalizeText(raw)).toBe('Line 1\n"Support" - \'fallback\'\nLine 3');
  });

  it('slices 1-indexed line windows and highlights verbatim quote inline', () => {
    const doc = ['alpha', '  beta   gamma  ', 'delta', 'epsilon'].join('\n');
    expect(sliceSnippet(doc, 2, 3)).toContain('beta gamma');
    expect(sliceSnippet(doc, 100, 110)).toBe('');

    const parts = splitExcerptWithQuote('Hello SECRET_KEY_FALLBACKS world', 'SECRET_KEY_FALLBACKS');
    expect(parts).toEqual({
      before: 'Hello ',
      match: 'SECRET_KEY_FALLBACKS',
      after: ' world',
    });
  });

  it('computes standard WebCrypto SHA-256 hex digest', async () => {
    const digest = await sha256Hex('release-pact');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('classifies submitted, pending, accepted/appeal, finalized-success, and finalized-error states', () => {
    expect(shortAddr('0x883c8602458d60Ca274Fa2aA0296c892CF875953')).toBe('0x883c…5953');
    expect(consensusStageIndex('SUBMITTED')).toBe(0);
    expect(consensusStageIndex('PENDING')).toBe(1);
    expect(consensusStageIndex('PROPOSING')).toBe(2);
    expect(consensusStageIndex('ACCEPTED')).toBe(3);
    expect(consensusStageIndex('FINALIZED')).toBe(4);

    expect(classifyTxState('SUBMITTED', '')).toBe('SUBMITTED');
    expect(classifyTxState('PENDING', '')).toBe('PENDING');
    expect(classifyTxState('ACCEPTED', '')).toBe('ACCEPTED_APPEAL_WINDOW');
    expect(classifyTxState('FINALIZED', 'SUCCESS')).toBe('FINALIZED_SUCCESS');
    expect(classifyTxState('FINALIZED', 'ERROR')).toBe('FINALIZED_ERROR');
    expect(verdictTone('FINALIZED_ERROR').text).toContain('#C2410C');
  });
});
