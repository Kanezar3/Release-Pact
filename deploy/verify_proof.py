"""Independent verifier for deploy/proof.json against live GenLayer StudioNet RPC."""

from __future__ import annotations

import json
import pathlib
import sys
from typing import Any

import requests
from genlayer_py import create_account, create_client
from genlayer_py.chains import studionet

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROOF_PATH = ROOT / "deploy" / "proof.json"
RPC_URL = "https://studio.genlayer.com/api"
HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
}


def rpc(method: str, params: list[Any]) -> Any:
    r = requests.post(
        RPC_URL,
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        headers=HEADERS,
        timeout=60,
    )
    r.raise_for_status()
    data = r.json()
    if "error" in data:
        raise RuntimeError(f"RPC {method} error: {data['error']}")
    return data["result"]


def main() -> int:
    proof = json.loads(PROOF_PATH.read_text(encoding="utf-8"))
    rp_addr = proof["contracts"]["release_pact"]["address"]
    probe_addr = proof["contracts"]["evidence_probe"]["address"]

    tx_hashes: list[tuple[str, str]] = [
        ("deploy_evidence_probe", proof["contracts"]["evidence_probe"]["deploy_tx"]["tx_hash"]),
        ("deploy_release_pact", proof["contracts"]["release_pact"]["deploy_tx"]["tx_hash"]),
    ]
    for name, info in proof["transactions"].items():
        tx_hashes.append((name, info["tx_hash"]))

    print(f"Verifying {len(tx_hashes)} transactions on GenLayer StudioNet...")
    failures = 0
    for name, h in tx_hashes:
        tx = rpc("eth_getTransactionByHash", [h])
        if not tx:
            print(f"  [FAIL] {name}: {h} not found")
            failures += 1
            continue
        status = tx.get("status_name") or tx.get("status")
        result_name = tx.get("result_name") or ""
        leaders = (tx.get("consensus_data") or {}).get("leader_receipt") or []
        exec_res = leaders[0].get("execution_result") if leaders else ""
        ok = status == "FINALIZED" and (not exec_res or exec_res == "SUCCESS")
        tag = "OK  " if ok else "FAIL"
        print(f"  [{tag}] {name:34s} {h[:14]}... status={status} result={result_name} exec={exec_res}")
        if not ok:
            failures += 1

    print("\nVerifying live contract read parity...")
    client = create_client(chain=studionet, account=create_account())
    live_pacts = json.loads(client.read_contract(address=rp_addr, function_name="list_pacts", args=[]))
    live_audits = json.loads(client.read_contract(address=rp_addr, function_name="list_audits", args=[]))
    live_probe = json.loads(client.read_contract(address=probe_addr, function_name="get_last_probe", args=[]))

    pacts_by_id = {p["pact_id"]: p for p in live_pacts}
    audits_by_id = {a["audit_id"]: a for a in live_audits}

    checks = [
        ("EvidenceProbe ok", live_probe.get("ok") is True and len(live_probe.get("snippet_sha256", "")) == 64),
        ("pact-1 FULLY_DELIVERED", pacts_by_id.get("pact-1", {}).get("status") == "FULLY_DELIVERED"),
        ("pact-2 TOO_VAGUE", pacts_by_id.get("pact-2", {}).get("status") == "TOO_VAGUE"),
        ("pact-3 OPEN (retriable after non-conclusive audits)", pacts_by_id.get("pact-3", {}).get("status") == "OPEN"),
        ("pact-4 EXPIRED_SETTLED", pacts_by_id.get("pact-4", {}).get("status") == "EXPIRED_SETTLED"),
        ("audit-1 FEATURE_DELIVERED", audits_by_id.get("audit-1", {}).get("verdict") == "FEATURE_DELIVERED"),
        ("audit-2 NOT_DELIVERED", audits_by_id.get("audit-2", {}).get("verdict") == "NOT_DELIVERED"),
        ("audit-3 FEATURE_DELIVERED", audits_by_id.get("audit-3", {}).get("verdict") == "FEATURE_DELIVERED"),
        ("audit-4 UNVERIFIABLE_FETCH", audits_by_id.get("audit-4", {}).get("verdict") == "UNVERIFIABLE_FETCH"),
        (
            "audit-5 injection blocked",
            audits_by_id.get("audit-5", {}).get("verdict") in ("INSUFFICIENT_EVIDENCE", "NOT_DELIVERED"),
        ),
        (
            "audit-6 FORBIDDEN_EVIDENCE_URL",
            audits_by_id.get("audit-6", {}).get("verdict") == "REJECTED_INVALID"
            and audits_by_id.get("audit-6", {}).get("reason") == "FORBIDDEN_EVIDENCE_URL",
        ),
    ]
    for label, passed in checks:
        print(f"  [{'OK  ' if passed else 'FAIL'}] {label}")
        if not passed:
            failures += 1

    print(f"\nSummary: {len(tx_hashes)} txs checked, {len(checks)} state invariants checked, {failures} failures.")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
