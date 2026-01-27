"""
Question Schema Definitions

Pydantic models for question configuration validation.
These schemas define the structure of questions used in configuration modules.

Note: The outputMapping field is defined but NOT enforced yet.
Existing question files won't have it, and that's fine.
This is setting up the schema for future phases.
"""

from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator, model_validator


class QuestionType(str, Enum):
    """Valid question types."""

    SINGLE_SELECT = "single_select"
    MULTI_SELECT = "multi_select"
    MULTIPLE_SELECT = "multiple_select"  # Alias for multi_select
    MULTIPLE_CHOICE = "multiple_choice"  # Legacy: treated as single_select
    CHOICE = "choice"  # Legacy: treated as single_select
    TEXT = "text"
    FREE_TEXT = "free_text"  # Legacy: treated as text
    NUMBER = "number"
    YES_NO = "yes_no"


class QuestionOption(BaseModel):
    """
    Represents an option for choice-type questions.

    Supports both new format (value/label) and existing format (id/label).
    """

    # Primary fields (new format)
    value: Optional[str] = Field(None, description="Option value (used in answers)")
    label: str = Field(..., description="Display label for the option")

    # Legacy fields (existing format) - mapped to value
    id: Optional[str] = Field(None, description="Legacy: option ID (maps to value)")
    description: Optional[str] = Field(None, description="Optional help text for the option")

    @model_validator(mode="before")
    @classmethod
    def normalize_value(cls, data: Any) -> Any:
        """Ensure 'value' is populated from 'id' if not provided."""
        if isinstance(data, dict):
            # If 'value' not provided but 'id' is, use 'id' as 'value'
            if data.get("value") is None and data.get("id") is not None:
                data["value"] = data["id"]
            # If neither value nor id, this will fail validation appropriately
        return data

    @model_validator(mode="after")
    def ensure_value_or_id(self) -> "QuestionOption":
        """Ensure at least value or id is provided."""
        if self.value is None and self.id is None:
            raise ValueError("Either 'value' or 'id' must be provided for an option")
        return self

    def get_value(self) -> str:
        """Get the effective value (prefers 'value', falls back to 'id')."""
        return self.value or self.id or ""

    class Config:
        extra = "allow"  # Allow extra fields for forward compatibility


class ShowIfCondition(BaseModel):
    """
    Conditional display logic for questions.

    Supports both new format (equals/notEquals/contains) and
    existing format (answerId).
    """

    questionId: str = Field(..., description="ID of the question this depends on")

    # New format conditions
    equals: Optional[str] = Field(None, description="Show if answer equals this value")
    notEquals: Optional[str] = Field(None, description="Show if answer does not equal this value")
    contains: Optional[str] = Field(None, description="Show if answer contains this value (for multi-select)")

    # Legacy format
    answerId: Optional[str] = Field(None, description="Legacy: show if this answer is selected")

    @model_validator(mode="after")
    def ensure_condition(self) -> "ShowIfCondition":
        """Ensure at least one condition is specified."""
        has_condition = any([
            self.equals is not None,
            self.notEquals is not None,
            self.contains is not None,
            self.answerId is not None,
        ])
        if not has_condition:
            raise ValueError("ShowIfCondition must have at least one condition (equals, notEquals, contains, or answerId)")
        return self

    def matches(self, answer: Union[str, List[str], None]) -> bool:
        """
        Check if the given answer matches this condition.

        Args:
            answer: The answer value(s) to check against

        Returns:
            True if condition is satisfied
        """
        if answer is None:
            return False

        # Normalize answer to list
        answers = [answer] if isinstance(answer, str) else list(answer)

        # Check legacy answerId
        if self.answerId is not None:
            return self.answerId in answers

        # Check equals
        if self.equals is not None:
            return self.equals in answers

        # Check notEquals
        if self.notEquals is not None:
            return self.notEquals not in answers

        # Check contains
        if self.contains is not None:
            return self.contains in answers

        return False

    class Config:
        extra = "allow"


class TransformType(str, Enum):
    """Transform types for output mapping."""

    DIRECT = "direct"
    YES_NO = "yes_no"
    VALUE_LOOKUP = "value_lookup"
    ROW_PER_SELECTED = "row_per_selected"


class OutputMapping(BaseModel):
    """
    Mapping configuration for how question answers translate to output files.

    NOT enforced yet - this is preparation for Phase 2.
    Existing question files won't have this field.
    """

    file: str = Field(..., description="Target output file (e.g., 'payment_methods.csv')")
    column: str = Field(..., description="Target column in the file (e.g., 'PaymentType')")
    transform: TransformType = Field(
        default=TransformType.DIRECT,
        description="How to transform the answer value"
    )
    valueMap: Optional[Dict[str, str]] = Field(
        None,
        description="Value mapping for 'value_lookup' transform"
    )

    @model_validator(mode="after")
    def validate_value_map(self) -> "OutputMapping":
        """Ensure valueMap is provided when transform is value_lookup."""
        if self.transform == TransformType.VALUE_LOOKUP and not self.valueMap:
            raise ValueError("valueMap is required when transform is 'value_lookup'")
        return self

    class Config:
        extra = "allow"


class Question(BaseModel):
    """
    A single question in a configuration module.

    Supports both new and legacy field names for backward compatibility.
    """

    id: str = Field(..., description="Unique identifier for the question")
    text: str = Field(..., description="The question text to display")
    type: str = Field(
        ...,
        description="Question type (single_select, multi_select, text, number, yes_no, or legacy types)"
    )

    # Optional fields
    options: Optional[List[QuestionOption]] = Field(
        None,
        description="Options for choice-type questions"
    )
    showIf: Optional[ShowIfCondition] = Field(
        None,
        description="Conditional display logic"
    )
    order: Optional[int] = Field(
        None,
        description="Display order (lower numbers first)"
    )
    helpText: Optional[str] = Field(
        None,
        description="Additional help text for the question"
    )

    # Future field - not enforced yet
    outputMapping: Optional[OutputMapping] = Field(
        None,
        description="Output mapping configuration (Phase 2 - not used yet)"
    )

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        """Validate question type, accepting legacy types."""
        valid_types = {
            # New types
            "single_select",
            "multi_select",
            "text",
            "number",
            "yes_no",
            # Legacy types
            "multiple_choice",
            "multiple_select",
            "choice",
            "free_text",
        }
        if v not in valid_types:
            raise ValueError(f"Invalid question type: {v}. Valid types: {valid_types}")
        return v

    def get_normalized_type(self) -> str:
        """Get the normalized question type (maps legacy to new types)."""
        type_mapping = {
            "multiple_choice": "single_select",
            "choice": "single_select",
            "free_text": "text",
            "multiple_select": "multi_select",
        }
        return type_mapping.get(self.type, self.type)

    def requires_options(self) -> bool:
        """Check if this question type requires options."""
        return self.type in {
            "single_select",
            "multi_select",
            "multiple_choice",
            "multiple_select",
            "choice",
            "yes_no",
        }

    class Config:
        extra = "allow"  # Allow extra fields for forward compatibility


class QuestionsConfig(BaseModel):
    """
    Root configuration containing a list of questions.

    This is the structure of a questions.json file.
    """

    version: str = Field(default="1.0", description="Schema version")
    questions: List[Question] = Field(default_factory=list, description="List of questions")

    # Optional metadata
    metadata: Optional[Dict[str, Any]] = Field(
        None,
        description="Additional metadata (createdAt, createdBy, etc.)"
    )

    def get_question_by_id(self, question_id: str) -> Optional[Question]:
        """Find a question by its ID."""
        for q in self.questions:
            if q.id == question_id:
                return q
        return None

    def get_all_question_ids(self) -> List[str]:
        """Get list of all question IDs."""
        return [q.id for q in self.questions]

    def validate_showif_references(self) -> List[str]:
        """
        Check that all showIf references point to existing questions.

        Returns:
            List of warning messages for invalid references
        """
        warnings = []
        all_ids = set(self.get_all_question_ids())

        for q in self.questions:
            if q.showIf and q.showIf.questionId not in all_ids:
                warnings.append(
                    f"Question '{q.id}' has showIf referencing non-existent question '{q.showIf.questionId}'"
                )

        return warnings

    class Config:
        extra = "allow"


# Type aliases for convenience
QuestionDict = Dict[str, Any]
QuestionsConfigDict = Dict[str, Any]
