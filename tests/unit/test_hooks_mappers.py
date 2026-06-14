from __future__ import annotations

import unittest
from skill_manager.application.hooks.mappers import ClaudeCodeHooksMapper
from skill_manager.application.hooks.store import HookSpec
from skill_manager.errors import MutationError


class ClaudeCodeHooksMapperTests(unittest.TestCase):
    def test_spec_to_dict_without_timeout(self) -> None:
        mapper = ClaudeCodeHooksMapper()
        spec = HookSpec(
            id="test-hook",
            event="PreToolUse",
            command="echo hello",
            matcher="Bash",
        )
        d = mapper.spec_to_dict(spec)
        self.assertEqual(d["type"], "command")
        self.assertEqual(d["command"], "echo hello")
        self.assertEqual(d["id"], "test-hook")
        self.assertNotIn("timeout", d)

    def test_spec_to_dict_with_timeout(self) -> None:
        mapper = ClaudeCodeHooksMapper()
        spec = HookSpec(
            id="test-hook",
            event="PreToolUse",
            command="echo hello",
            matcher="Bash",
            timeout=30,
        )
        d = mapper.spec_to_dict(spec)
        self.assertEqual(d["type"], "command")
        self.assertEqual(d["command"], "echo hello")
        self.assertEqual(d["id"], "test-hook")
        self.assertEqual(d["timeout"], 30)

    def test_dict_to_spec_preserves_id(self) -> None:
        mapper = ClaudeCodeHooksMapper()
        raw = {
            "type": "command",
            "command": "echo hello",
            "id": "my-id",
            "timeout": 45,
        }
        spec = mapper.dict_to_spec("PreToolUse", "Bash", raw)
        self.assertEqual(spec.id, "my-id")
        self.assertEqual(spec.event, "PreToolUse")
        self.assertEqual(spec.command, "echo hello")
        self.assertEqual(spec.matcher, "Bash")
        self.assertEqual(spec.timeout, 45)

    def test_dict_to_spec_generates_stable_id_when_missing(self) -> None:
        mapper = ClaudeCodeHooksMapper()
        raw = {
            "type": "command",
            "command": "echo hello",
        }
        spec1 = mapper.dict_to_spec("PreToolUse", "Bash", raw)
        spec2 = mapper.dict_to_spec("PreToolUse", "Bash", raw)
        self.assertTrue(spec1.id.startswith("manual:"))
        self.assertEqual(spec1.id, spec2.id)

    def test_dict_to_spec_errors_if_command_not_string(self) -> None:
        mapper = ClaudeCodeHooksMapper()
        with self.assertRaises(MutationError):
            mapper.dict_to_spec("PreToolUse", None, {"type": "command", "command": 123})


if __name__ == "__main__":
    unittest.main()
