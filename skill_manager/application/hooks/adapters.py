from __future__ import annotations

import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

from skill_manager.errors import MutationError
from skill_manager.atomic_files import atomic_write_text, file_lock
from skill_manager.harness import (
    ConfigSubtreeBindingProfile,
    HarnessDefinition,
    HarnessKernelService,
    ResolutionContext,
)

from .contracts import HookHarnessAdapter, HookHarnessScan, HookHarnessStatus, HookObservedEntry, BindingState
from .mappers import HookMapper, get_mapper
from .store import HookSpec


@dataclass(frozen=True)
class _RawHookEntry:
    id: str
    event: str
    matcher: str | None
    payload: dict[str, object]
    group_index: int
    hook_index: int


class FileBackedHooksAdapter(HookHarnessAdapter):
    def __init__(
        self,
        *,
        definition: HarnessDefinition,
        profile: ConfigSubtreeBindingProfile,
        context: ResolutionContext,
    ) -> None:
        self.harness = definition.harness
        self.label = definition.label
        self.logo_key = definition.logo_key
        self.config_path = profile.resolve_config_path(context)
        self._install_probe = definition.install_probe
        self._path_env = context.env.get("PATH")
        self._mapper: HookMapper = get_mapper(profile.codec)

    def status(self) -> HookHarnessStatus:
        installed = self._is_installed()
        config_present = self.config_path.is_file()
        return HookHarnessStatus(
            harness=self.harness,
            label=self.label,
            logo_key=self.logo_key,
            installed=installed,
            config_path=self.config_path,
            config_present=config_present,
            hooks_writable=True,
        )

    def scan(self, specs: tuple[HookSpec, ...]) -> HookHarnessScan:
        status = self.status()
        specs_by_id = {spec.id: spec for spec in specs}
        entries: list[HookObservedEntry] = []
        seen_ids: set[str] = set()
        scan_issue: str | None = None

        try:
            raw_entries = self._read_entries() if status.config_present else ()
        except MutationError as error:
            raw_entries = ()
            scan_issue = str(error)

        for raw in raw_entries:
            seen_ids.add(raw.id)
            parsed_spec: HookSpec | None = None
            parse_issue: str | None = None
            try:
                parsed_spec = self._mapper.dict_to_spec(
                    raw.event,
                    raw.matcher,
                    raw.payload,
                )
            except Exception as error:  # noqa: BLE001
                parse_issue = str(error)

            managed_spec = specs_by_id.get(raw.id)
            if managed_spec is None:
                entries.append(
                    HookObservedEntry(
                        id=raw.id,
                        event=raw.event,
                        state="unmanaged",
                        raw_payload=dict(raw.payload),
                        parsed_spec=parsed_spec,
                        parse_issue=parse_issue,
                    )
                )
                continue

            if parse_issue is not None:
                entries.append(
                    HookObservedEntry(
                        id=raw.id,
                        event=raw.event,
                        state="drifted",
                        raw_payload=dict(raw.payload),
                        parsed_spec=parsed_spec,
                        drift_detail=parse_issue,
                        parse_issue=parse_issue,
                    )
                )
                continue

            expected = _normalize_payload(self._mapper.spec_to_dict(managed_spec))
            actual = _normalize_payload(dict(raw.payload))
            if expected == actual and managed_spec.event == raw.event and managed_spec.matcher == raw.matcher:
                entries.append(
                    HookObservedEntry(
                        id=raw.id,
                        event=raw.event,
                        state="managed",
                        raw_payload=dict(raw.payload),
                        parsed_spec=parsed_spec,
                    )
                )
            else:
                drift_parts = []
                if managed_spec.event != raw.event:
                    drift_parts.append(f"event: expected={managed_spec.event}, actual={raw.event}")
                if managed_spec.matcher != raw.matcher:
                    drift_parts.append(f"matcher: expected={managed_spec.matcher}, actual={raw.matcher}")
                if expected != actual:
                    drift_parts.append(_drift_detail(expected, actual))
                entries.append(
                    HookObservedEntry(
                        id=raw.id,
                        event=raw.event,
                        state="drifted",
                        raw_payload=dict(raw.payload),
                        parsed_spec=parsed_spec,
                        drift_detail="; ".join(drift_parts) or "value mismatch",
                    )
                )

        for spec in specs:
            if spec.id in seen_ids:
                continue
            entries.append(
                HookObservedEntry(
                    id=spec.id,
                    event=spec.event,
                    state="missing",
                    parsed_spec=spec,
                )
            )

        return HookHarnessScan(
            harness=self.harness,
            label=self.label,
            logo_key=self.logo_key,
            installed=status.installed,
            config_present=status.config_present,
            config_path=self.config_path,
            scan_issue=scan_issue,
            entries=tuple(entries),
        )

    def has_binding(self, id: str) -> bool:
        return any(raw.id == id for raw in self._read_entries())

    def enable_hook(self, spec: HookSpec) -> None:
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        with file_lock(self._lock_path(self.config_path)):
            document = self._load_document(self.config_path)
            
            # Ensure "hooks" exists and is a dictionary
            if "hooks" not in document:
                document["hooks"] = {}
            hooks_subtree = document["hooks"]
            if not isinstance(hooks_subtree, dict):
                raise MutationError("The top-level 'hooks' key is not an object", status=409)

            # Ensure the specific event list exists
            if spec.event not in hooks_subtree:
                hooks_subtree[spec.event] = []
            event_list = hooks_subtree[spec.event]
            if not isinstance(event_list, list):
                raise MutationError(f"The hook event '{spec.event}' is not an array", status=409)

            # Find or create the matcher group
            target_group = None
            for group in event_list:
                if not isinstance(group, dict):
                    continue
                group_matcher = group.get("matcher")
                if spec.matcher is None:
                    # Look for matcher group with no matcher, or empty/omitted matcher
                    if "matcher" not in group or group_matcher is None:
                        target_group = group
                        break
                else:
                    if group_matcher == spec.matcher:
                        target_group = group
                        break

            if target_group is None:
                target_group = {"hooks": []}
                if spec.matcher is not None:
                    target_group["matcher"] = spec.matcher
                event_list.append(target_group)

            if "hooks" not in target_group or not isinstance(target_group["hooks"], list):
                target_group["hooks"] = []

            # Write the hook entry
            hook_payload = self._mapper.spec_to_dict(spec)
            hooks_list = target_group["hooks"]
            
            # Find if it already exists
            updated = False
            for idx, entry in enumerate(hooks_list):
                if isinstance(entry, dict) and entry.get("id") == spec.id:
                    hooks_list[idx] = hook_payload
                    updated = True
                    break
            
            if not updated:
                hooks_list.append(hook_payload)

            # Cleanup other matcher groups or events in case the hook changed event or matcher
            # i.e., remove old entries of this hook with the same ID
            for ev, ev_list in list(hooks_subtree.items()):
                if not isinstance(ev_list, list):
                    continue
                for grp in list(ev_list):
                    if not isinstance(grp, dict) or "hooks" not in grp or not isinstance(grp["hooks"], list):
                        continue
                    # Don't clean up the one we just wrote to
                    if ev == spec.event and grp is target_group:
                        # Clean up duplicates inside the same group if any
                        grp["hooks"] = [h for idx, h in enumerate(grp["hooks"]) if not (isinstance(h, dict) and h.get("id") == spec.id and h is not hook_payload)]
                        continue
                    
                    grp["hooks"] = [h for h in grp["hooks"] if not (isinstance(h, dict) and h.get("id") == spec.id)]
                    if not grp["hooks"]:
                        ev_list.remove(grp)
                if not ev_list:
                    hooks_subtree.pop(ev, None)

            atomic_write_text(self.config_path, self._dump_document(document))

    def disable_hook(self, id: str) -> None:
        if not self.config_path.is_file():
            return
        with file_lock(self._lock_path(self.config_path)):
            document = self._load_document(self.config_path)
            hooks_subtree = document.get("hooks")
            if not isinstance(hooks_subtree, dict):
                return

            removed = False
            for ev, ev_list in list(hooks_subtree.items()):
                if not isinstance(ev_list, list):
                    continue
                for grp in list(ev_list):
                    if not isinstance(grp, dict) or "hooks" not in grp or not isinstance(grp["hooks"], list):
                        continue
                    orig_len = len(grp["hooks"])
                    grp["hooks"] = [h for h in grp["hooks"] if not (isinstance(h, dict) and h.get("id") == id)]
                    if len(grp["hooks"]) < orig_len:
                        removed = True
                    if not grp["hooks"]:
                        ev_list.remove(grp)
                if not ev_list:
                    hooks_subtree.pop(ev, None)

            if not hooks_subtree:
                document.pop("hooks", None)

            if removed:
                atomic_write_text(self.config_path, self._dump_document(document))

    def invalidate(self) -> None:
        return None

    def _is_installed(self) -> bool:
        return shutil.which(self._install_probe, path=self._path_env) is not None

    def _lock_path(self, config_path: Path) -> Path:
        return config_path.with_suffix(config_path.suffix + ".lock")

    def _load_document(self, config_path: Path) -> dict[str, object]:
        if not config_path.is_file():
            return {}
        text = config_path.read_text(encoding="utf-8")
        if not text.strip():
            return {}
        try:
            payload = json.loads(text)
        except json.JSONDecodeError as error:
            raise MutationError(
                f"{self.harness} settings file is not valid JSON: {error}",
                status=409,
            ) from error
        return payload if isinstance(payload, dict) else {}

    def _dump_document(self, document: dict[str, object]) -> str:
        return json.dumps(document, ensure_ascii=False, indent=2) + "\n"

    def _read_entries(self) -> tuple[_RawHookEntry, ...]:
        if not self.config_path.is_file():
            return ()
        document = self._load_document(self.config_path)
        hooks_subtree = document.get("hooks", {})
        if not isinstance(hooks_subtree, dict):
            raise MutationError("The top-level 'hooks' key is not an object", status=409)

        entries: list[_RawHookEntry] = []
        for event, matcher_groups in hooks_subtree.items():
            if not isinstance(matcher_groups, list):
                continue
            for group_idx, group in enumerate(matcher_groups):
                if not isinstance(group, dict):
                    continue
                matcher = group.get("matcher")
                hooks_list = group.get("hooks", [])
                if not isinstance(hooks_list, list):
                    continue
                for hook_idx, hook in enumerate(hooks_list):
                    if not isinstance(hook, dict):
                        continue
                    hook_id = hook.get("id")
                    if not isinstance(hook_id, str) or not hook_id:
                        # Fallback for unmanaged/manually created hooks
                        command = hook.get("command", "")
                        cmd_hash = hashlib.sha256(command.encode("utf-8")).hexdigest()[:16]
                        hook_id = f"manual:{cmd_hash}"
                    entries.append(
                        _RawHookEntry(
                            id=hook_id,
                            event=event,
                            matcher=matcher,
                            payload=dict(hook),
                            group_index=group_idx,
                            hook_index=hook_idx,
                        )
                    )
        return tuple(entries)


def build_hooks_adapters(
    kernel: HarnessKernelService,
) -> tuple[FileBackedHooksAdapter, ...]:
    return tuple(
        FileBackedHooksAdapter(
            definition=binding.definition,
            profile=binding.profile,
            context=kernel.context,
        )
        for binding in kernel.bindings_for_family("hooks")
        if isinstance(binding.profile, ConfigSubtreeBindingProfile)
    )


def _normalize_payload(value: object) -> object:
    if isinstance(value, dict):
        normalized = {
            key: _normalize_payload(item)
            for key, item in value.items()
            if not _is_semantic_default(key, item)
        }
        return {key: normalized[key] for key in sorted(normalized)}
    if isinstance(value, list):
        return [_normalize_payload(item) for item in value]
    return value


def _is_semantic_default(key: str, value: object) -> bool:
    if key == "type" and value == "command":
        return True
    return False


def _drift_detail(expected: object, actual: object) -> str:
    if not isinstance(expected, dict) or not isinstance(actual, dict):
        return "value mismatch"
    missing = sorted(set(expected) - set(actual))
    extra = sorted(set(actual) - set(expected))
    changed = sorted(
        key for key in set(expected) & set(actual) if expected[key] != actual[key]
    )
    parts: list[str] = []
    if missing:
        parts.append(f"missing={','.join(missing)}")
    if extra:
        parts.append(f"extra={','.join(extra)}")
    if changed:
        parts.append(f"changed={','.join(changed)}")
    return "; ".join(parts) or "value mismatch"


import hashlib

__all__ = ["FileBackedHooksAdapter", "build_hooks_adapters"]
