import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import types
import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONTRACT_PATH = PROJECT_ROOT / "contracts" / "release_pact.py"
PROBE_PATH = PROJECT_ROOT / "contracts" / "evidence_probe.py"


class MockUserError(Exception):
    pass


class MockAddress:
    def __init__(self, hex_addr: str):
        self.as_hex = hex_addr.lower()

    def __str__(self) -> str:
        return self.as_hex


class MockTreeMap(dict):
    pass


class MockDynArray(list):
    pass


class MockWebResponse:
    def __init__(self, status: int, body: bytes):
        self.status = status
        self.body = body


class MockReturn:
    def __init__(self, calldata):
        self.calldata = calldata


class MockContractProxy:
    def __init__(self, target):
        self.target = target

    def emit_transfer(self, value: int, on: str = "finalized") -> None:
        MockRuntime.transfers.append(
            {"to": str(self.target), "value": int(value), "on": on}
        )


class MockRuntime:
    sender = MockAddress("0x1111111111111111111111111111111111111111")
    value = 0
    datetime_str = "2026-11-23T10:00:00Z"
    web_responses: dict[str, MockWebResponse] = {}
    prompt_handler = None
    transfers: list[dict] = []
    return_bytes = False

    @classmethod
    def reset(cls) -> None:
        cls.sender = MockAddress("0x1111111111111111111111111111111111111111")
        cls.value = 0
        cls.datetime_str = "2026-11-23T10:00:00Z"
        cls.web_responses = {}
        cls.prompt_handler = None
        cls.transfers = []
        cls.return_bytes = False


def _install_mock_genlayer():
    gl_mod = types.ModuleType("genlayer")

    class _BaseContract:
        pass

    def _identity(fn):
        return fn

    class _PublicWrite:
        def __call__(self, fn):
            return fn

        def payable(self, fn):
            return fn

    def _run_nondet_unsafe(leader_fn, validator_fn):
        res = leader_fn()
        payload = res.encode("utf-8") if (MockRuntime.return_bytes and isinstance(res, str)) else res
        if not validator_fn(MockReturn(payload)):
            raise RuntimeError("VALIDATOR_REJECTED_LEADER")
        return res

    gl_mod.Contract = _BaseContract
    gl_mod.public = types.SimpleNamespace(view=_identity, write=_PublicWrite())
    gl_mod.vm = types.SimpleNamespace(
        UserError=MockUserError,
        Result=MockReturn,
        Return=MockReturn,
        run_nondet_unsafe=_run_nondet_unsafe,
    )
    gl_mod.calldata = types.SimpleNamespace(
        decode=lambda data: data.decode("utf-8") if isinstance(data, (bytes, bytearray)) else data
    )
    gl_mod.evm = types.SimpleNamespace(contract_interface=lambda cls: MockContractProxy)

    def _web_get(url: str, headers=None):
        return MockRuntime.web_responses.get(url, MockWebResponse(404, b"Not Found"))

    def _exec_prompt(prompt: str, images=None, response_format=None):
        if MockRuntime.prompt_handler is None:
            raise RuntimeError("prompt_handler not configured")
        return MockRuntime.prompt_handler(prompt, response_format)

    gl_mod.nondet = types.SimpleNamespace(
        web=types.SimpleNamespace(get=_web_get),
        exec_prompt=_exec_prompt,
    )

    class _DynamicMessage:
        @property
        def sender_address(self):
            return MockRuntime.sender

        @property
        def value(self):
            return MockRuntime.value

    class _DynamicMessageRaw:
        def get(self, key, default=None):
            return MockRuntime.datetime_str if key == "datetime" else default

    gl_mod.message = _DynamicMessage()
    gl_mod.message_raw = _DynamicMessageRaw()

    module_obj = types.ModuleType("genlayer")
    module_obj.gl = gl_mod
    module_obj.Address = MockAddress
    module_obj.u256 = int
    module_obj.TreeMap = MockTreeMap
    module_obj.DynArray = MockDynArray
    sys.modules["genlayer"] = module_obj

    spec_rp = importlib.util.spec_from_file_location("release_pact_contract", CONTRACT_PATH)
    rp_mod = importlib.util.module_from_spec(spec_rp)
    spec_rp.loader.exec_module(rp_mod)

    spec_ep = importlib.util.spec_from_file_location("evidence_probe_contract", PROBE_PATH)
    ep_mod = importlib.util.module_from_spec(spec_ep)
    spec_ep.loader.exec_module(ep_mod)
    return rp_mod, ep_mod


rp, ep = _install_mock_genlayer()

FLASK_PREFIX = "https://raw.githubusercontent.com/pallets/flask/"
FLASK_URL = (
    "https://raw.githubusercontent.com/pallets/flask/"
    "41cb747cd5a9b43da43bf809ad974722542603db/CHANGES.rst"
)


def _new_contract(min_tranche: int = 100, min_stake: int = 20, timeout: int = 900):
    MockRuntime.reset()
    c = rp.ReleasePact(
        min_tranche_wei=min_tranche,
        min_stake_wei=min_stake,
        default_timeout_seconds=timeout,
    )
    c.pacts = MockTreeMap()
    c.pact_ids = MockDynArray()
    c.audits = MockTreeMap()
    c.audit_ids = MockDynArray()
    c.refundable_balances = MockTreeMap()
    return c


def _gate1_ok(prompt, fmt):
    return {"verdict": "OBSERVABLE_DELIVERABLE", "reason": "CONCRETE_FEATURE_CRITERION"}


def _gate1_vague(prompt, fmt):
    return {"verdict": "TOO_VAGUE", "reason": "SUBJECTIVE_OR_UNMEASURABLE"}


def test_1_fail_closed_trusted_clock():
    c = _new_contract()
    MockRuntime.datetime_str = ""
    with pytest.raises(MockUserError, match="TRUSTED_TIME_UNAVAILABLE"):
        c.create_release_pact("Flask", json.dumps(["Add feature X"]), FLASK_PREFIX, 900)


def test_2_url_allowlist_and_forbidden_tokens():
    assert rp._validate_evidence_url(FLASK_URL, FLASK_PREFIX) == ""
    assert rp._validate_evidence_url(
        "https://raw.githubusercontent.com/pallets/flask/main/CHANGES.rst", FLASK_PREFIX
    ) == "MUTABLE_GITHUB_REF"
    assert rp._validate_evidence_url(
        "https://raw.githubusercontent.com/kanezar3/Release-Pact/41cb747cd5a9b43da43bf809ad974722542603db/a.txt",
        "https://raw.githubusercontent.com/",
    ) == "FORBIDDEN_EVIDENCE_URL"
    assert rp._validate_evidence_url(
        "https://raw.githubusercontent.com/other/repo/41cb747cd5a9b43da43bf809ad974722542603db/a.txt",
        FLASK_PREFIX,
    ) == "URL_OUTSIDE_ALLOWED_PREFIX"


def test_3_probe_and_both_str_and_bytes_calldata():
    raw = "Line 1\r\nLine 2: \u201cSECRET_KEY_FALLBACKS\u201d \u2014 key rotation\r\n"
    MockRuntime.web_responses[FLASK_URL] = MockWebResponse(200, raw.encode("utf-8"))
    probe = ep.EvidenceProbe()
    for use_bytes in (False, True):
        MockRuntime.return_bytes = use_bytes
        out = json.loads(probe.probe_url_slice(FLASK_URL, 2, 2))
        assert out["ok"] is True
        assert out["snippet"] == 'Line 2: "SECRET_KEY_FALLBACKS" - key rotation'


def test_4_gate1_refunds_on_invalid_and_too_vague():
    c = _new_contract()
    sponsor = MockAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    MockRuntime.sender = sponsor

    MockRuntime.value = 150
    bad = json.loads(c.create_release_pact("Flask", "not-json", FLASK_PREFIX, 900))
    assert bad["status"] == "REJECTED_INVALID"
    assert c.get_refundable_balance(str(sponsor)) == 150

    # 2 tranches require >= 200 wei
    MockRuntime.value = 120
    low = json.loads(c.create_release_pact("Flask", json.dumps(["A", "B"]), FLASK_PREFIX, 900))
    assert low["reason"] == "INSUFFICIENT_PACT_DEPOSIT"
    assert c.get_refundable_balance(str(sponsor)) == 270

    # TOO_VAGUE -> immediate refund
    MockRuntime.value = 100
    MockRuntime.prompt_handler = _gate1_vague
    vague = json.loads(c.create_release_pact("Flask", json.dumps(["Make it joyful"]), FLASK_PREFIX, 900))
    assert vague["status"] == "TOO_VAGUE"
    assert vague["reason"] == "SUBJECTIVE_OR_UNMEASURABLE"
    assert c.get_refundable_balance(str(sponsor)) == 370


def test_5_two_tranche_delivery_and_partial_expiry_conservation():
    c = _new_contract()
    sponsor = MockAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    builder = MockAddress("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")

    MockRuntime.sender = sponsor
    MockRuntime.value = 200
    MockRuntime.datetime_str = "2026-11-23T10:00:00Z"
    MockRuntime.prompt_handler = _gate1_ok
    pact = json.loads(
        c.create_release_pact(
            "Flask",
            json.dumps(["Support SECRET_KEY_FALLBACKS", "Support SESSION_COOKIE_PARTITIONED"]),
            FLASK_PREFIX,
            600,
        )
    )
    pid = pact["pact_id"]
    assert pact["status"] == "OPEN"
    assert len(pact["tranches"]) == 2
    assert pact["tranches"][0]["tranche_wei"] == 100

    # Deliver Tranche 0 -> PARTIALLY_DELIVERED, builder credited 120 wei
    MockRuntime.web_responses[FLASK_URL] = MockWebResponse(
        200, b"Support key rotation with the SECRET_KEY_FALLBACKS config."
    )
    MockRuntime.sender = builder
    MockRuntime.value = 20
    MockRuntime.prompt_handler = lambda p, f: {
        "verdict": "FEATURE_DELIVERED",
        "reason": "EXPLICIT_RELEASE_NOTE_MATCH",
        "quote": "Support key rotation with the SECRET_KEY_FALLBACKS config.",
        "summary": "Key rotation delivered.",
    }
    a1 = json.loads(c.submit_delivery_proof(pid, 0, FLASK_URL, 1, 5))
    assert a1["verdict"] == "FEATURE_DELIVERED"
    assert a1["payout_wei"] == 120
    assert c.get_refundable_balance(str(builder)) == 120
    p_mid = json.loads(c.get_pact(pid))
    assert p_mid["status"] == "PARTIALLY_DELIVERED"
    assert p_mid["remaining_wei"] == 100

    # Expire after deadline -> only undelivered Tranche 1 (100 wei) returned to Sponsor
    MockRuntime.datetime_str = "2026-11-23T10:15:00Z"
    settled = json.loads(c.settle_expired_pact(pid))
    assert settled["status"] == "EXPIRED_SETTLED"
    assert settled["remaining_wei"] == 0
    assert c.get_refundable_balance(str(sponsor)) == 100
    assert settled["tranches"][0]["status"] == "DELIVERED_UNLOCKED"
    assert settled["tranches"][1]["status"] == "EXPIRED_REFUNDED"


def test_6_not_delivered_and_unverifiable_preserve_open_tranche():
    c = _new_contract()
    sponsor = MockAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    builder = MockAddress("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")

    MockRuntime.sender = sponsor
    MockRuntime.value = 100
    MockRuntime.prompt_handler = _gate1_ok
    pid = json.loads(
        c.create_release_pact("Flask", json.dumps(["Add CHIPS cookie flag"]), FLASK_PREFIX, 900)
    )["pact_id"]

    # HTTP 404 -> UNVERIFIABLE_FETCH, builder refunded 20 wei, tranche stays OPEN
    MockRuntime.sender = builder
    MockRuntime.value = 20
    u = json.loads(c.submit_delivery_proof(pid, 0, FLASK_URL, 1, 5))
    assert u["verdict"] == "UNVERIFIABLE_FETCH"
    assert c.get_refundable_balance(str(builder)) == 20
    assert json.loads(c.get_pact(pid))["tranches"][0]["status"] == "OPEN"

    # NOT_DELIVERED -> sponsor gets 20 wei anti-spam stake, tranche stays OPEN
    MockRuntime.web_responses[FLASK_URL] = MockWebResponse(200, b"Relax type hint for send_file.")
    MockRuntime.prompt_handler = lambda p, f: {
        "verdict": "NOT_DELIVERED",
        "reason": "ONLY_UNRELATED_FIXES",
        "quote": "",
        "summary": "Only send_file typing fix.",
    }
    nd = json.loads(c.submit_delivery_proof(pid, 0, FLASK_URL, 1, 5))
    assert nd["verdict"] == "NOT_DELIVERED"
    assert c.get_refundable_balance(str(sponsor)) == 20
    tr = json.loads(c.get_pact(pid))["tranches"][0]
    assert tr["status"] == "OPEN"
    assert tr["audit_attempts"] == 2


def test_7_verdict_reason_matrix_and_withdraw_emit_transfer():
    with pytest.raises(ValueError, match="INCOMPATIBLE_VERDICT_REASON"):
        rp._validate_gate2_payload(
            {
                "verdict": "FEATURE_DELIVERED",
                "reason": "ONLY_UNRELATED_FIXES",
                "quote": "valid verbatim quote here",
                "summary": "bad pair",
            },
            "valid verbatim quote here",
        )

    c = _new_contract()
    sponsor = MockAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    MockRuntime.sender = sponsor
    c._credit_refundable(str(sponsor), 250)
    wd = json.loads(c.withdraw_refundable())
    assert wd["withdrawn_wei"] == 250
    assert c.get_refundable_balance(str(sponsor)) == 0
    assert MockRuntime.transfers[-1] == {"to": str(sponsor), "value": 250, "on": "finalized"}
