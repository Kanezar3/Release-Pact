# Release Pact — GenLayer Portal Project Submission Sheet

Copy-paste ready submission sheet for `portal.genlayer.foundation/submit-contribution`.

---

## 01. Identity — Make it recognizable

- **Project Logo (`1024 × 1024 px` PNG · `991.4 KB` · `< 2 MB`):** `logo.png` (and `frontend/public/logo.png`)
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

## 03. Project Overview — Description (`868 / 1000` chars)

```text
Release Pact is a multi-tranche open-source feature-release escrow built on GenLayer StudioNet. Sponsors lock GEN across 1-3 ordered software deliverables bound to an immutable external repository prefix (e.g. pallets/flask) and a trusted-clock deadline.

"The model judges; plain Python moves money."
- Gate 1 (Clarity Screening): Validators screen deliverables before lock, rejecting subjective goals (TOO_VAGUE) with immediate zero-revert deposit refunds.
- Gate 2 (Forensic Proof): Builders submit commit-pinned raw changelog line slices. Validators independently re-fetch, verify identical SHA-256 snippet digests and >=12-char verbatim quotes in Python, and ignore embedded prompt injections.
- Deterministic Accounting: FEATURE_DELIVERED unlocks each tranche proportionally; non-conclusive audits keep tranches OPEN for retries; settle_expired_pact and withdraw_refundable execute real EOA native transfers.
```

---

## 04. Demo Video *(Optional)*
Leave blank unless attaching a YouTube or X walkthrough link.

---

## 05. How-To — Write the exact path

- **Step `01`**
  - **Optional Heading:** `Inspect Finalized Multi-Tranche Pacts`
  - **Instruction:**
    ```text
    Open the live web app (no wallet required). In "01 · Pact Ledger", browse all 4 finalized StudioNet pacts (pact-1 through pact-4) and click "Verify Live RPC" in the top bar to confirm live RPC parity against contract 0x34e7311ab0AC6884f30EbA0D328Fe523B3C1a15a on Chain ID 61999.
    ```

- **Step `02`**
  - **Optional Heading:** `Verify SHA-256 & Retry Mechanics`
  - **Instruction:**
    ```text
    Select "pact-1" (Pallets Flask 3.1.x, FULLY_DELIVERED) to inspect both unlocked tranches. Click "audit-1 · T0" (FEATURE_DELIVERED), "audit-2 · T1" (NOT_DELIVERED on Flask 3.1.2, leaving T1 OPEN), and "audit-3 · T1" (retry FEATURE_DELIVERED). Click "Verify SHA-256 in Browser" to recompute WebCrypto SHA-256 parity with on-chain snippet_sha256.
    ```

- **Step `03`**
  - **Optional Heading:** `Inspect Gate-1, Security & Expiry Proofs`
  - **Instruction:**
    ```text
    Click "pact-2" (TOO_VAGUE immediate refund), "pact-3" (audit-4 UNVERIFIABLE_FETCH empty slice, audit-5 protectai/rebuff prompt-injection defense, audit-6 FORBIDDEN_EVIDENCE_URL zero-revert refund), and "pact-4" (EXPIRED_SETTLED trusted-clock refund).
    ```

- **Step `04`**
  - **Optional Heading:** `Execute Live Writes & Track Consensus`
  - **Instruction:**
    ```text
    Switch to "02 · Pact Desk" and click "Connect Wallet" for MetaMask on StudioNet (Chain 61999) to test 1-click presets ("Flask 3.2 Preset", "Too-Vague Preset", "Flask 3.2 Proof Preset") or "Withdraw Refundable". Open "03 · StudioNet Queue" and click "Load 16 Finalized Proof Txs" to inspect the 5-stage Optimistic Democracy pipeline and StudioNet Explorer links.
    ```

---

## 06. Review Verification — Prove the path works

### Expected Verification Outcome (`373 / 500` chars)
```text
In 01 · Pact Ledger, all 4 pacts and 6 audits load with live RPC parity when clicking Verify Live RPC (contract 0x34e7311ab0AC6884f30EbA0D328Fe523B3C1a15a), Verify SHA-256 in Browser confirms exact WebCrypto snippet_sha256 parity on audit-1 and audit-3, and 03 · StudioNet Queue loads all 16 FINALIZED / MAJORITY_AGREE / SUCCESS StudioNet Explorer transactions.
```

### Contract Link 1 *(Optional)*
```text
https://explorer-studio.genlayer.com/address/0x34e7311ab0AC6884f30EbA0D328Fe523B3C1a15a
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

- **ReleasePact Contract (`0x34e7...a15a`):** `https://explorer-studio.genlayer.com/address/0x34e7311ab0AC6884f30EbA0D328Fe523B3C1a15a`
- **EvidenceProbe Contract (`0x16d0...1b66`):** `https://explorer-studio.genlayer.com/address/0x16d0630E19DaCcA37E2d0056B74Dc15cB2aF1b66`
- **Deploy ReleasePact Tx:** `https://explorer-studio.genlayer.com/tx/0xf90a68b8d73dd0236797b266a1b1a7cab04b829efb2e2d9d49d89386bfa9a668`
- **Sponsor EOA Withdrawal (`0 -> 240 wei`):** `https://explorer-studio.genlayer.com/tx/0x75aa4cfbfce232721e54a4aaadc8e782f0c1f4dc87cca8ce3eb9d36063664e92`
- **Builder EOA Withdrawal (`0 -> 280 wei`):** `https://explorer-studio.genlayer.com/tx/0xd10f2660dc384ff16343f723f3fd4670d4adc5d077e55d6fc564595cf11d1535`
