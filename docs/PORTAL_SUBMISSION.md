# Release Pact — GenLayer Portal Project Submission Sheet

Copy-paste ready submission sheet for `portal.genlayer.foundation/submit-contribution`.

---

## 01. Identity — Make it recognizable

- **Project Logo (`1024 × 1024 px` PNG · `991.4 KB` · `< 2 MB`):** `logo.png` (and `https://release-pact.vercel.app/logo.png`)
- **Project Name:**
  ```text
  Release Pact
  ```
- **Primary Tag:** `AI Agents`
- **Tag 1:** `Source Verification`
- **Tag 2:** `Verifiable Inference`

---

## 02. Project Summary — One-liner (`146 / 160` chars)

```text
Multi-tranche open-source feature-release escrow unlocking milestone GEN payouts via commit-pinned changelog verification on GenLayer StudioNet.
```

---

## 03. Project Overview — Description (`928 / 1000` CRLF chars)

```text
Release Pact is a multi-tranche open-source feature-release escrow built on GenLayer StudioNet. Sponsors lock GEN across 1-3 ordered software deliverables bound to a repo-scoped external prefix (e.g. raw.githubusercontent.com/pallets/flask/), an optional min_release_date, and a trusted-clock deadline.

"The model judges; plain Python moves money."
- Gate 1 (Clarity Screening): Validators reject vague goals (TOO_VAGUE) with immediate zero-revert deposit refunds.
- Gate 2 (Forensic Proof): Non-sponsor builders submit commit-pinned raw changelog line slices. Validators independently re-fetch, verify identical SHA-256 digests and >=12-char verbatim quotes inside the snippet, and ignore prompt injections.
- Deterministic Accounting: FEATURE_DELIVERED unlocks tranches proportionally; per-builder caps prevent griefing; settle_expired_pact and withdraw_refundable execute chain-layer EOA transfers on finalization.
```

---

## 04. Demo Video *(Optional)*
Leave blank unless attaching a YouTube or X walkthrough link.

---

## 05. How-To — Write the exact path

- **Step `01`**
  - **Optional Heading:** `Verify Live StudioNet RPC & EOA Transfers`
  - **Instruction:**
    ```text
    Open https://release-pact.vercel.app (no wallet required). In "01 · Pact Ledger", review the Recorded Proof banner and Finalized EOA Native Transfers card (Sponsor 0 -> 260 wei, Builder 0 -> 280 wei), then click "Verify Live RPC" in the header to confirm live parity (5 pacts, 7 audits) against contract 0x2bc81019DF2A0Ef3d238AC9ae9679059c90d20C0 on Chain ID 61999.
    ```

- **Step `02`**
  - **Optional Heading:** `Verify SHA-256, Inline Quotes & Retry Flow`
  - **Instruction:**
    ```text
    Select "pact-1" (Pallets Flask 3.1.x, FULLY DELIVERED) to inspect both unlocked tranches. Click "audit-1 · T0" (FEATURE_DELIVERED), "audit-2 · T1" (NOT_DELIVERED on Flask 3.1.2, leaving T1 OPEN), and "audit-3 · T1" (retry FEATURE_DELIVERED). Inspect the highlighted verbatim quote inside the excerpt and click "Verify SHA-256 in Browser" for exact WebCrypto parity with on-chain snippet_sha256.
    ```

- **Step `03`**
  - **Optional Heading:** `Inspect Gate-1, Security & Expiry Proofs`
  - **Instruction:**
    ```text
    Browse "pact-2" (TOO_VAGUE immediate refund), "pact-3" (audit-4 UNVERIFIABLE_FETCH, audit-5 cross-repo URL_OUTSIDE_ALLOWED_PREFIX, audit-6 SPONSOR_CANNOT_SUBMIT_PROOF anti-griefing), "pact-4" (audit-7 protectai/rebuff prompt-injection defense), and "pact-5" (EXPIRED_SETTLED trusted-clock refund) with per-item Explorer Tx links.
    ```

- **Step `04`**
  - **Optional Heading:** `Connect Wallet & Inspect Appeal Window Queue`
  - **Instruction:**
    ```text
    Switch to "02 · Pact Desk" and click "Connect Wallet" for MetaMask on StudioNet (Chain 61999) to test 1-click presets ("Flask 3.2 Preset", "Too-Vague Preset", "Flask 3.2 Proof Preset") or "Withdraw Refundable". Open "03 · StudioNet Queue" and click "Load 18 Finalized Proof Txs" to inspect the 5-stage pipeline (including Accepted / Appeal Window and Finalized Success/Error states).
    ```

---

## 06. Review Verification — Prove the path works

### Expected Verification Outcome (`389 / 500` chars)
```text
In 01 · Pact Ledger, clicking Verify Live RPC switches to Live StudioNet RPC Read (5 pacts, 7 audits) on contract 0x2bc81019DF2A0Ef3d238AC9ae9679059c90d20C0, Verify SHA-256 in Browser confirms exact WebCrypto snippet_sha256 parity with inline highlighted quotes on audit-1 and audit-3, and 03 · StudioNet Queue loads all 18 FINALIZED / MAJORITY_AGREE / SUCCESS StudioNet Explorer txs.
```

### Contract Link 1 *(Optional)*
```text
https://explorer-studio.genlayer.com/address/0x2bc81019DF2A0Ef3d238AC9ae9679059c90d20C0
```

---

## 07. Project Links — Send people to it

- **WEBSITE · REQUIRED:**
  ```text
  https://release-pact.vercel.app
  ```
- **GITHUB:**
  ```text
  https://github.com/Kanezar3/Release-Pact
  ```

---

## Evidence & Supporting Information

- **GitHub Repository:** `https://github.com/Kanezar3/Release-Pact`
- **Live Web App (Vercel):** `https://release-pact.vercel.app`
- **ReleasePact v1.1 Contract (`0x2bc8...20C0`):** `https://explorer-studio.genlayer.com/address/0x2bc81019DF2A0Ef3d238AC9ae9679059c90d20C0`
- **EvidenceProbe Contract (`0x3261...084B`):** `https://explorer-studio.genlayer.com/address/0x3261f64fd4EAf570cB9AAb559a28A6F8BF27084B`
- **Deploy ReleasePact Tx:** `https://explorer-studio.genlayer.com/tx/0x07fc577bd8da3f88c8263e02b4daf74f58d129d028cbd9bb49fb16a086c77597`
- **Sponsor EOA Withdrawal (`0 -> 260 wei`):** `https://explorer-studio.genlayer.com/tx/0x113c09e43f21736ac6230ea080fd0ce7c66e313e7079f39ae86a30186b3fb8ef`
- **Builder EOA Withdrawal (`0 -> 280 wei`):** `https://explorer-studio.genlayer.com/tx/0xca6dbf3393f72b8e463721f20dfa6d6145e9ce002ba840b2d445344f3e0a224c`
- **On-Chain Proof Manifest (`deploy/proof.json`):** `https://github.com/Kanezar3/Release-Pact/blob/main/deploy/proof.json`
