from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.application.agents import (
    AgentCompileError,
    AgentParseError,
    AgentsService,
    GENERATED_MARKER,
    parse_agent_document,
)
from skill_manager.application.packages import PackageMeta, write_package_meta
from skill_manager.application.skills.store import SkillStore

AGENT_DOC = """---
name: Chief of Staff
description: Orchestrates tasks and delegates work.
capabilities:
  skills:
    - local/project-context
  mcps:
    - local/github-mcp
  tools:
    allowed:
      - read_file
      - delegate_to_agent
    denied:
      - execute_sql
harnesses:
  claude:
    model: claude-sonnet-5
    reasoning_effort: high
---
You are the Chief of Staff. Delegate; do not code.
"""


def _write_package(packages_root: Path, slug: str, *, active: bool = True, mutable: bool = True) -> Path:
    pkg_dir = packages_root / slug
    pkg_dir.mkdir(parents=True, exist_ok=True)
    write_package_meta(
        pkg_dir / "package.json",
        PackageMeta(slug=slug, name=slug.title(), version=1, mutable=mutable, active=active),
    )
    return pkg_dir


def _write_skill(pkg_dir: Path, dir_name: str, declared_name: str) -> None:
    skill_dir = pkg_dir / "skills" / dir_name
    skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / "SKILL.md").write_text(
        f"---\nname: {declared_name}\ndescription: about {declared_name}\n---\n\nUse {declared_name} wisely.\n",
        encoding="utf-8",
    )


def _write_agent(pkg_dir: Path, slug: str, document: str) -> Path:
    agents_dir = pkg_dir / "agents"
    agents_dir.mkdir(parents=True, exist_ok=True)
    path = agents_dir / f"{slug}.md"
    path.write_text(document, encoding="utf-8")
    return path


class AgentParserTests(unittest.TestCase):
    def test_parse_full_document(self) -> None:
        agent = parse_agent_document(
            AGENT_DOC, slug="chief-of-staff", package_slug="local", path=Path("chief-of-staff.md")
        )
        self.assertEqual(agent.name, "Chief of Staff")
        self.assertEqual(agent.ref, "local/chief-of-staff")
        self.assertEqual(agent.skills, ("local/project-context",))
        self.assertEqual(agent.mcps, ("local/github-mcp",))
        self.assertEqual(agent.tools_allowed, ("read_file", "delegate_to_agent"))
        self.assertEqual(agent.tools_denied, ("execute_sql",))
        self.assertEqual(agent.harness_overrides["claude"]["model"], "claude-sonnet-5")
        self.assertTrue(agent.prompt.startswith("You are the Chief of Staff."))

    def test_parse_rejects_missing_frontmatter(self) -> None:
        with self.assertRaises(AgentParseError):
            parse_agent_document("just a prompt", slug="x", package_slug="local", path=Path("x.md"))

    def test_parse_rejects_unterminated_frontmatter(self) -> None:
        with self.assertRaises(AgentParseError):
            parse_agent_document("---\nname: x\n", slug="x", package_slug="local", path=Path("x.md"))

    def test_parse_rejects_non_mapping_capabilities(self) -> None:
        doc = "---\nname: x\ncapabilities: nope\n---\nbody"
        with self.assertRaises(AgentParseError):
            parse_agent_document(doc, slug="x", package_slug="local", path=Path("x.md"))


class AgentsServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = TemporaryDirectory()
        base = Path(self.temp.name)
        self.packages_root = base / "packages"
        self.home = base / "home"
        local = _write_package(self.packages_root, "local")
        _write_skill(local, "project-context", "Project Context")
        _write_agent(local, "chief-of-staff", AGENT_DOC)
        self.store = SkillStore(
            root=self.packages_root / "local" / "skills",
            manifest_path=self.packages_root / "local" / "manifest.json",
            packages_root=self.packages_root,
        )
        self.service = AgentsService(self.packages_root, self.store, self.home)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_scan_finds_agents_across_active_packages(self) -> None:
        remote = _write_package(self.packages_root, "remote", mutable=False)
        _write_agent(remote, "researcher", "---\nname: Researcher\n---\nResearch things.")
        agents, issues = self.service.scan()
        self.assertEqual({a.ref for a in agents}, {"local/chief-of-staff", "remote/researcher"})
        self.assertEqual(issues, ())

    def test_scan_excludes_inactive_package_and_reports_invalid(self) -> None:
        inactive = _write_package(self.packages_root, "inactive", active=False)
        _write_agent(inactive, "ghost", "---\nname: Ghost\n---\nBoo.")
        local = self.packages_root / "local"
        _write_agent(local, "broken", "no frontmatter here")
        agents, issues = self.service.scan()
        self.assertEqual({a.ref for a in agents}, {"local/chief-of-staff"})
        self.assertEqual(len(issues), 1)
        self.assertIn("local/broken", issues[0])

    def test_compile_claude_artifact(self) -> None:
        agent = self.service.get("local/chief-of-staff")
        assert agent is not None
        artifact = self.service.compile(agent, "claude")
        self.assertEqual(artifact.target_path, self.home / ".claude" / "agents" / "chief-of-staff.md")
        self.assertIn(GENERATED_MARKER, artifact.content)
        self.assertIn("agent=local/chief-of-staff", artifact.content)
        self.assertIn("skills=local/project-context@", artifact.content)
        self.assertIn("tools: read_file, delegate_to_agent", artifact.content)
        self.assertIn("model: claude-sonnet-5", artifact.content)
        self.assertIn("reasoning_effort: high", artifact.content)
        self.assertIn("## Skill: Project Context (local/project-context)", artifact.content)
        self.assertIn("Use Project Context wisely.", artifact.content)
        self.assertIn("Do not use these tools: execute_sql", artifact.content)
        self.assertEqual(len(artifact.degradations), 2)
        self.assertTrue(any("deny-list" in d for d in artifact.degradations))
        self.assertTrue(any("MCP" in d for d in artifact.degradations))

    def test_compile_unknown_skill_alias_fails(self) -> None:
        local = self.packages_root / "local"
        _write_agent(
            local,
            "dangler",
            "---\nname: Dangler\ncapabilities:\n  skills:\n    - local/missing\n---\nBody.",
        )
        agent = self.service.get("local/dangler")
        assert agent is not None
        with self.assertRaises(AgentCompileError):
            self.service.compile(agent, "claude")

    def test_compile_unsupported_harness_fails(self) -> None:
        agent = self.service.get("local/chief-of-staff")
        assert agent is not None
        with self.assertRaises(AgentCompileError):
            self.service.compile(agent, "cursor")

    def test_write_artifact_refuses_foreign_file(self) -> None:
        agent = self.service.get("local/chief-of-staff")
        assert agent is not None
        artifact = self.service.compile(agent, "claude")
        target = artifact.target_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("hand-written agent, do not clobber", encoding="utf-8")
        with self.assertRaises(AgentCompileError):
            self.service.write_artifact(artifact)

    def test_write_artifact_writes_and_regenerates(self) -> None:
        agent = self.service.get("local/chief-of-staff")
        assert agent is not None
        artifact = self.service.compile(agent, "claude")
        self.service.write_artifact(artifact)
        self.assertTrue(artifact.target_path.is_file())
        self.service.write_artifact(artifact)
        self.assertIn(GENERATED_MARKER, artifact.target_path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
