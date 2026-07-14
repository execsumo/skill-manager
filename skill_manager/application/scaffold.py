from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel


class ScaffoldRequest(BaseModel):
    asset_type: str  # "skill", "agent", "mcp", "hook"
    name: str
    description: str


class ScaffoldService:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        # Current package directory (defaulting to local)
        self.local_pkg_dir = data_dir / "packages" / "local"

    def scaffold_asset(self, req: ScaffoldRequest) -> Path:
        templates_dir = Path(__file__).parent.parent / "data" / "templates"
        
        if req.asset_type == "skill":
            template_path = templates_dir / "skill.md"
            out_dir = self.local_pkg_dir / "skills"
            ext = ".md"
        elif req.asset_type == "agent":
            template_path = templates_dir / "agent.md"
            out_dir = self.local_pkg_dir / "agents"
            ext = ".md"
        elif req.asset_type == "mcp":
            template_path = templates_dir / "mcp.json"
            out_dir = self.local_pkg_dir / "mcpServers"
            ext = ".json"
        elif req.asset_type == "hook":
            template_path = templates_dir / "hook.sh"
            out_dir = self.local_pkg_dir / "hooks"
            ext = ".sh"
        else:
            raise ValueError(f"Unknown asset type: {req.asset_type}")

        if not template_path.exists():
            raise FileNotFoundError(f"Template for {req.asset_type} not found at {template_path}")

        template_content = template_path.read_text(encoding="utf-8")
        
        # Hydrate template
        hydrated = template_content.replace("{{name}}", req.name)
        hydrated = hydrated.replace("{{description}}", req.description)
        
        # Generate slug for filename
        slug = req.name.lower().replace(" ", "-").replace("/", "-")
        out_file = out_dir / f"{slug}{ext}"
        
        out_dir.mkdir(parents=True, exist_ok=True)
        out_file.write_text(hydrated, encoding="utf-8")
        
        return out_file
