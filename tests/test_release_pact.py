"""Unit tests for ReleasePact & EvidenceProbe (no personal handles, strict repo-prefix & anti-griefing)."""

from __future__ import annotations

import importlib.util
import json
import pathlib
import sys
import types
from dataclasses import dataclass
from typing import Any

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent


class _MockUserError(Exception):
    pass


@dataclass
class _MockReturn:
    calldata: Any


class _MockAddress:
    def __init__(self, hex_val: str):
        self.as_hex = hex_val

    def __str__(self) -> str:
        return self.as_hex


class _MockTreeMap(dict):
    def __class_getitem__(cls, item):
        return cls


class _MockDynArray(list):
    def __class_getitem__(cls, item):
        return cls


class _MockGenLayerHarness:
    def __init__(self) -> None:
        self.sender = "0x1111111111111111111111111111111111111111"
        self.value = 0
        self.datetime_iso = "2026-11-23T10:00:00Z"
        self.web_responses: dict[str, tuple[int, str]] = {}
        self.prompt_queue: list[str] = []
        self.emitted_transfers: list[tuple[str, int]] = []
        self.return_bytes_calldata = False

    def install(self) -> None:
        gl_mod = types.ModuleType("genlayer")

        class _Message:
            @property
            def sender_address(inner_self):
                return _MockAddress(self.sender)

            @property
            def value(inner_self):
                return self.value

        class _Web:
            def get(inner_self, url: str, headers: dict | None = None):
                status, body = self.web_responses.get(url, (404, ""))
                return types.SimpleNamespace(status=status, body=body.encode("utf-8"))

        class _NonDet:
            web = _Web()

            def exec_prompt(inner_self, prompt: str, response_format: str = "text"):
                if not self.prompt_queue:
                    raise RuntimeError("No mocked LLM response queued")
                return self.prompt_queue.pop(0)

        class _Calldata:
            @staticmethod
            def decode(raw):
                if isinstance(raw, (bytes, bytearray, memoryview)):
                    return bytes(raw).decode("utf-8")
                raise TypeError("expected bytes")

        class _VM:
            UserError = _MockUserError
            Return = _MockReturn
            Result = object

            def run_nondet_unsafe(inner_self, leader_fn, validator_fn):
                res = leader_fn()
                payload = res.encode("utf-8") if self.return_bytes_calldata else res
                ok = validator_fn(_MockReturn(calldata=payload))
                assert ok is True, "Validator disagreed with leader"
                return res

        class _EVM:
            def contract_interface(inner_self, cls):
                harness = self

                class _Proxy:
                    def __init__(proxy_self, addr):
                        proxy_self.addr = str(addr)

                    def emit_transfer(proxy_self, value: int):
                        harness.emitted_transfers.append((proxy_self.addr.lower(), int(value)))

                return _Proxy

        class _Public:
            @staticmethod
            def write(fn):
                return fn

            @staticmethod
            def view(fn):
                return fn

        _Public.write.payable = staticmethod(lambda fn: fn)

        class _Contract:
            def __init_subclass__(cls, **kwargs):
                super().__init_subclass__(**kwargs)

        gl_ns = types.SimpleNamespace(
            Contract=_Contract,
            public=_Public,
            message=_Message(),
            message_raw={"datetime": self.datetime_iso},
            nondet=_NonDet(),
            vm=_VM(),
            calldata=_Calldata(),
            evm=_EVM(),
        )

        # Keep message_raw live-updated
        class _DynamicGL:
            def __getattr__(inner_self, name):
                if name == "message_raw":
                    return {"datetime": self.datetime_iso} if self.datetime_iso is not None else {}
                return getattr(gl_ns, name)

        gl_mod.gl = _DynamicGL()
        gl_mod.Address = _MockAddress
        gl_mod.u256 = int
        gl_mod.TreeMap = _MockTreeMap
        gl_mod.DynArray = _MockDynArray
        sys.modules["genlayer"] = gl_mod


def _load_module(name: str, rel_path: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel_path)
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)
    return mod


def _make_contract():
    h = _MockGenLayerHarness()
    h.install()
    rp_mod = _load_module("release_pact_mod", "contracts/release_pact.py")
    probe_mod = _load_module("evidence_probe_mod", "contracts/evidence_probe.py")

    rp = rp_mod.ReleasePact.__new__(rp_mod.ReleasePact)
    rp.pacts = _MockTreeMap()
    rp.pact_ids = _MockDynArray()
    rp.audits = _MockTreeMap()
    rp.audit_ids = _MockDynArray()
    rp.refundable_balances = _MockTreeMap()
    rp.__init__(min_tranche_wei=100, min_stake_wei=20, default_timeout_seconds=900)

    probe = probe_mod.EvidenceProbe.__new__(probe_mod.EvidenceProbe)
    probe.__init__()
    return h, rp_mod, rp, probe


FLASK_URL = (
    "https://raw.githubusercontent.com/pallets/flask/"
    "41cb747cd5a9b43da43bf809ad974722542603db/CHANGES.rst"
)
REBUFF_URL = (
    "https://raw.githubusercontent.com/protectai/rebuff/"
    "4d2fe064abf164e7381556d23e48e210080f8afa/python-sdk/tests/test_sdk.py"
)


def test_1_fail_closed_trusted_clock():
    h, rp_mod, _, _ = _make_contract()
    h.datetime_iso = ""
    with pytest.raises(_MockUserError, match="TRUSTED_TIME_UNAVAILABLE"):
        rp_mod._now_ts()


def test_2_strict_repo_prefix_and_no_mutable_refs():
    _, rp_mod, _, _ = _make_contract()
    # Wildcard GitHub host prefix must be rejected
    assert rp_mod._validate_source_prefix("https://raw.githubusercontent.com/") == "UNSCOPED_GITHUB_PREFIX"
    assert rp_mod._validate_source_prefix("https://raw.githubusercontent.com/pallets/flask") == "UNSCOPED_GITHUB_PREFIX"
    assert rp_mod._validate_source_prefix("https://raw.githubusercontent.com/pallets/flask/") == ""

    # Cross-repo URL rejected cleanly
    assert (
        rp_mod._validate_evidence_url(REBUFF_URL, "https://raw.githubusercontent.com/pallets/flask/")
        == "URL_OUTSIDE_ALLOWED_PREFIX"
    )
    # Mutable branch ref rejected cleanly
    assert (
        rp_mod._validate_evidence_url(
            "https://raw.githubusercontent.com/pallets/flask/main/CHANGES.rst",
            "https://raw.githubusercontent.com/pallets/flask/",
        )
        == "MUTABLE_GITHUB_REF"
    )
    assert (
        rp_mod._validate_evidence_url(FLASK_URL, "https://raw.githubusercontent.com/pallets/flask/")
        == ""
    )


def test_3_probe_and_excerpt_around_quote():
    h, rp_mod, _, probe = _make_contract()
    long_doc = ("A" * 900) + "\n- Support SECRET_KEY_FALLBACKS rotation.\n" + ("B" * 900)
    excerpt = rp_mod._excerpt_around_quote(long_doc, "- Support SECRET_KEY_FALLBACKS rotation.", 400)
    assert "- Support SECRET_KEY_FALLBACKS rotation." in excerpt
    assert len(excerpt) <= 400

    h.web_responses[FLASK_URL] = (200, "Line 1\nSupport SECRET_KEY_FALLBACKS\nLine 3\n")
    for use_bytes in (False, True):
        h.return_bytes_calldata = use_bytes
        out = json.loads(probe.probe_url_slice(FLASK_URL, 1, 3))
        assert out["ok"] is True
        assert len(out["snippet_sha256"]) == 64


def test_4_gate1_refunds_on_invalid_and_too_vague():
    h, _, rp, _ = _make_contract()
    sponsor = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    h.sender = sponsor
    h.value = 100

    # Invalid unscoped prefix refunds immediately
    r_bad = json.loads(
        rp.create_release_pact(
            "Flask", json.dumps(["Add app.query"]), "https://raw.githubusercontent.com/", 900
        )
    )
    assert r_bad["status"] == "REJECTED_INVALID"
    assert r_bad["reason"] == "UNSCOPED_GITHUB_PREFIX"
    assert rp.get_refundable_balance(sponsor) == 100

    # TOO_VAGUE refunds immediately
    h.prompt_queue = [
        json.dumps({"verdict": "TOO_VAGUE", "reason": "SUBJECTIVE_OR_UNMEASURABLE"}),
        json.dumps({"verdict": "TOO_VAGUE", "reason": "SUBJECTIVE_OR_UNMEASURABLE"}),
    ]
    r_vague = json.loads(
        rp.create_release_pact(
            "Flask UX",
            json.dumps(["Make Flask super clean and joyful"]),
            "https://raw.githubusercontent.com/pallets/flask/",
            900,
        )
    )
    assert r_vague["status"] == "TOO_VAGUE"
    assert rp.get_refundable_balance(sponsor) == 200


def test_5_sponsor_self_griefing_blocked_and_per_builder_caps():
    h, _, rp, _ = _make_contract()
    sponsor = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    builder1 = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    builder2 = "0xcccccccccccccccccccccccccccccccccccccccc"

    h.sender = sponsor
    h.value = 100
    h.prompt_queue = [
        json.dumps({"verdict": "OBSERVABLE_DELIVERABLE", "reason": "CONCRETE_FEATURE_CRITERION"}),
        json.dumps({"verdict": "OBSERVABLE_DELIVERABLE", "reason": "CONCRETE_FEATURE_CRITERION"}),
    ]
    p = json.loads(
        rp.create_release_pact(
            "Flask 3.1",
            json.dumps(["Support SECRET_KEY_FALLBACKS"]),
            "https://raw.githubusercontent.com/pallets/flask/",
            900,
            "2024-11-01",
        )
    )
    assert p["status"] == "OPEN"

    # Sponsor cannot self-submit to grief attempts
    h.sender = sponsor
    h.value = 20
    self_try = json.loads(rp.submit_delivery_proof("pact-1", 0, FLASK_URL, 1, 5))
    assert self_try["verdict"] == "REJECTED_INVALID"
    assert self_try["reason"] == "SPONSOR_CANNOT_SUBMIT_PROOF"
    assert rp.get_refundable_balance(sponsor) == 20
    assert json.loads(rp.get_pact("pact-1"))["tranches"][0]["audit_attempts"] == 0

    # Builder 1 exhausts their 3 attempts; Builder 2 can STILL succeed!
    h.web_responses[FLASK_URL] = (200, "Released 2024-11-13\nSupport SECRET_KEY_FALLBACKS rotation.\n")
    h.sender = builder1
    for _ in range(3):
        h.value = 20
        h.prompt_queue = [
            json.dumps({"verdict": "NOT_DELIVERED", "reason": "ONLY_UNRELATED_FIXES", "quote": "", "summary": "No"}),
            json.dumps({"verdict": "NOT_DELIVERED", "reason": "ONLY_UNRELATED_FIXES", "quote": "", "summary": "No"}),
        ]
        a = json.loads(rp.submit_delivery_proof("pact-1", 0, FLASK_URL, 1, 2))
        assert a["verdict"] == "NOT_DELIVERED"

    # 4th attempt by builder1 rejected cleanly without locking tranche
    h.value = 20
    blocked = json.loads(rp.submit_delivery_proof("pact-1", 0, FLASK_URL, 1, 2))
    assert blocked["reason"] == "BUILDER_ATTEMPT_LIMIT_REACHED"
    assert rp.get_refundable_balance(builder1) == 20

    # Honest builder2 still unlocks tranche!
    h.sender = builder2
    h.value = 20
    h.prompt_queue = [
        json.dumps({
            "verdict": "FEATURE_DELIVERED",
            "reason": "EXPLICIT_RELEASE_NOTE_MATCH",
            "quote": "Support SECRET_KEY_FALLBACKS rotation.",
            "summary": "Delivered.",
        }),
        json.dumps({
            "verdict": "FEATURE_DELIVERED",
            "reason": "EXPLICIT_RELEASE_NOTE_MATCH",
            "quote": "Support SECRET_KEY_FALLBACKS rotation.",
            "summary": "Delivered.",
        }),
    ]
    win = json.loads(rp.submit_delivery_proof("pact-1", 0, FLASK_URL, 1, 2))
    assert win["verdict"] == "FEATURE_DELIVERED"
    assert win["quote"] in win["snippet_excerpt"]
    assert rp.get_refundable_balance(builder2) == 120


def test_6_two_tranche_partial_expiry_and_withdraw_transfer():
    h, _, rp, _ = _make_contract()
    sponsor = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    builder = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

    h.sender = sponsor
    h.value = 200
    h.prompt_queue = [
        json.dumps({"verdict": "OBSERVABLE_DELIVERABLE", "reason": "CONCRETE_FEATURE_CRITERION"}),
        json.dumps({"verdict": "OBSERVABLE_DELIVERABLE", "reason": "CONCRETE_FEATURE_CRITERION"}),
    ]
    rp.create_release_pact(
        "Flask 3.1",
        json.dumps(["Support SECRET_KEY_FALLBACKS", "Support SESSION_COOKIE_PARTITIONED"]),
        "https://raw.githubusercontent.com/pallets/flask/",
        30,
        "2024-11-01",
    )

    h.web_responses[FLASK_URL] = (200, "Support SECRET_KEY_FALLBACKS config rotation.\n")
    h.sender = builder
    h.value = 20
    h.prompt_queue = [
        json.dumps({
            "verdict": "FEATURE_DELIVERED",
            "reason": "EXPLICIT_RELEASE_NOTE_MATCH",
            "quote": "Support SECRET_KEY_FALLBACKS config rotation.",
            "summary": "Shipped.",
        }),
        json.dumps({
            "verdict": "FEATURE_DELIVERED",
            "reason": "EXPLICIT_RELEASE_NOTE_MATCH",
            "quote": "Support SECRET_KEY_FALLBACKS config rotation.",
            "summary": "Shipped.",
        }),
    ]
    rp.submit_delivery_proof("pact-1", 0, FLASK_URL, 1, 2)
    assert json.loads(rp.get_pact("pact-1"))["status"] == "PARTIALLY_DELIVERED"

    # Advance trusted clock past 30s deadline
    h.datetime_iso = "2026-11-23T10:01:00Z"
    settled = json.loads(rp.settle_expired_pact("pact-1"))
    assert settled["status"] == "EXPIRED_SETTLED"
    assert settled["remaining_wei"] == 0
    assert settled["refunded_wei"] == 100
    assert rp.get_refundable_balance(sponsor) == 100

    # Withdraw emits real EOA transfers
    h.sender = builder
    w_b = json.loads(rp.withdraw_refundable())
    assert w_b["withdrawn_wei"] == 120
    assert w_b["settlement_stage"] == "ON_FINALIZED"
    assert rp.get_refundable_balance(builder) == 0

    h.sender = sponsor
    w_s = json.loads(rp.withdraw_refundable())
    assert w_s["withdrawn_wei"] == 100
    assert (builder, 120) in h.emitted_transfers
    assert (sponsor, 100) in h.emitted_transfers
