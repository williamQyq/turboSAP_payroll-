"""
Module Schema Definitions

Pydantic models for module configuration and metadata.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from .question import Question, QuestionsConfig


class ModuleMetadata(BaseModel):
    """
    Metadata for a module (stored in config.json or modules_metadata.json).
    """

    slug: str = Field(..., description="URL-friendly identifier")
    name: str = Field(..., description="Display name")
    description: str = Field(default="", description="Module description")
    category: Optional[str] = Field(None, description="Category slug for grouping")
    icon: str = Field(default="settings", description="Icon identifier")
    status: str = Field(default="active", description="Module status: active, inactive, draft")
    order: int = Field(default=999, description="Display order")
    version: str = Field(default="1.0", description="Config version")
    created_at: Optional[datetime] = Field(None, alias="createdAt")
    created_by: Optional[str] = Field(None, alias="createdBy")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")

    class Config:
        populate_by_name = True
        extra = "allow"


class ModuleConfig(BaseModel):
    """
    Complete module configuration including metadata and questions.
    """

    metadata: ModuleMetadata
    questions: List[Question] = Field(default_factory=list)

    # Computed properties
    @property
    def slug(self) -> str:
        return self.metadata.slug

    @property
    def name(self) -> str:
        return self.metadata.name

    def get_question_by_id(self, question_id: str) -> Optional[Question]:
        """Find a question by its ID."""
        for q in self.questions:
            if q.id == question_id:
                return q
        return None

    def get_output_files(self) -> List[str]:
        """Get list of unique output filenames from all questions."""
        files = set()
        for q in self.questions:
            # Handle both Question objects and dicts
            if hasattr(q, 'outputMapping'):
                mapping = q.outputMapping
                if mapping and hasattr(mapping, 'file') and mapping.file:
                    files.add(mapping.file)
            elif isinstance(q, dict) and q.get('outputMapping'):
                mapping = q['outputMapping']
                if isinstance(mapping, dict) and mapping.get('file'):
                    files.add(mapping['file'])
        return sorted(files)

    class Config:
        extra = "allow"


class ModuleSummary(BaseModel):
    """
    Summary info for listing modules (doesn't include full questions).
    """

    slug: str
    name: str
    description: str = ""
    category: Optional[str] = None
    icon: str = "settings"
    status: str = "active"
    order: int = 999
    question_count: int = 0
    output_files: List[str] = Field(default_factory=list)
    has_config: bool = False
    has_questions: bool = False

    class Config:
        extra = "allow"


class CreateModuleRequest(BaseModel):
    """Request body for creating a new module."""

    name: str = Field(..., min_length=1, description="Display name")
    slug: Optional[str] = Field(None, description="URL-friendly ID (auto-generated if not provided)")
    description: str = Field(default="", description="Module description")
    category: Optional[str] = Field(None, description="Category slug")
    icon: str = Field(default="settings", description="Icon identifier")

    class Config:
        extra = "allow"


class UpdateModuleRequest(BaseModel):
    """Request body for updating module metadata."""

    name: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    category: Optional[str] = None
    icon: Optional[str] = None
    status: Optional[str] = None
    order: Optional[int] = None

    class Config:
        extra = "allow"
