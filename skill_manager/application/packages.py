from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from skill_manager.atomic_files import atomic_write_text


@dataclass(frozen=True)
class PackageMeta:
    slug: str
    name: str
    version: int
    mutable: bool
    active: bool


def load_package_meta(path: Path) -> PackageMeta:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return PackageMeta(
        slug=data["slug"],
        name=data["name"],
        version=data["version"],
        mutable=data["mutable"],
        active=data["active"],
    )


def write_package_meta(path: Path, meta: PackageMeta) -> None:
    data = {
        "slug": meta.slug,
        "name": meta.name,
        "version": meta.version,
        "mutable": meta.mutable,
        "active": meta.active,
    }
    atomic_write_text(path, json.dumps(data, indent=2))


def list_package_dirs(packages_root: Path) -> tuple[Path, ...]:
    if not packages_root.is_dir():
        return ()
    dirs = []
    for path in packages_root.iterdir():
        if path.is_dir() and (path / "package.json").is_file():
            dirs.append(path)
    return tuple(sorted(dirs, key=lambda p: p.name))
