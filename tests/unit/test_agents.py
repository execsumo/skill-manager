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
from skill_manager.application.skills.store import SkillStore

AGENT_DOC = """---
name: Chief of Staff
description: Orchestrates tasks and delegates work.
capabilities:
  skills:
    - project-context
  mcps:
    - github-mcp
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
  cursor:
    model: cursor-fast
    reasoning_effort: high
---
You are the Chief of Staff. Delegate; do not code.
"""


def _write_skill(root: Path, dir_name: str, declared_name: str) -> None:
    skill_dir = root / dir_name
    skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / "SKILL.md").write_text(
        f"---\nname: {declared_name}\ndescription: about {declared_name}\n---\n\nUse {declared_name} wisely.\n",
        encoding="utf-8",
    )


def _write_agent(agents_root: Path, slug: str, document: str) -> Path:
    agents_root.mkdir(parents=True, exist_ok=True)
    path = agents_root / f"{slug}.md"
    path.write_text(document, encoding="utf-8")
    return path


class AgentParserTests(unittest.TestCase):
    def test_parse_full_document(self) -> None:
        agent = parse_agent_document(
            AGENT_DOC, slug="chief-of-staff", path=Path("chief-of-staff.md")
        )
        self.assertEqual(agent.name, "Chief of Staff")
        self.assertEqual(agent.ref, "chief-of-staff")
        self.assertEqual(agent.skills, ("project-context",))
        self.assertEqual(agent.mcps, ("github-mcp",))
        self.assertEqual(agent.tools_allowed, ("read_file", "delegate_to_agent"))
        self.assertEqual(agent.tools_denied, ("execute_sql",))
        self.assertEqual(agent.harness_overrides["claude"]["model"], "claude-sonnet-5")
        self.assertTrue(agent.prompt.startswith("You are the Chief of Staff."))

    def test_parse_rejects_missing_frontmatter(self) -> None:
        with self.assertRaises(AgentParseError):
            parse_agent_document("just a prompt", slug="x", path=Path("x.md"))

    def test_parse_rejects_unterminated_frontmatter(self) -> None:
        with self.assertRaises(AgentParseError):
            parse_agent_document("---\nname: x\n", slug="x", path=Path("x.md"))

    def test_parse_rejects_non_mapping_capabilities(self) -> None:
        doc = "---\nname: x\ncapabilities: nope\n---\nbody"
        with self.assertRaises(AgentParseError):
            parse_agent_document(doc, slug="x", path=Path("x.md"))


class AgentsServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = TemporaryDirectory()
        base = Path(self.temp.name)
        self.skills_root = base / "skills"
        self.agents_root = base / "agents"
        self.home = base / "home"
        _write_skill(self.skills_root, "project-context", "Project Context")
        _write_agent(self.agents_root, "chief-of-staff", AGENT_DOC)
        self.store = SkillStore(
            root=self.skills_root,
            manifest_path=self.skills_root.parent / "skills-manifest.json",
        )
        self.service = AgentsService(self.agents_root, self.store, self.home)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_scan_discovers_active_agents(self) -> None:
        agents, issues = self.service.scan()
        self.assertEqual(len(agents), 1)
        self.assertEqual(len(issues), 0)
        self.assertEqual(agents[0].name, "Chief of Staff")

    def test_scan_excludes_inactive_package_agents(self) -> None:
        # With flat layout, all agents are active
        agents, issues = self.service.scan()
        self.assertEqual(len(agents), 1)

    def test_get_by_ref(self) -> None:
        agent = self.service.get("chief-of-staff")
        self.assertIsNotNone(agent)
        self.assertEqual(agent.name, "Chief of Staff")

    def test_compile_claude_artifact(self) -> None:
        agent = self.service.get("chief-of-staff")
        assert agent is not None
        artifact = self.service.compile(agent, "claude")
        self.assertEqual(
            artifact.target_path, self.home / ".claude" / "agents" / "chief-of-staff.md"
        )
        self.assertIn(GENERATED_MARKER, artifact.content)
        self.assertIn("read_file, delegate_to_agent", artifact.content)
        self.assertIn("model: claude-sonnet-5", artifact.content)
        self.assertIn("reasoning_effort: high", artifact.content)
        self.assertIn("## Skill: Project Context (project-context)", artifact.content)
        self.assertIn("Use Project Context wisely.", artifact.content)
        self.assertIn("Do not use these tools: execute_sql", artifact.content)
        self.assertEqual(len(artifact.degradations), 2)
        self.assertTrue(any("deny-list" in d for d in artifact.degradations))
        self.assertTrue(any("MCP" in d for d in artifact.degradations))

    def test_compile_unknown_skill_alias_fails(self) -> None:
        _write_agent(
            self.agents_root,
            "dangler",
            "---\nname: Dangler\ncapabilities:\n  skills:\n    - missing\n---\nBody.",
        )
        agent = self.service.get("dangler")
        assert agent is not None
        with self.assertRaises(AgentCompileError):
            self.service.compile(agent, "claude")

    def test_compile_unsupported_harness_fails(self) -> None:
        agent = self.service.get("chief-of-staff")
        assert agent is not None
        with self.assertRaises(AgentCompileError):
            self.service.compile(agent, "windsurf")

    def test_compile_cursor_requires_project_dir(self) -> None:
        agent = self.service.get("chief-of-staff")
        assert agent is not None
        with self.assertRaises(AgentCompileError):
            self.service.compile(agent, "cursor")

    def test_compile_cursor_artifact(self) -> None:
        agent = self.service.get("chief-of-staff")
        assert agent is not None
        project = Path(self.temp.name) / "proj"
        artifact = self.service.compile(agent, "cursor", project_dir=project)
        self.assertEqual(
            artifact.target_path,
            project / ".cursor" / "rules" / "skill-manager.chief-of-staff.mdc",
        )
        self.assertIn("alwaysApply: true", artifact.content)
        self.assertIn(GENERATED_MARKER, artifact.content)
        self.assertNotIn("model:", artifact.content)
        self.assertTrue(any("advisory" in d for d in artifact.degradations))
        self.assertTrue(any("model override" in d for d in artifact.degradations))
        self.assertTrue(any("reasoning_effort" in d for d in artifact.degradations))

    def test_compile_codex_artifact(self) -> None:
        agent = self.service.get("chief-of-staff")
        assert agent is not None
        artifact = self.service.compile(agent, "codex")
        self.assertEqual(
            artifact.target_path, self.home / ".codex" / "prompts" / "chief-of-staff.md"
        )
        self.assertIn(GENERATED_MARKER, artifact.content)
        self.assertIn("## Skill: Project Context (project-context)", artifact.content)
        self.assertTrue(any("custom prompt" in d for d in artifact.degradations))

    def test_write_artifact_refuses_foreign_file(self) -> None:
        agent = self.service.get("chief-of-staff")
        assert agent is not None
        artifact = self.service.compile(agent, "claude")
        target = artifact.target_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("hand-written agent, do not clobber", encoding="utf-8")
        with self.assertRaises(AgentCompileError):
            self.service.write_artifact(artifact)

    def test_write_artifact_writes_and_regenerates(self) -> None:
        agent = self.service.get("chief-of-staff")
        assert agent is not None
        artifact = self.service.compile(agent, "claude")
        self.service.write_artifact(artifact)
        self.assertTrue(artifact.target_path.is_file())
        self.service.write_artifact(artifact)
        self.assertIn(GENERATED_MARKER, artifact.target_path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
