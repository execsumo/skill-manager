from __future__ import annotations

from typing import Mapping, Protocol

from skill_manager.errors import MutationError

from .store import HookSpec


class HookMapper(Protocol):
    """Translates between HookSpec and a single harness's per-hook payload dict."""

    def spec_to_dict(self, spec: HookSpec) -> dict[str, object]: ...

    def dict_to_spec(
        self,
        event: str,
        matcher: str | None,
        raw: Mapping[str, object],
    ) -> HookSpec: ...


class ClaudeCodeHooksMapper:
    """Mapper for Claude Code hooks under ~/.claude/settings.json."""

    def spec_to_dict(self, spec: HookSpec) -> dict[str, object]:
        payload: dict[str, object] = {
            "type": "command",
            "command": spec.command,
            "id": spec.id,
        }
        if spec.timeout is not None:
            payload["timeout"] = spec.timeout
        return payload

    def dict_to_spec(
        self,
        event: str,
        matcher: str | None,
        raw: Mapping[str, object],
    ) -> HookSpec:
        command = raw.get("command")
        if not isinstance(command, str):
            raise MutationError("Hook command must be a string", status=400)
        
        timeout_raw = raw.get("timeout")
        timeout: int | None = None
        if isinstance(timeout_raw, (int, float)):
            timeout = int(timeout_raw)
        elif isinstance(timeout_raw, str) and timeout_raw.isdigit():
            timeout = int(timeout_raw)

        # Retrieve or generate a stable id
        raw_id = raw.get("id")
        if isinstance(raw_id, str) and raw_id:
            hook_id = raw_id
        else:
            # Fallback for unmanaged/manually created hooks: generate a stable hash from command
            cmd_hash = hashlib.sha256(command.encode("utf-8")).hexdigest()[:16]
            hook_id = f"manual:{cmd_hash}"

        return HookSpec(
            id=hook_id,
            event=event,
            command=command,
            matcher=matcher,
            timeout=timeout,
        )


_MAPPERS: dict[str, HookMapper] = {
    "claude-code-hooks": ClaudeCodeHooksMapper(),
}


def get_mapper(kind: str) -> HookMapper:
    if kind not in _MAPPERS:
        raise ValueError(f"unknown hooks mapper kind: {kind}")
    return _MAPPERS[kind]


import hashlib

__all__ = ["ClaudeCodeHooksMapper", "HookMapper", "get_mapper"]
