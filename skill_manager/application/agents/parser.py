from __future__ import annotations

import hashlib
from pathlib import Path

from ruamel.yaml import YAML
from ruamel.yaml.error import YAMLError

from .model import AgentDefinition, AgentParseError

_yaml = YAML(typ="safe")


def parse_agent_file(path: Path, *, package_slug: str) -> AgentDefinition:
    try:
        document = path.read_text(encoding="utf-8")
    except OSError as error:
        raise AgentParseError(f"unable to read agent file {path}: {error}") from error
    return parse_agent_document(
        document,
        slug=path.stem,
        package_slug=package_slug,
        path=path,
    )


def parse_agent_document(document: str, *, slug: str, package_slug: str, path: Path) -> AgentDefinition:
    metadata, prompt = _split_frontmatter(document)
    name = _required_str(metadata, "name", slug)
    description = str(metadata.get("description", "") or "").strip()
    capabilities = _mapping(metadata.get("capabilities"), "capabilities")
    tools = _mapping(capabilities.get("tools"), "capabilities.tools")
    harnesses_raw = _mapping(metadata.get("harnesses"), "harnesses")
    harness_overrides: dict[str, dict[str, str]] = {}
    for harness, overrides in harnesses_raw.items():
        entry = _mapping(overrides, f"harnesses.{harness}")
        harness_overrides[str(harness)] = {str(k): str(v) for k, v in entry.items()}
    return AgentDefinition(
        slug=slug,
        name=name,
        description=description,
        prompt=prompt.strip(),
        skills=_str_tuple(capabilities.get("skills"), "capabilities.skills"),
        mcps=_str_tuple(capabilities.get("mcps"), "capabilities.mcps"),
        tools_allowed=_str_tuple(tools.get("allowed"), "capabilities.tools.allowed"),
        tools_denied=_str_tuple(tools.get("denied"), "capabilities.tools.denied"),
        harness_overrides=harness_overrides,
        package_slug=package_slug,
        path=path,
        fingerprint=hashlib.sha256(document.encode("utf-8")).hexdigest(),
    )


def _split_frontmatter(document: str) -> tuple[dict, str]:
    lines = document.splitlines(keepends=True)
    if not lines or lines[0].strip() != "---":
        raise AgentParseError("agent definition is missing YAML frontmatter")
    for index, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            frontmatter_text = "".join(lines[1:index])
            body = "".join(lines[index + 1 :])
            try:
                metadata = _yaml.load(frontmatter_text) or {}
            except YAMLError as error:
                raise AgentParseError(f"invalid YAML frontmatter: {error}") from error
            if not isinstance(metadata, dict):
                raise AgentParseError("agent frontmatter must be a YAML mapping")
            return metadata, body
    raise AgentParseError("agent frontmatter is not terminated with ---")


def _required_str(metadata: dict, key: str, fallback: str) -> str:
    value = str(metadata.get(key, "") or "").strip()
    return value or fallback


def _mapping(value: object, label: str) -> dict:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise AgentParseError(f"{label} must be a mapping")
    return value


def _str_tuple(value: object, label: str) -> tuple[str, ...]:
    if value is None:
        return ()
    if not isinstance(value, list):
        raise AgentParseError(f"{label} must be a list")
    return tuple(str(item).strip() for item in value if str(item).strip())


__all__ = ["parse_agent_document", "parse_agent_file"]
