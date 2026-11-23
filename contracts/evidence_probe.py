# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import hashlib
import json
import re
from genlayer import *

MAX_LINE_WINDOW = 120
MAX_SNIPPET_CHARS = 3000
PROBE_USER_AGENT = "ReleasePactOracle/1.0 (https://github.com/release-pact; oracle@releasepact.dev)"


def _decode_leader_calldata(raw):
    if isinstance(raw, (bytes, bytearray, memoryview)):
        return gl.calldata.decode(raw)
    return raw


def _normalize_text(text: str) -> str:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    normalized = (
        normalized.replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u2013", "-")
        .replace("\u2014", "-")
    )
    return normalized


def _slice_snippet(raw_text: str, start_line: int, end_line: int) -> str:
    s_line = max(1, int(start_line))
    e_line = max(s_line, int(end_line))
    if e_line - s_line + 1 > MAX_LINE_WINDOW:
        e_line = s_line + MAX_LINE_WINDOW - 1

    normalized = _normalize_text(raw_text)
    lines = normalized.split("\n")
    selected = lines[s_line - 1 : e_line]
    joined = "\n".join(selected)
    collapsed = re.sub(r"[ \t]+", " ", joined)
    collapsed = re.sub(r"\n{3,}", "\n\n", collapsed).strip()
    return collapsed[:MAX_SNIPPET_CHARS]


class EvidenceProbe(gl.Contract):
    last_probe: str
    probe_count: u256

    def __init__(self):
        self.last_probe = ""
        self.probe_count = u256(0)

    @gl.public.write
    def probe_url_slice(self, url: str, start_line: int, end_line: int) -> str:
        def _fetch_slice() -> str:
            response = gl.nondet.web.get(
                url,
                headers={"User-Agent": PROBE_USER_AGENT},
            )
            status_code = int(
                getattr(response, "status", getattr(response, "status_code", 0))
            )
            if status_code < 200 or status_code >= 300:
                return json.dumps(
                    {
                        "url": url,
                        "status_code": status_code,
                        "ok": False,
                        "snippet": "",
                        "snippet_sha256": "",
                    },
                    sort_keys=True,
                )

            raw_text = response.body.decode("utf-8", "replace")
            snippet = _slice_snippet(raw_text, start_line, end_line)
            digest = hashlib.sha256(snippet.encode("utf-8")).hexdigest() if snippet else ""
            return json.dumps(
                {
                    "url": url,
                    "status_code": status_code,
                    "ok": bool(snippet),
                    "start_line": int(start_line),
                    "end_line": int(end_line),
                    "snippet_len": len(snippet),
                    "snippet_sha256": digest,
                    "snippet": snippet,
                },
                sort_keys=True,
            )

        def _validate_slice(leader_result: gl.vm.Result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            try:
                validator_json = _fetch_slice()
                leader_json = _decode_leader_calldata(leader_result.calldata)
                if not isinstance(leader_json, str):
                    return False
                l_obj = json.loads(leader_json)
                v_obj = json.loads(validator_json)
                return (
                    l_obj.get("ok") == v_obj.get("ok")
                    and l_obj.get("status_code") == v_obj.get("status_code")
                    and l_obj.get("snippet_sha256") == v_obj.get("snippet_sha256")
                )
            except Exception:
                return False

        result_json = gl.vm.run_nondet_unsafe(_fetch_slice, _validate_slice)
        self.last_probe = result_json
        self.probe_count = u256(int(self.probe_count) + 1)
        return result_json

    @gl.public.view
    def get_last_probe(self) -> str:
        return self.last_probe
