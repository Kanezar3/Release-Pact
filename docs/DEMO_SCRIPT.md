# Release Pact — Two-Minute Demo Script

**Goal:** Walk a reviewer through every live finalized StudioNet proof, verify cryptographic and live-RPC parity without connecting a wallet, and showcase the live MetaMask execution desk and Appeal Window tracker.

---

### 0:00–0:20 — Open the Ledger & Switch from Recorded Proof to Live RPC
1. Open the live web app (no wallet required). Point out the top banner explicitly distinguishing **`Recorded Proof Snapshot (proof.json)`** from live chain reads.
2. Click **`Verify Live RPC`** in the top navigation bar. Wait ~2 seconds for the banner to turn emerald (**`Live StudioNet RPC Read`**) and confirm **`Live RPC Parity: 5 pacts · 7 audits`** directly from `https://studio.genlayer.com/api`.
3. Highlight the **Finalized EOA Native Transfers** card showing real chain-layer `emit_transfer` balance increases for both Sponsor and Builder EOAs with direct StudioNet Explorer transaction links and `0 / 0 wei` post-withdrawal ledger conservation.

### 0:20–0:55 — Multi-Tranche Unlock, Retriable Failure & Inline Quote Verification (`pact-1`)
1. Select **`pact-1` (Pallets Flask 3.1.x, `FULLY DELIVERED`)** with `Min release: 2024-11-01` and clickable **`Create Tx`** Explorer link. Show both tranches marked `DELIVERED UNLOCKED` (`Tranches: 2/2`).
2. Click **`audit-1 · T0`** (`FEATURE_DELIVERED`, `+120 wei` to Builder). Show the verbatim on-chain quote for `SECRET_KEY_FALLBACKS` highlighted directly inside the normalized changelog excerpt below it.
3. Click **`Verify SHA-256 in Browser`** to fetch the pinned raw GitHub file in the browser and confirm exact WebCrypto SHA-256 parity with on-chain `snippet_sha256`.
4. Click **`audit-2 · T1`** (`NOT_DELIVERED` against Flask 3.1.2 unrelated fixes) — show that Tranche #1 stayed `OPEN` for retry while `20 wei` stake went to the Sponsor.
5. Click **`audit-3 · T1`** (`FEATURE_DELIVERED` retry against Flask 3.1.0 `SESSION_COOKIE_PARTITIONED`), unlocking the second tranche and transitioning `pact-1` to `FULLY_DELIVERED`.

### 0:55–1:30 — Gate-1 Screening, Repo Prefix Isolation, Anti-Griefing, Prompt Injection & Expiry
1. Click **`pact-2` (`TOO VAGUE`)** — show Gate-1 rejecting subjective UX copy and immediately crediting `100 wei` back to the Sponsor with zero revert.
2. Click **`pact-3` (`OPEN`, strict `pallets/flask/` prefix)**:
   - **`audit-4`**: `UNVERIFIABLE_FETCH` (`EMPTY_LINE_SLICE` on lines `9000–9020`) → stake refunded, Tranche #0 remains `OPEN`.
   - **`audit-5`**: Cross-repo URL (`protectai/rebuff`) blocked deterministically (`URL_OUTSIDE_ALLOWED_PREFIX`) with zero-revert stake refund.
   - **`audit-6`**: Sponsor attempting to self-submit on their own pact blocked (`SPONSOR_CANNOT_SUBMIT_PROOF`), preventing self-griefing of attempt counters.
3. Click **`pact-4` (`ProtectAI Rebuff SDK`)** → **`audit-7`** (`protectai/rebuff` prompt-injection fixture inside `<untrusted_evidence>`) → injection ignored, Tranche #0 stays `OPEN`.
4. Click **`pact-5` (`EXPIRED SETTLED`)** — show both **`Create Tx`** and **`Settle Tx`** Explorer links proving trusted-clock expiry refunds remaining escrow to Sponsor.

### 1:30–2:00 — Live Wallet Desk & GenLayer Appeal Window Queue
1. Switch to **`02 · Pact Desk`**. Highlight the **`Min Release Date`** input, 1-click presets (**`Flask 3.2 Preset`**, **`Too-Vague Preset`**, **`Flask 3.2 Proof Preset`**), **`Settle Expired Pact`**, and **`Withdraw Refundable`** (noting chain-layer settlement strictly upon finalization).
2. Switch to **`03 · StudioNet Queue`**. Highlight the **Native Appeal Window** callout explaining GenLayer's `ACCEPTED → FINALIZED` phase, then click **`Load 18 Finalized Proof Txs`** to inspect every recorded StudioNet transaction across the 5-stage pipeline (`SUBMITTED → PENDING → PROPOSING → ACCEPTED · APPEAL → FINALIZED`) with direct Explorer links.
