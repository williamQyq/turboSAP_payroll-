"""
Configuration Store Service

Provides an abstraction layer for reading/writing configuration files.
Supports local filesystem storage with a path structure ready for future
cloud storage backends (e.g., S3).

Usage:
    from app.services.config_store import config_store

    # Get config (returns dict or None)
    questions = config_store.get("modules/payment-methods/questions")

    # Save config
    config_store.save("modules/payment-methods/questions", {"version": "1.0", "questions": []})

    # Check existence
    if config_store.exists("modules/payment-methods/questions"):
        ...

    # Delete config
    config_store.delete("modules/payment-methods/questions")

    # List configs matching pattern
    module_configs = config_store.list("modules/*/questions")
"""

import json
import logging
import shutil
from abc import ABC, abstractmethod
from fnmatch import fnmatch
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class ConfigStoreError(Exception):
    """Base exception for config store operations."""
    pass


class ConfigNotFoundError(ConfigStoreError):
    """Raised when a config path does not exist."""
    pass


class ConfigStore(ABC):
    """
    Abstract base class for configuration storage.

    All paths are logical paths (e.g., "modules/payment-methods/questions")
    that get translated to actual storage locations by implementations.
    """

    @abstractmethod
    def get(self, path: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve configuration data from the given path.

        Args:
            path: Logical path (e.g., "modules/payment-methods/questions")

        Returns:
            Dict containing the configuration, or None if not found
        """
        pass

    @abstractmethod
    def save(self, path: str, data: Dict[str, Any]) -> None:
        """
        Save configuration data to the given path.

        Args:
            path: Logical path
            data: Configuration data to save
        """
        pass

    @abstractmethod
    def exists(self, path: str) -> bool:
        """
        Check if configuration exists at the given path.

        Args:
            path: Logical path

        Returns:
            True if config exists, False otherwise
        """
        pass

    @abstractmethod
    def delete(self, path: str) -> bool:
        """
        Delete configuration at the given path.

        Args:
            path: Logical path

        Returns:
            True if deleted, False if not found
        """
        pass

    @abstractmethod
    def list(self, pattern: str) -> List[str]:
        """
        List configuration paths matching a glob pattern.

        Args:
            pattern: Glob pattern (e.g., "modules/*/questions")

        Returns:
            List of matching logical paths
        """
        pass

    @abstractmethod
    def copy(self, source: str, destination: str) -> None:
        """
        Copy configuration from source to destination path.

        Args:
            source: Source logical path
            destination: Destination logical path
        """
        pass


class LocalFileConfigStore(ConfigStore):
    """
    Local filesystem implementation of ConfigStore.

    Stores configurations as JSON files under a base directory.
    Paths like "modules/payment-methods/questions" become
    "{base_path}/modules/payment-methods/questions.json"
    """

    def __init__(self, base_path: Optional[Path] = None):
        """
        Initialize the local file config store.

        Args:
            base_path: Base directory for all config files.
                      Defaults to backend/app/data/
        """
        if base_path is None:
            # Default to app/data directory
            base_path = Path(__file__).parent.parent / "data"

        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

        logger.debug(f"LocalFileConfigStore initialized with base_path: {self.base_path}")

    def _resolve_path(self, logical_path: str) -> Path:
        """Convert logical path to actual filesystem path."""
        # Remove leading/trailing slashes and add .json extension
        clean_path = logical_path.strip("/")
        if not clean_path.endswith(".json"):
            clean_path += ".json"
        return self.base_path / clean_path

    def _logical_path(self, file_path: Path) -> str:
        """Convert filesystem path back to logical path."""
        relative = file_path.relative_to(self.base_path)
        # Remove .json extension
        path_str = str(relative)
        if path_str.endswith(".json"):
            path_str = path_str[:-5]
        return path_str

    def get(self, path: str) -> Optional[Dict[str, Any]]:
        """Retrieve configuration from a JSON file."""
        file_path = self._resolve_path(path)

        if not file_path.exists():
            logger.debug(f"Config not found at path: {path}")
            return None

        try:
            with file_path.open("r", encoding="utf-8") as f:
                data = json.load(f)
                logger.debug(f"Loaded config from path: {path}")
                return data
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in config file {path}: {e}")
            raise ConfigStoreError(f"Invalid JSON in config file: {e}")
        except OSError as e:
            logger.error(f"Error reading config file {path}: {e}")
            raise ConfigStoreError(f"Error reading config file: {e}")

    def save(self, path: str, data: Dict[str, Any]) -> None:
        """Save configuration to a JSON file."""
        file_path = self._resolve_path(path)

        # Ensure parent directories exist
        file_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            with file_path.open("w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
                logger.debug(f"Saved config to path: {path}")
        except OSError as e:
            logger.error(f"Error writing config file {path}: {e}")
            raise ConfigStoreError(f"Error writing config file: {e}")

    def exists(self, path: str) -> bool:
        """Check if configuration file exists."""
        file_path = self._resolve_path(path)
        return file_path.exists()

    def delete(self, path: str) -> bool:
        """Delete configuration file."""
        file_path = self._resolve_path(path)

        if not file_path.exists():
            logger.debug(f"Config not found for deletion: {path}")
            return False

        try:
            file_path.unlink()
            logger.debug(f"Deleted config at path: {path}")
            return True
        except OSError as e:
            logger.error(f"Error deleting config file {path}: {e}")
            raise ConfigStoreError(f"Error deleting config file: {e}")

    def list(self, pattern: str) -> List[str]:
        """List configuration paths matching a glob pattern."""
        results = []

        # Convert pattern to path pattern
        clean_pattern = pattern.strip("/")
        if not clean_pattern.endswith(".json"):
            clean_pattern += ".json"

        # Walk through all json files
        for json_file in self.base_path.rglob("*.json"):
            relative_path = json_file.relative_to(self.base_path)
            if fnmatch(str(relative_path), clean_pattern):
                results.append(self._logical_path(json_file))

        return sorted(results)

    def copy(self, source: str, destination: str) -> None:
        """Copy configuration from source to destination."""
        source_path = self._resolve_path(source)
        dest_path = self._resolve_path(destination)

        if not source_path.exists():
            raise ConfigNotFoundError(f"Source config not found: {source}")

        # Ensure destination parent directories exist
        dest_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            shutil.copy2(source_path, dest_path)
            logger.debug(f"Copied config from {source} to {destination}")
        except OSError as e:
            logger.error(f"Error copying config from {source} to {destination}: {e}")
            raise ConfigStoreError(f"Error copying config: {e}")

    def get_absolute_path(self, path: str) -> Path:
        """
        Get the absolute filesystem path for a logical path.

        Useful for backward compatibility when absolute paths are needed.

        Args:
            path: Logical path

        Returns:
            Absolute Path object
        """
        return self._resolve_path(path)


# Singleton instance for easy import
# Uses default base_path (backend/app/data/)
config_store = LocalFileConfigStore()


# Legacy compatibility functions
def get_legacy_path_mapping() -> Dict[str, str]:
    """
    Returns a mapping of old file paths to new logical paths.

    This helps during migration and for maintaining backward compatibility.
    """
    return {
        # Old payment method location → new
        "payment_method_questions.json": "modules/payment-methods/questions",

        # Old payroll area location (in config/) → new
        # Note: This was in config/ not data/
        "../config/questions_current.json": "modules/payroll-area/questions",

        # Backup files
        "payment_method_questions_backup.json": "modules/payment-methods/questions_backup",
        "../config/questions_backup.json": "modules/payroll-area/questions_backup",
        "../config/questions_original.json": "modules/payroll-area/questions_original",

        # Metadata
        "modules_metadata.json": "metadata/modules",
    }
