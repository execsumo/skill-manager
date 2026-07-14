from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.application.container import _migrate_to_packages
from skill_manager.application.packages import write_package_meta, PackageMeta
from skill_manager.application.skills.manifest import SkillStoreManifest, SkillStoreEntry, write_skill_store_manifest
from skill_manager.application.skills.store import SkillStore
from tests.support.fake_home import create_fake_home_spec, seed_skill_package, seed_legacy_store_manifest


class PackageMigrationTests(unittest.TestCase):
    def test_fresh_migration_from_legacy(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            
            # Setup legacy layout
            legacy_shared = spec.legacy_skills_store_root
            legacy_shared.mkdir(parents=True, exist_ok=True)
            seed_skill_package(legacy_shared, "audit", "Audit Skill")
            
            manifest_path = legacy_shared.parent / "manifest.json"
            seed_legacy_store_manifest(spec, [
                SkillStoreEntry(
                    package_dir="audit",
                    declared_name="Audit Skill",
                    source_kind="github",
                    source_locator="github:org/repo",
                    revision=""
                )
            ])
            
            self.assertTrue(legacy_shared.exists())
            
            # Run migration
            _migrate_to_packages(spec.xdg_data_home / "skill-manager", spec.packages_root)
            
            # Assert legacy is gone, new is there
            self.assertFalse(legacy_shared.exists())
            self.assertTrue((spec.packages_root / "local" / "skills" / "audit").is_dir())
            self.assertTrue((spec.packages_root / "local" / "manifest.json").is_file())
            self.assertTrue((spec.packages_root / "local" / "package.json").is_file())

    def test_idempotent_second_run(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            _migrate_to_packages(spec.xdg_data_home / "skill-manager", spec.packages_root)
            
            # Add something to local to prove it's untouched
            (spec.packages_root / "local" / "skills").mkdir(parents=True, exist_ok=True)
            (spec.packages_root / "local" / "skills" / "test").touch()
            
            _migrate_to_packages(spec.xdg_data_home / "skill-manager", spec.packages_root)
            self.assertTrue((spec.packages_root / "local" / "skills" / "test").exists())

    def test_fresh_install_no_legacy(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            
            # No legacy setup
            self.assertFalse(spec.legacy_skills_store_root.exists())
            
            _migrate_to_packages(spec.xdg_data_home / "skill-manager", spec.packages_root)
            
            self.assertTrue((spec.packages_root / "local" / "package.json").is_file())
            self.assertTrue((spec.packages_root / "local" / "skills").is_dir())


class MultiPackageScanTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = TemporaryDirectory()
        self.spec = create_fake_home_spec(Path(self.temp_dir.name))
        _migrate_to_packages(self.spec.xdg_data_home / "skill-manager", self.spec.packages_root)
        self.store = SkillStore(
            root=self.spec.skills_store_root,
            packages_root=self.spec.packages_root,
        )

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_multi_package_scan(self) -> None:
        # Create 'remote' package
        remote_pkg = self.spec.packages_root / "remote"
        remote_pkg.mkdir(parents=True, exist_ok=True)
        write_package_meta(remote_pkg / "package.json", PackageMeta(slug="remote", name="Remote", version=1, mutable=False, active=True))
        
        seed_skill_package(remote_pkg / "skills", "remote-audit", "Remote Audit")
        write_skill_store_manifest(remote_pkg / "manifest.json", SkillStoreManifest(entries=(
            SkillStoreEntry("remote-audit", "Remote Audit", "github", "github:remote", revision=""),
        )))

        # Create 'local' skill
        seed_skill_package(self.spec.skills_store_root, "local-audit", "Local Audit")
        write_skill_store_manifest(self.spec.packages_root / "local" / "manifest.json", SkillStoreManifest(entries=(
            SkillStoreEntry("local-audit", "Local Audit", "github", "github:local", revision=""),
        )))
        
        scan = self.store.scan()
        self.assertEqual(len(scan.packages), 2)
        slugs = {p.owning_package_slug for p in scan.packages}
        self.assertEqual(slugs, {"local", "remote"})

    def test_inactive_package_excluded(self) -> None:
        # Create 'inactive_pkg' package
        inactive_pkg = self.spec.packages_root / "inactive"
        inactive_pkg.mkdir(parents=True, exist_ok=True)
        write_package_meta(inactive_pkg / "package.json", PackageMeta(slug="inactive", name="Inactive", version=1, mutable=False, active=False))
        seed_skill_package(inactive_pkg / "skills", "inactive-audit", "Inactive Audit")
        
        scan = self.store.scan()
        self.assertEqual(len(scan.packages), 0)

    def test_duplicate_ref_collision(self) -> None:
        remote_pkg = self.spec.packages_root / "remote"
        remote_pkg.mkdir(parents=True, exist_ok=True)
        write_package_meta(remote_pkg / "package.json", PackageMeta(slug="remote", name="Remote", version=1, mutable=False, active=True))
        
        # Exact same name and locator
        seed_skill_package(remote_pkg / "skills", "audit", "Audit")
        write_skill_store_manifest(remote_pkg / "manifest.json", SkillStoreManifest(entries=(
            SkillStoreEntry("audit", "Audit", "github", "github:dup", revision=""),
        )))
        
        seed_skill_package(self.spec.skills_store_root, "audit", "Audit")
        write_skill_store_manifest(self.spec.packages_root / "local" / "manifest.json", SkillStoreManifest(entries=(
            SkillStoreEntry("audit", "Audit", "github", "github:dup", revision=""),
        )))
        
        scan = self.store.scan()
        self.assertEqual(len(scan.packages), 1)
        self.assertEqual(scan.packages[0].owning_package_slug, "local")
        self.assertTrue(any("Duplicate skill ref" in issue for issue in scan.issues))

    def test_immutable_package_mutation_rejected(self) -> None:
        # Make local immutable for this test
        write_package_meta(self.spec.packages_root / "local" / "package.json", PackageMeta(slug="local", name="Local", version=1, mutable=False, active=True))
        
        source = seed_skill_package(Path(self.temp_dir.name) / "src", "audit", "Audit")
        with self.assertRaises(ValueError):
            self.store.ingest(
                source_path=source,
                declared_name="Audit",
                source_kind="github",
                source_locator="github:foo"
            )
        
        with self.assertRaises(ValueError):
            self.store.update("audit", source_path=source)
            
        with self.assertRaises(ValueError):
            self.store.delete("audit")

if __name__ == "__main__":
    unittest.main()
