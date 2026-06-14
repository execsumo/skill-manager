from __future__ import annotations

import json
import unittest
from pathlib import Path

from tests.support.app_harness import AppTestHarness


class HookRoutesTests(unittest.TestCase):
    def test_list_starts_empty(self) -> None:
        with AppTestHarness() as harness:
            payload = harness.get_json("/api/hooks")
            self.assertEqual(payload["entries"], [])
            # Only claude should support hooks
            harness_names = [col["harness"] for col in payload["columns"]]
            self.assertIn("claude", harness_names)
            self.assertNotIn("cursor", harness_names)

    def test_create_and_delete_hook(self) -> None:
        with AppTestHarness() as harness:
            # Create
            response = harness.post_json(
                "/api/hooks",
                {
                    "id": "my-hook",
                    "event": "PreToolUse",
                    "command": "echo hello",
                    "matcher": "Bash",
                    "timeout": 30,
                    "description": "Say hello",
                },
            )
            self.assertTrue(response["ok"])
            self.assertEqual(response["hook"]["id"], "my-hook")
            self.assertEqual(response["hook"]["command"], "echo hello")

            # Check listing contains it
            payload = harness.get_json("/api/hooks")
            entry_ids = [entry["id"] for entry in payload["entries"]]
            self.assertIn("my-hook", entry_ids)

            # Get details
            detail = harness.get_json("/api/hooks/my-hook")
            self.assertEqual(detail["id"], "my-hook")

            # Delete
            deleted = harness.delete_json("/api/hooks/my-hook")
            self.assertTrue(deleted["ok"])

            # Check listing is empty again
            payload2 = harness.get_json("/api/hooks")
            self.assertEqual(payload2["entries"], [])

    def test_enable_and_disable_hook(self) -> None:
        with AppTestHarness() as harness:
            # Create
            harness.post_json(
                "/api/hooks",
                {
                    "id": "my-hook",
                    "event": "PreToolUse",
                    "command": "echo hello",
                    "matcher": "Bash",
                    "timeout": 30,
                    "description": "Say hello",
                },
            )

            # Enable on Claude
            enabled = harness.post_json(
                "/api/hooks/my-hook/enable",
                {"harness": "claude"},
            )
            self.assertTrue(enabled["ok"])

            # Verify Claude settings file exists and contains the hook
            settings_path = harness.spec.home / ".claude" / "settings.json"
            self.assertTrue(settings_path.is_file())
            settings = json.loads(settings_path.read_text(encoding="utf-8"))
            
            self.assertIn("hooks", settings)
            self.assertIn("PreToolUse", settings["hooks"])
            groups = settings["hooks"]["PreToolUse"]
            self.assertEqual(len(groups), 1)
            self.assertEqual(groups[0]["matcher"], "Bash")
            hooks = groups[0]["hooks"]
            self.assertEqual(len(hooks), 1)
            self.assertEqual(hooks[0]["id"], "my-hook")
            self.assertEqual(hooks[0]["command"], "echo hello")
            self.assertEqual(hooks[0]["timeout"], 30)

            # Disable on Claude
            disabled = harness.post_json(
                "/api/hooks/my-hook/disable",
                {"harness": "claude"},
            )
            self.assertTrue(disabled["ok"])

            # Verify Claude settings file no longer contains the hook
            settings_after = json.loads(settings_path.read_text(encoding="utf-8"))
            self.assertNotIn("hooks", settings_after)

    def test_reconcile_hook(self) -> None:
        with AppTestHarness() as harness:
            # 1. Manually write an unmanaged hook to the Claude config
            settings_path = harness.spec.home / ".claude" / "settings.json"
            settings_path.parent.mkdir(parents=True, exist_ok=True)
            settings_path.write_text(
                json.dumps(
                    {
                        "hooks": {
                            "PreToolUse": [
                                {
                                    "matcher": "Bash",
                                    "hooks": [
                                        {
                                            "type": "command",
                                            "command": "echo manual",
                                            "id": "manual-hook",
                                        }
                                    ],
                                }
                            ]
                        }
                    }
                ),
                encoding="utf-8",
            )

            # 2. Check that it is detected as unmanaged
            payload = harness.get_json("/api/hooks")
            entry_ids = [entry["id"] for entry in payload["entries"]]
            self.assertIn("manual-hook", entry_ids)
            entry = next(e for e in payload["entries"] if e["id"] == "manual-hook")
            self.assertEqual(entry["kind"], "unmanaged")

            # 3. Create a managed hook with the same ID
            response = harness.post_json(
                "/api/hooks",
                {
                    "id": "manual-hook",
                    "event": "PreToolUse",
                    "command": "echo managed",
                    "matcher": "Bash",
                    "timeout": 30,
                    "description": "Say managed",
                },
            )
            self.assertTrue(response["ok"])

            # 4. Reconcile keeping "managed" configuration
            reconcile_resp = harness.post_json(
                "/api/hooks/manual-hook/reconcile",
                {
                    "sourceKind": "managed",
                    "harnesses": ["claude"],
                },
            )
            self.assertTrue(reconcile_resp["ok"])

            # 5. Verify the Claude settings have been updated to the managed version
            settings = json.loads(settings_path.read_text(encoding="utf-8"))
            hook_entry = settings["hooks"]["PreToolUse"][0]["hooks"][0]
            self.assertEqual(hook_entry["command"], "echo managed")
            self.assertEqual(hook_entry["timeout"], 30)

    def test_set_hook_harnesses(self) -> None:
        with AppTestHarness() as harness:
            harness.post_json(
                "/api/hooks",
                {
                    "id": "my-hook",
                    "event": "PreToolUse",
                    "command": "echo hello",
                    "matcher": "Bash",
                    "timeout": 30,
                    "description": "Say hello",
                },
            )

            # Set enabled harnesses to "enabled" (which will enable it on Claude)
            set_resp = harness.post_json(
                "/api/hooks/my-hook/set-harnesses",
                {"target": "enabled"},
            )
            self.assertTrue(set_resp["ok"])

            settings_path = harness.spec.home / ".claude" / "settings.json"
            self.assertTrue(settings_path.is_file())
            settings = json.loads(settings_path.read_text(encoding="utf-8"))
            self.assertEqual(settings["hooks"]["PreToolUse"][0]["hooks"][0]["id"], "my-hook")


if __name__ == "__main__":
    unittest.main()
