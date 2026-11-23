import { describe, expect, it } from 'vitest';
import {
  consensusStageIndex,
  normalizeText,
  sha256Hex,
  shortAddr,
  sliceSnippet,
  verdictTone,
} from '../format';

describe('Release Pact deterministic helpers', () => {
  it('normalizes CRLF and typographic quotes identically to contracts/release_pact.py', () => {
    const raw = 'Line 1\r\n\u201cSupport\u201d \u2014 \u2018fallback\u2019\rLine 3';
    expect(normalizeText(raw)).toBe('Line 1\n"Support" - \'fallback\'\nLine 3');
  });

  it('slices 1-indexed line windows and collapses horizontal whitespace', () => {
    const doc = ['alpha', '  beta   gamma  ', 'delta', 'epsilon'].join('\n');
    expect(sliceSnippet(doc, 2, 3)).toBe('beta gamma \ndelta'.replace(' \n', ' \n'));
    expect(sliceSnippet(doc, 100, 110)).toBe('');
  });

  it('computes standard WebCrypto SHA-256 hex digest', async () => {
    const digest = await sha256Hex('release-pact');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('formats addresses and consensus pipeline stages accurately', () => {
    expect(shortAddr('0x883c8602458d60Ca274Fa2aA0296c892CF875953')).toBe('0x883c…5953');
    expect(consensusStageIndex('PENDING')).toBe(0);
    expect(consensusStageIndex('PROPOSING')).toBe(1);
    expect(consensusStageIndex('COMMITTING')).toBe(2);
    expect(consensusStageIndex('ACCEPTED')).toBe(3);
    expect(consensusStageIndex('FINALIZED')).toBe(4);
    expect(verdictTone('FEATURE_DELIVERED').text).toContain('#047857');
  });
});
