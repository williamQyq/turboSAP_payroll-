"""
SessionOutputStore - Abstraction for session output persistence

Same pattern as ConfigStore. Allows swapping between local filesystem
and S3 storage without changing business logic.
"""

import json
import os
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Any


class SessionOutputStore(ABC):
    """Abstract interface for session output storage."""

    @abstractmethod
    def save_output(
        self,
        module_slug: str,
        session_id: str,
        outputs: dict[str, Any],
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Save output files for a completed session."""
        pass

    @abstractmethod
    def get_output(self, module_slug: str, session_id: str) -> dict[str, Any] | None:
        """Get output files for a session. Returns None if not found."""
        pass

    @abstractmethod
    def list_outputs(self, module_slug: str) -> list[dict[str, Any]]:
        """List all completed sessions for a module with metadata."""
        pass

    @abstractmethod
    def delete_output(self, module_slug: str, session_id: str) -> bool:
        """Delete output for a session. Returns True if deleted."""
        pass

    @abstractmethod
    def get_all_outputs(self) -> dict[str, list[dict[str, Any]]]:
        """Get all outputs across all modules. Returns {module_slug: [sessions]}."""
        pass


class LocalSessionOutputStore(SessionOutputStore):
    """
    Local filesystem implementation of SessionOutputStore.

    Structure:
        data/outputs/{module_slug}/{session_id}/
            metadata.json   - completion time, answers summary, etc.
            {filename}.csv  - actual output files
    """

    def __init__(self, base_path: str | None = None):
        if base_path is None:
            # Default to data/outputs relative to app
            app_dir = Path(__file__).parent.parent
            base_path = str(app_dir / "data" / "outputs")

        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _get_session_dir(self, module_slug: str, session_id: str) -> Path:
        return self.base_path / module_slug / session_id

    def _get_metadata_path(self, module_slug: str, session_id: str) -> Path:
        return self._get_session_dir(module_slug, session_id) / "metadata.json"

    def save_output(
        self,
        module_slug: str,
        session_id: str,
        outputs: dict[str, Any],
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """
        Save output files for a completed session.

        Args:
            module_slug: Module identifier
            session_id: Session identifier
            outputs: Dict of {filename: content} - content can be string (CSV) or dict (JSON)
            metadata: Optional metadata (completedAt, answersCount, etc.)
        """
        session_dir = self._get_session_dir(module_slug, session_id)
        session_dir.mkdir(parents=True, exist_ok=True)

        # Save each output file
        files_saved = []
        for filename, content in outputs.items():
            file_path = session_dir / filename

            if isinstance(content, str):
                # CSV or text content
                file_path.write_text(content, encoding="utf-8")
            else:
                # JSON content
                file_path.write_text(json.dumps(content, indent=2), encoding="utf-8")

            files_saved.append(filename)

        # Save metadata
        meta = metadata or {}
        meta.update({
            "sessionId": session_id,
            "moduleSlug": module_slug,
            "completedAt": meta.get("completedAt", datetime.utcnow().isoformat() + "Z"),
            "files": files_saved,
        })

        metadata_path = self._get_metadata_path(module_slug, session_id)
        metadata_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    def get_output(self, module_slug: str, session_id: str) -> dict[str, Any] | None:
        """
        Get output files for a session.

        Returns:
            {
                "metadata": {...},
                "files": {filename: content, ...}
            }
            or None if not found
        """
        session_dir = self._get_session_dir(module_slug, session_id)
        metadata_path = self._get_metadata_path(module_slug, session_id)

        if not metadata_path.exists():
            return None

        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, IOError):
            return None

        # Load all output files
        files = {}
        for filename in metadata.get("files", []):
            file_path = session_dir / filename
            if file_path.exists():
                content = file_path.read_text(encoding="utf-8")
                # Try to parse as JSON, otherwise keep as string
                if filename.endswith(".json"):
                    try:
                        content = json.loads(content)
                    except json.JSONDecodeError:
                        pass
                files[filename] = content

        return {
            "metadata": metadata,
            "files": files,
        }

    def list_outputs(self, module_slug: str) -> list[dict[str, Any]]:
        """
        List all completed sessions for a module.

        Returns list of metadata dicts for each session.
        """
        module_dir = self.base_path / module_slug

        if not module_dir.exists():
            return []

        sessions = []
        for session_dir in module_dir.iterdir():
            if session_dir.is_dir():
                metadata_path = session_dir / "metadata.json"
                if metadata_path.exists():
                    try:
                        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
                        sessions.append(metadata)
                    except (json.JSONDecodeError, IOError):
                        continue

        # Sort by completion time, most recent first
        sessions.sort(key=lambda s: s.get("completedAt", ""), reverse=True)
        return sessions

    def delete_output(self, module_slug: str, session_id: str) -> bool:
        """Delete output for a session."""
        session_dir = self._get_session_dir(module_slug, session_id)

        if not session_dir.exists():
            return False

        # Delete all files in the session directory
        for file_path in session_dir.iterdir():
            file_path.unlink()

        # Remove the directory
        session_dir.rmdir()

        # Clean up empty module directory
        module_dir = self.base_path / module_slug
        if module_dir.exists() and not any(module_dir.iterdir()):
            module_dir.rmdir()

        return True

    def get_all_outputs(self) -> dict[str, list[dict[str, Any]]]:
        """
        Get all outputs across all modules.

        Returns:
            {module_slug: [session_metadata, ...], ...}
        """
        if not self.base_path.exists():
            return {}

        all_outputs = {}
        for module_dir in self.base_path.iterdir():
            if module_dir.is_dir():
                module_slug = module_dir.name
                sessions = self.list_outputs(module_slug)
                if sessions:
                    all_outputs[module_slug] = sessions

        return all_outputs


# Singleton instance for easy import
session_output_store = LocalSessionOutputStore()
