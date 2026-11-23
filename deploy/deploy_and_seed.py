"""Resumable GenLayer StudioNet deployment & live proof seeder for Release Pact.

Deploys EvidenceProbe + ReleasePact, executes all live multi-tranche, Gate-1,
Gate-2, adversarial prompt-injection, URL-allowlist, expiry-settlement, and
EOA withdrawal transactions, and writes deploy/proof.json.
"""

from __future__ import annotations

import json
import pathlib
import time
from datetime import datetime, timezone
from typing import Any

import requests
from genlayer_py import create_account, create_client
from genlayer_py.chains import studionet
from genlayer_py.types import TransactionStatus

ROOT = pathlib.Path(__file__).resolve().parent.parent
SECRETS_PATH = ROOT / ".secrets.local.json"
STATE_PATH = ROOT / "deploy" / "seed_state.json"
PROOF_PATH = ROOT / "deploy" / "proof.json"

RPC_URL = "https://studio.genlayer.com/api"
EXPLORER_BASE = "https://explorer-studio.genlayer.com"
CHAIN_ID = 61999

FLASK_URL = (
    "https://raw.githubusercontent.com/pallets/flask/"
    "41cb747cd5a9b43da43bf809ad974722542603db/CHANGES.rst"
)
REBUFF_URL = (
    "https://raw.githubusercontent.com/protectai/rebuff/"
    "4d2fe064abf164e7381556d23e48e210080f8afa/python-sdk/tests/test_sdk.py"
)
FORBIDDEN_URL = (
    "https://raw.githubusercontent.com/kanezar3/fake-repo/"
    "41cb747cd5a9b43da43bf809ad974722542603db/CHANGES.rst"
)

BROWSER_HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
}


def rpc_call(method: str, params: list[Any]) -> Any:
    resp = requests.post(
        RPC_URL,
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        headers=BROWSER_HEADERS,
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise RuntimeError(f"RPC {method} error: {data['error']}")
    return data["result"]


def get_eth_balance(address: str) -> int:
    raw = rpc_call("eth_getBalance", [address, "latest"])
    return int(raw, 16) if isinstance(raw, str) else int(raw)


def load_or_create_accounts() -> tuple[Any, Any]:
    if SECRETS_PATH.exists():
        data = json.loads(SECRETS_PATH.read_text(encoding="utf-8"))
        sponsor = create_account(data["sponsor_private_key"])
        builder = create_account(data["builder_private_key"])
        return sponsor, builder

    sponsor = create_account()
    builder = create_account()
    SECRETS_PATH.write_text(
        json.dumps(
            {
                "sponsor_address": sponsor.address,
                "sponsor_private_key": sponsor.key.hex(),
                "builder_address": builder.address,
                "builder_private_key": builder.key.hex(),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return sponsor, builder


def load_state() -> dict[str, Any]:
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {"steps": {}, "contracts": {}}


def save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


def extract_tx_meta(receipt: dict[str, Any], tx_hash: str) -> dict[str, Any]:
    consensus = receipt.get("consensus_data") or {}
    leader_list = consensus.get("leader_receipt") or []
    leader = leader_list[0] if leader_list else {}
    return {
        "tx_hash": tx_hash,
        "explorer_url": f"{EXPLORER_BASE}/tx/{tx_hash}",
        "status": receipt.get("status_name") or receipt.get("status") or "",
        "result_name": receipt.get("result_name") or "",
        "execution_result": leader.get("execution_result") or "",
    }


def wait_finalized(client: Any, tx_hash: str, label: str) -> dict[str, Any]:
    print(f"  [wait] {label} -> {tx_hash}")
    receipt = client.wait_for_transaction_receipt(
        transaction_hash=tx_hash,
        status=TransactionStatus.FINALIZED,
        retries=80,
        interval=8000,
    )
    meta = extract_tx_meta(receipt, tx_hash)
    print(
        f"  [done] {label}: status={meta['status']} "
        f"result={meta['result_name']} exec={meta['execution_result']}"
    )
    if meta["status"] != "FINALIZED":
        raise RuntimeError(f"{label} did not finalize: {meta}")
    if meta["execution_result"] and meta["execution_result"] != "SUCCESS":
        raise RuntimeError(f"{label} execution failed: {meta}")
    return receipt


def run_step(
    state: dict[str, Any],
    key: str,
    label: str,
    fn,
) -> dict[str, Any]:
    if key in state["steps"]:
        print(f"[skip] {key} ({label}) already finalized: {state['steps'][key]['tx_hash']}")
        return state["steps"][key]
    print(f"\n[run] {key}: {label}")
    result = fn()
    state["steps"][key] = result
    save_state(state)
    return result


def main() -> None:
    sponsor, builder = load_or_create_accounts()
    print(f"Sponsor EOA: {sponsor.address}")
    print(f"Builder EOA: {builder.address}")

    sponsor_client = create_client(chain=studionet, account=sponsor)
    builder_client = create_client(chain=studionet, account=builder)
    state = load_state()

    # Stage 0: Deploy EvidenceProbe
    if "evidence_probe" not in state["contracts"]:
        print("\n[deploy] EvidenceProbe ...")
        probe_code = (ROOT / "contracts" / "evidence_probe.py").read_text(encoding="utf-8")
        tx_hash = sponsor_client.deploy_contract(code=probe_code, args=[])
        receipt = wait_finalized(sponsor_client, tx_hash, "deploy EvidenceProbe")
        addr = receipt.get("data", {}).get("contract_address") or receipt.get("to_address")
        state["contracts"]["evidence_probe"] = {
            "address": addr,
            "deploy_tx": extract_tx_meta(receipt, tx_hash),
        }
        save_state(state)
    probe_addr = state["contracts"]["evidence_probe"]["address"]
    print(f"EvidenceProbe: {probe_addr}")

    # Stage 0b: Probe pallets/flask CHANGES.rst L70..L95
    run_step(
        state,
        "probe_flask_310",
        "EvidenceProbe.probe_url_slice(pallets/flask CHANGES.rst L70..L95)",
        lambda: _do_probe(sponsor_client, probe_addr),
    )

    # Stage 1: Deploy ReleasePact
    if "release_pact" not in state["contracts"]:
        print("\n[deploy] ReleasePact ...")
        rp_code = (ROOT / "contracts" / "release_pact.py").read_text(encoding="utf-8")
        tx_hash = sponsor_client.deploy_contract(code=rp_code, args=[100, 20, 900])
        receipt = wait_finalized(sponsor_client, tx_hash, "deploy ReleasePact")
        addr = receipt.get("data", {}).get("contract_address") or receipt.get("to_address")
        state["contracts"]["release_pact"] = {
            "address": addr,
            "deploy_tx": extract_tx_meta(receipt, tx_hash),
        }
        save_state(state)
    rp_addr = state["contracts"]["release_pact"]["address"]
    print(f"ReleasePact:   {rp_addr}")

    # Pact 1: 2-Tranche Feature Release Pact (200 wei)
    run_step(
        state,
        "create_pact_1",
        "create_release_pact(pact-1: 2 tranches on pallets/flask, 200 wei)",
        lambda: _write_tx(
            sponsor_client,
            rp_addr,
            "create_release_pact",
            [
                "Pallets Flask 3.1.x",
                json.dumps(
                    [
                        "Support key rotation with the SECRET_KEY_FALLBACKS config, allowing old secret keys to be used for unsigning.",
                        "Add support for the Partitioned cookie attribute (CHIPS) via the SESSION_COOKIE_PARTITIONED config.",
                    ]
                ),
                "https://raw.githubusercontent.com/pallets/flask/",
                900,
            ],
            value=200,
            label="create_pact_1",
        ),
    )

    # Audit 1: Tranche 0 FEATURE_DELIVERED (Flask 3.1.0 L70..L95)
    run_step(
        state,
        "audit_1_tranche0_delivered",
        "submit_delivery_proof(pact-1, tranche 0, Flask 3.1.0 L70..L95 -> FEATURE_DELIVERED)",
        lambda: _write_tx(
            builder_client,
            rp_addr,
            "submit_delivery_proof",
            ["pact-1", 0, FLASK_URL, 70, 95],
            value=20,
            label="audit_1_tranche0_delivered",
        ),
    )

    # Audit 2: Tranche 1 NOT_DELIVERED (Flask 3.1.2 L44..L53 unrelated fixes)
    run_step(
        state,
        "audit_2_tranche1_not_delivered",
        "submit_delivery_proof(pact-1, tranche 1, Flask 3.1.2 L44..L53 -> NOT_DELIVERED)",
        lambda: _write_tx(
            builder_client,
            rp_addr,
            "submit_delivery_proof",
            ["pact-1", 1, FLASK_URL, 44, 53],
            value=20,
            label="audit_2_tranche1_not_delivered",
        ),
    )

    # Audit 3: Tranche 1 Retry FEATURE_DELIVERED (Flask 3.1.0 L70..L95 -> FULLY_DELIVERED)
    run_step(
        state,
        "audit_3_tranche1_delivered",
        "submit_delivery_proof(pact-1, tranche 1, Flask 3.1.0 L70..L95 -> FEATURE_DELIVERED)",
        lambda: _write_tx(
            builder_client,
            rp_addr,
            "submit_delivery_proof",
            ["pact-1", 1, FLASK_URL, 70, 95],
            value=20,
            label="audit_3_tranche1_delivered",
        ),
    )

    # Pact 2: TOO_VAGUE Gate-1 Rejection (100 wei refunded to Sponsor)
    run_step(
        state,
        "create_pact_2_too_vague",
        "create_release_pact(pact-2: subjective deliverable -> TOO_VAGUE)",
        lambda: _write_tx(
            sponsor_client,
            rp_addr,
            "create_release_pact",
            [
                "Pallets Flask UX",
                json.dumps(
                    [
                        "Make Flask feel dramatically more ergonomic, clean, and joyful for modern developers."
                    ]
                ),
                "https://raw.githubusercontent.com/pallets/flask/",
                900,
            ],
            value=100,
            label="create_pact_2_too_vague",
        ),
    )

    # Pact 3: Security, Retriable Fetch & Prompt-Injection Defense (100 wei)
    run_step(
        state,
        "create_pact_3_security",
        "create_release_pact(pact-3: Flask 3.2.0 app.query, 100 wei)",
        lambda: _write_tx(
            sponsor_client,
            rp_addr,
            "create_release_pact",
            [
                "Pallets Flask 3.2.0",
                json.dumps(
                    [
                        "Add the app.query route decorator for handling the HTTP QUERY method."
                    ]
                ),
                "https://raw.githubusercontent.com/",
                900,
            ],
            value=100,
            label="create_pact_3_security",
        ),
    )

    # Audit 4: UNVERIFIABLE_FETCH (EMPTY_LINE_SLICE L9000..L9020)
    run_step(
        state,
        "audit_4_unverifiable_empty_slice",
        "submit_delivery_proof(pact-3, tranche 0, L9000..L9020 -> UNVERIFIABLE_FETCH)",
        lambda: _write_tx(
            builder_client,
            rp_addr,
            "submit_delivery_proof",
            ["pact-3", 0, FLASK_URL, 9000, 9020],
            value=20,
            label="audit_4_unverifiable_empty_slice",
        ),
    )

    # Audit 5: Prompt-Injection Defense (protectai/rebuff L1..L30)
    run_step(
        state,
        "audit_5_adversarial_injection",
        "submit_delivery_proof(pact-3, tranche 0, protectai/rebuff L1..L30 -> injection ignored)",
        lambda: _write_tx(
            builder_client,
            rp_addr,
            "submit_delivery_proof",
            ["pact-3", 0, REBUFF_URL, 1, 30],
            value=20,
            label="audit_5_adversarial_injection",
        ),
    )

    # Audit 6: Forbidden Self-Hosted URL (kanezar3 -> REJECTED_INVALID, zero revert, stake refunded)
    run_step(
        state,
        "audit_6_forbidden_url",
        "submit_delivery_proof(pact-3, tranche 0, kanezar3 URL -> REJECTED_INVALID)",
        lambda: _write_tx(
            builder_client,
            rp_addr,
            "submit_delivery_proof",
            ["pact-3", 0, FORBIDDEN_URL, 1, 10],
            value=20,
            label="audit_6_forbidden_url",
        ),
    )

    # Pact 4: Short-Window Expiry Settlement (timeout_seconds=15)
    run_step(
        state,
        "create_pact_4_expiry",
        "create_release_pact(pact-4: timeout_seconds=15, 100 wei)",
        lambda: _write_tx(
            sponsor_client,
            rp_addr,
            "create_release_pact",
            [
                "Pallets Flask 3.2.0 Expiry Window",
                json.dumps(
                    [
                        "Add the app.query route decorator for handling the HTTP QUERY method."
                    ]
                ),
                "https://raw.githubusercontent.com/pallets/flask/",
                15,
            ],
            value=100,
            label="create_pact_4_expiry",
        ),
    )

    if "settle_pact_4_expired" not in state["steps"]:
        print("  [wait] Sleeping 22s so pact-4 passes its 15s trusted-clock deadline...")
        time.sleep(22)

    run_step(
        state,
        "settle_pact_4_expired",
        "settle_expired_pact(pact-4 -> EXPIRED_SETTLED)",
        lambda: _write_tx(
            sponsor_client,
            rp_addr,
            "settle_expired_pact",
            ["pact-4"],
            value=0,
            label="settle_pact_4_expired",
        ),
    )

    # Real EOA native withdrawals
    run_step(
        state,
        "withdraw_sponsor",
        "withdraw_refundable() from Sponsor EOA",
        lambda: _do_withdraw(sponsor_client, rp_addr, sponsor.address, "sponsor"),
    )

    run_step(
        state,
        "withdraw_builder",
        "withdraw_refundable() from Builder EOA",
        lambda: _do_withdraw(builder_client, rp_addr, builder.address, "builder"),
    )

    # Read final canonical on-chain state
    print("\n[snapshot] Reading canonical on-chain state from ReleasePact & EvidenceProbe...")
    last_probe_raw = sponsor_client.read_contract(
        address=probe_addr, function_name="get_last_probe", args=[]
    )
    config_raw = sponsor_client.read_contract(
        address=rp_addr, function_name="get_config", args=[]
    )
    pacts_raw = sponsor_client.read_contract(
        address=rp_addr, function_name="list_pacts", args=[]
    )
    audits_raw = sponsor_client.read_contract(
        address=rp_addr, function_name="list_audits", args=[]
    )
    sponsor_rem = int(
        sponsor_client.read_contract(
            address=rp_addr,
            function_name="get_refundable_balance",
            args=[sponsor.address],
        )
    )
    builder_rem = int(
        sponsor_client.read_contract(
            address=rp_addr,
            function_name="get_refundable_balance",
            args=[builder.address],
        )
    )

    proof = {
        "project": "Release Pact",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "network": {
            "name": "GenLayer StudioNet",
            "chain_id": CHAIN_ID,
            "rpc_url": RPC_URL,
            "explorer_base": EXPLORER_BASE,
        },
        "accounts": {
            "sponsor": sponsor.address,
            "builder": builder.address,
        },
        "contracts": {
            "evidence_probe": {
                "address": probe_addr,
                "explorer_url": f"{EXPLORER_BASE}/address/{probe_addr}",
                "deploy_tx": state["contracts"]["evidence_probe"]["deploy_tx"],
            },
            "release_pact": {
                "address": rp_addr,
                "explorer_url": f"{EXPLORER_BASE}/address/{rp_addr}",
                "deploy_tx": state["contracts"]["release_pact"]["deploy_tx"],
            },
        },
        "transactions": state["steps"],
        "on_chain_state": {
            "evidence_probe": json.loads(last_probe_raw) if last_probe_raw else {},
            "config": json.loads(config_raw),
            "pacts": json.loads(pacts_raw),
            "audits": json.loads(audits_raw),
            "post_withdraw_refundable_balances": {
                "sponsor_wei": sponsor_rem,
                "builder_wei": builder_rem,
            },
        },
    }

    PROOF_PATH.write_text(json.dumps(proof, indent=2), encoding="utf-8")
    print(f"\n[OK] Wrote complete StudioNet proof manifest to {PROOF_PATH}")
    print(
        f"     Pacts={len(proof['on_chain_state']['pacts'])} "
        f"Audits={len(proof['on_chain_state']['audits'])} "
        f"SponsorRem={sponsor_rem} BuilderRem={builder_rem}"
    )


def _do_probe(client: Any, probe_addr: str) -> dict[str, Any]:
    tx_hash = client.write_contract(
        address=probe_addr,
        function_name="probe_url_slice",
        args=[FLASK_URL, 70, 95],
        value=0,
    )
    receipt = wait_finalized(client, tx_hash, "probe_flask_310")
    return extract_tx_meta(receipt, tx_hash)


def _write_tx(
    client: Any,
    address: str,
    function_name: str,
    args: list[Any],
    value: int,
    label: str,
) -> dict[str, Any]:
    tx_hash = client.write_contract(
        address=address,
        function_name=function_name,
        args=args,
        value=value,
    )
    receipt = wait_finalized(client, tx_hash, label)
    meta = extract_tx_meta(receipt, tx_hash)
    meta["function"] = function_name
    meta["value_wei"] = value
    return meta


def _do_withdraw(
    client: Any, rp_addr: str, account_addr: str, role: str
) -> dict[str, Any]:
    pending_before = int(
        client.read_contract(
            address=rp_addr,
            function_name="get_refundable_balance",
            args=[account_addr],
        )
    )
    eth_before = get_eth_balance(account_addr)
    tx_hash = client.write_contract(
        address=rp_addr,
        function_name="withdraw_refundable",
        args=[],
        value=0,
    )
    receipt = wait_finalized(client, tx_hash, f"withdraw_{role}")
    pending_after = int(
        client.read_contract(
            address=rp_addr,
            function_name="get_refundable_balance",
            args=[account_addr],
        )
    )
    eth_after = get_eth_balance(account_addr)
    meta = extract_tx_meta(receipt, tx_hash)
    meta.update(
        {
            "function": "withdraw_refundable",
            "account": account_addr,
            "withdrawn_wei": pending_before - pending_after,
            "refundable_before_wei": pending_before,
            "refundable_after_wei": pending_after,
            "eoa_balance_before_wei": str(eth_before),
            "eoa_balance_after_wei": str(eth_after),
        }
    )
    return meta


if __name__ == "__main__":
    main()
