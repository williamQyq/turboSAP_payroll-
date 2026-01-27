"""
Module Service

Service for module CRUD operations.
Modules are defined by their config files, not by code.
Uses ConfigStore for all file operations.
"""

import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..schemas.module import (
    CreateModuleRequest,
    ModuleConfig,
    ModuleMetadata,
    ModuleSummary,
    UpdateModuleRequest,
)
from ..schemas.question import Question
from .config_store import ConfigStore, ConfigStoreError, config_store

logger = logging.getLogger(__name__)


class ModuleServiceError(Exception):
    """Base exception for module service operations."""
    pass


class ModuleNotFoundError(ModuleServiceError):
    """Raised when a module is not found."""
    pass


class ModuleAlreadyExistsError(ModuleServiceError):
    """Raised when trying to create a module that already exists."""
    pass


class ModuleService:
    """
    Service for module CRUD operations.

    Modules are discovered from the filesystem - no hardcoded list.
    Each module is a directory under modules/ with config.json and questions.json.
    """

    def __init__(self, store: Optional[ConfigStore] = None):
        """
        Initialize the module service.

        Args:
            store: ConfigStore instance. Defaults to the global config_store.
        """
        self.store = store or config_store
        self.modules_base = "modules"

    def _slugify(self, name: str) -> str:
        """Convert a name to a URL-friendly slug."""
        # Lowercase, replace spaces with hyphens, remove special chars
        slug = name.lower().strip()
        slug = re.sub(r'\s+', '-', slug)
        slug = re.sub(r'[^a-z0-9-]', '', slug)
        slug = re.sub(r'-+', '-', slug)  # Remove multiple hyphens
        slug = slug.strip('-')
        return slug

    def _get_config_path(self, slug: str) -> str:
        """Get the config.json path for a module."""
        return f"{self.modules_base}/{slug}/config"

    def _get_questions_path(self, slug: str) -> str:
        """Get the questions.json path for a module."""
        return f"{self.modules_base}/{slug}/questions"

    def list_modules(self) -> List[ModuleSummary]:
        """
        List all modules by scanning the modules/ directory.

        Returns:
            List of ModuleSummary objects
        """
        modules = []

        # Get all config files in modules/*/config.json
        config_paths = self.store.list(f"{self.modules_base}/*/config")

        for config_path in config_paths:
            try:
                # Extract slug from path (modules/{slug}/config)
                parts = config_path.split("/")
                if len(parts) >= 2:
                    slug = parts[1]
                    summary = self._get_module_summary(slug)
                    if summary:
                        modules.append(summary)
            except Exception as e:
                logger.warning(f"Error loading module from {config_path}: {e}")
                continue

        # Sort by order, then name
        modules.sort(key=lambda m: (m.order, m.name))

        return modules

    def _get_module_summary(self, slug: str) -> Optional[ModuleSummary]:
        """Get summary info for a module."""
        config_data = self.store.get(self._get_config_path(slug))
        if not config_data:
            return None

        questions_data = self.store.get(self._get_questions_path(slug))
        questions = questions_data.get("questions", []) if questions_data else []

        # Extract output files from questions
        output_files = set()
        for q in questions:
            mapping = q.get("outputMapping")
            if mapping and mapping.get("file"):
                output_files.add(mapping["file"])

        return ModuleSummary(
            slug=slug,
            name=config_data.get("name", slug),
            description=config_data.get("description", ""),
            category=config_data.get("category"),
            icon=config_data.get("icon", "settings"),
            status=config_data.get("status", "active"),
            order=config_data.get("order", 999),
            question_count=len(questions),
            output_files=sorted(output_files),
            has_config=True,
            has_questions=len(questions) > 0,
        )

    def get_module(self, slug: str) -> Optional[ModuleConfig]:
        """
        Get complete module config including metadata and questions.

        Args:
            slug: Module slug

        Returns:
            ModuleConfig or None if not found
        """
        config_data = self.store.get(self._get_config_path(slug))
        if not config_data:
            return None

        # Build metadata
        metadata = ModuleMetadata(
            slug=slug,
            name=config_data.get("name", slug),
            description=config_data.get("description", ""),
            category=config_data.get("category"),
            icon=config_data.get("icon", "settings"),
            status=config_data.get("status", "active"),
            order=config_data.get("order", 999),
            version=config_data.get("version", "1.0"),
            createdAt=config_data.get("createdAt"),
            createdBy=config_data.get("createdBy"),
            updatedAt=config_data.get("updatedAt"),
        )

        # Load questions
        questions_data = self.store.get(self._get_questions_path(slug))
        questions = []
        if questions_data and "questions" in questions_data:
            for q_data in questions_data["questions"]:
                try:
                    questions.append(Question.model_validate(q_data))
                except Exception as e:
                    logger.warning(f"Error parsing question in {slug}: {e}")
                    # Still include the raw data as a Question-like dict
                    questions.append(Question.model_construct(**q_data))

        return ModuleConfig(metadata=metadata, questions=questions)

    def create_module(
        self,
        request: CreateModuleRequest,
        created_by: Optional[str] = None,
    ) -> ModuleConfig:
        """
        Create a new module.

        Args:
            request: CreateModuleRequest with module details
            created_by: Username of creator

        Returns:
            Created ModuleConfig

        Raises:
            ModuleAlreadyExistsError: If module with slug already exists
        """
        # Generate slug if not provided
        slug = request.slug or self._slugify(request.name)

        if not slug:
            raise ModuleServiceError("Could not generate valid slug from name")

        # Check if already exists
        if self.module_exists(slug):
            raise ModuleAlreadyExistsError(f"Module '{slug}' already exists")

        now = datetime.utcnow().isoformat()

        # Create config.json
        config_data = {
            "slug": slug,
            "name": request.name,
            "description": request.description,
            "category": request.category,
            "icon": request.icon,
            "status": "draft",
            "order": 999,
            "version": "1.0",
            "createdAt": now,
            "createdBy": created_by or "system",
        }

        # Create empty questions.json
        questions_data = {
            "version": "1.0",
            "questions": [],
            "metadata": {
                "createdAt": now,
                "createdBy": created_by or "system",
            }
        }

        # Save both files
        self.store.save(self._get_config_path(slug), config_data)
        self.store.save(self._get_questions_path(slug), questions_data)

        logger.info(f"Created module: {slug}")

        return self.get_module(slug)

    def update_module(
        self,
        slug: str,
        request: UpdateModuleRequest,
        updated_by: Optional[str] = None,
    ) -> ModuleConfig:
        """
        Update module metadata.

        Args:
            slug: Module slug
            request: UpdateModuleRequest with fields to update
            updated_by: Username of updater

        Returns:
            Updated ModuleConfig

        Raises:
            ModuleNotFoundError: If module doesn't exist
        """
        config_data = self.store.get(self._get_config_path(slug))
        if not config_data:
            raise ModuleNotFoundError(f"Module '{slug}' not found")

        # Update fields that are provided
        if request.name is not None:
            config_data["name"] = request.name
        if request.description is not None:
            config_data["description"] = request.description
        if request.category is not None:
            config_data["category"] = request.category
        if request.icon is not None:
            config_data["icon"] = request.icon
        if request.status is not None:
            config_data["status"] = request.status
        if request.order is not None:
            config_data["order"] = request.order

        config_data["updatedAt"] = datetime.utcnow().isoformat()
        if updated_by:
            config_data["updatedBy"] = updated_by

        self.store.save(self._get_config_path(slug), config_data)

        logger.info(f"Updated module: {slug}")

        return self.get_module(slug)

    def delete_module(self, slug: str) -> bool:
        """
        Delete a module and all its files.

        Args:
            slug: Module slug

        Returns:
            True if deleted, False if not found
        """
        if not self.module_exists(slug):
            return False

        # Delete config and questions
        self.store.delete(self._get_config_path(slug))
        self.store.delete(self._get_questions_path(slug))

        # Also try to delete any backup files
        self.store.delete(f"{self.modules_base}/{slug}/questions_backup")
        self.store.delete(f"{self.modules_base}/{slug}/questions_original")

        logger.info(f"Deleted module: {slug}")

        return True

    def module_exists(self, slug: str) -> bool:
        """
        Check if a module exists.

        A module exists if it has a config.json file.

        Args:
            slug: Module slug

        Returns:
            True if module exists
        """
        return self.store.exists(self._get_config_path(slug))

    def get_module_metadata(self, slug: str) -> Optional[ModuleMetadata]:
        """
        Get just the metadata for a module (without loading questions).

        Args:
            slug: Module slug

        Returns:
            ModuleMetadata or None if not found
        """
        config_data = self.store.get(self._get_config_path(slug))
        if not config_data:
            return None

        return ModuleMetadata(
            slug=slug,
            name=config_data.get("name", slug),
            description=config_data.get("description", ""),
            category=config_data.get("category"),
            icon=config_data.get("icon", "settings"),
            status=config_data.get("status", "active"),
            order=config_data.get("order", 999),
            version=config_data.get("version", "1.0"),
            createdAt=config_data.get("createdAt"),
            createdBy=config_data.get("createdBy"),
            updatedAt=config_data.get("updatedAt"),
        )


# Singleton instance for easy import
module_service = ModuleService()
