# Release Pact — 90-Second Demo Script

1. **0:00–0:15 — Open the Swiss Release Engineering Ledger:**
   Open the live web app (no wallet required). Show the top metric strip (4 finalized StudioNet pacts, 2/2 unlocked tranches on `pact-1`, 6 Gate-2 forensic audits) and click **`Verify Live RPC`** in the header to confirm live parity against `https://studio.genlayer.com/api`.

2. **0:15–0:40 — Inspect Multi-Tranche Unlock & Retry (`pact-1`):**
   Select **`pact-1` (Pallets Flask 3.1.x)** showing both tranches unlocked (`FULLY_DELIVERED`). Click through **`audit-1 · T0`** (`FEATURE_DELIVERED` for `SECRET_KEY_FALLBACKS`), **`audit-2 · T1`** (`NOT_DELIVERED` against Flask 3.1.2 unrelated fixes — proving Tranche 1 stayed `OPEN`), and **`audit-3 · T1`** (`FEATURE_DELIVERED` retry unlocking `SESSION_COOKIE_PARTITIONED`). Click **`Verify SHA-256 in Browser`** to prove byte-for-byte WebCrypto parity with on-chain `snippet_sha256`.

3. **0:40–1:05 — Gate-1 Screening, Adversarial Hardening & Expiry (`pact-2`, `pact-3`, `pact-4`):**
   - Click **`pact-2`** (`TOO_VAGUE`) showing immediate zero-revert deposit refund.
   - Click **`pact-3`** to inspect **`audit-4`** (`UNVERIFIABLE_FETCH` empty line slice), **`audit-5`** (`protectai/rebuff` prompt injection ignored), and **`audit-6`** (`REJECTED_INVALID: FORBIDDEN_EVIDENCE_URL`).
   - Click **`pact-4`** (`EXPIRED_SETTLED`) showing trusted-clock expiry refund.

4. **1:05–1:30 — Live Wallet Execution & Consensus Queue:**
   Switch to **`02 · Pact Desk`** to show 1-click MetaMask presets (`Flask 3.2 Preset`, `Too-Vague Preset`, `Flask 3.2 Proof Preset`) and **`Withdraw Refundable`**. Switch to **`03 · StudioNet Queue`** and click **`Load Finalized Proof Txs`** to show the 5-stage GenLayer Optimistic Democracy pipeline with direct StudioNet Explorer links.
