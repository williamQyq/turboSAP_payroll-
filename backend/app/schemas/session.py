"""
Session Schema Definitions

Pydantic models for module session state and output generation.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field


class SessionStatus(str, Enum):
    """Session status values."""

    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class Answer(BaseModel):
    """A single answer to a question."""

    question_id: str = Field(..., alias="questionId")
    value: Any = Field(..., description="The answer value")
    answered_at: datetime = Field(default_factory=datetime.utcnow, alias="answeredAt")

    class Config:
        populate_by_name = True
        extra = "allow"


class SessionState(BaseModel):
    """
    Complete state of a module session.
    Stored in database or memory during execution.
    """

    session_id: str = Field(..., alias="sessionId")
    module_slug: str = Field(..., alias="moduleSlug")
    status: SessionStatus = Field(default=SessionStatus.IN_PROGRESS)
    answers: Dict[str, Any] = Field(default_factory=dict, description="Map of question_id -> answer value")
    current_question_id: Optional[str] = Field(None, alias="currentQuestionId")
    started_at: datetime = Field(default_factory=datetime.utcnow, alias="startedAt")
    completed_at: Optional[datetime] = Field(None, alias="completedAt")
    user_id: Optional[int] = Field(None, alias="userId")

    def get_answer(self, question_id: str) -> Any:
        """Get answer for a specific question."""
        return self.answers.get(question_id)

    def set_answer(self, question_id: str, value: Any) -> None:
        """Set answer for a question."""
        self.answers[question_id] = value

    def is_answered(self, question_id: str) -> bool:
        """Check if a question has been answered."""
        return question_id in self.answers

    class Config:
        populate_by_name = True
        extra = "allow"


class AnswerResult(BaseModel):
    """Result of submitting an answer."""

    success: bool = True
    next_question_id: Optional[str] = Field(None, alias="nextQuestionId")
    is_complete: bool = Field(False, alias="isComplete")
    message: Optional[str] = None
    session_state: Optional[SessionState] = Field(None, alias="sessionState")

    class Config:
        populate_by_name = True
        extra = "allow"


class OutputRow(BaseModel):
    """A single row of output data."""

    columns: Dict[str, Any] = Field(default_factory=dict)

    def get(self, column: str) -> Any:
        return self.columns.get(column)

    def set(self, column: str, value: Any) -> None:
        self.columns[column] = value

    class Config:
        extra = "allow"


class OutputFile(BaseModel):
    """
    Generated output file from a completed module session.
    """

    filename: str
    content_type: str = Field(default="text/csv", alias="contentType")
    columns: List[str] = Field(default_factory=list, description="Column headers in order")
    rows: List[OutputRow] = Field(default_factory=list)
    raw_content: Optional[str] = Field(None, alias="rawContent", description="Pre-rendered content if available")

    def to_csv(self) -> str:
        """Convert to CSV string."""
        if self.raw_content:
            return self.raw_content

        lines = []

        # Header row
        if self.columns:
            lines.append(",".join(self.columns))

        # Data rows
        for row in self.rows:
            values = []
            for col in self.columns:
                val = row.get(col)
                if val is None:
                    values.append("")
                elif isinstance(val, str) and ("," in val or '"' in val or "\n" in val):
                    # Escape CSV special characters
                    values.append(f'"{val.replace(chr(34), chr(34)+chr(34))}"')
                else:
                    values.append(str(val))
            lines.append(",".join(values))

        return "\n".join(lines)

    def to_dict_rows(self) -> List[Dict[str, Any]]:
        """Convert to list of dictionaries."""
        return [row.columns for row in self.rows]

    class Config:
        populate_by_name = True
        extra = "allow"


class GenerateOutputRequest(BaseModel):
    """Request to generate output for a session."""

    format: str = Field(default="csv", description="Output format: csv, json")

    class Config:
        extra = "allow"


class GenerateOutputResponse(BaseModel):
    """Response containing generated output files."""

    success: bool = True
    files: Dict[str, OutputFile] = Field(default_factory=dict)
    message: Optional[str] = None

    class Config:
        extra = "allow"


class StartSessionRequest(BaseModel):
    """Request to start a new module session."""

    # Currently empty, but can be extended with initial data
    pass

    class Config:
        extra = "allow"


class StartSessionResponse(BaseModel):
    """Response when starting a new session."""

    session_id: str = Field(..., alias="sessionId")
    module_slug: str = Field(..., alias="moduleSlug")
    first_question_id: Optional[str] = Field(None, alias="firstQuestionId")
    session_state: SessionState = Field(..., alias="sessionState")

    class Config:
        populate_by_name = True
        extra = "allow"


class SubmitAnswerRequest(BaseModel):
    """Request to submit an answer."""

    question_id: str = Field(..., alias="questionId")
    value: Any = Field(..., description="The answer value")

    class Config:
        populate_by_name = True
        extra = "allow"
