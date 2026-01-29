"""
Question Validation Service

Provides validation utilities for question configurations.
Designed to warn (log) rather than reject, to maintain backward compatibility
during the transition period.

Usage:
    from app.services.question_validator import validate_questions

    result = validate_questions(questions_data, module_slug="payment-methods")
    if not result.is_valid:
        for error in result.errors:
            logger.error(error)
    for warning in result.warnings:
        logger.warning(warning)
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

from pydantic import ValidationError

from ..schemas.question import Question, QuestionsConfig, ShowIfCondition

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """
    Result of validating a questions configuration.

    Attributes:
        is_valid: True if no blocking errors were found
        errors: List of error messages (blocking issues)
        warnings: List of warning messages (non-blocking issues)
        question_count: Number of questions validated
    """

    is_valid: bool = True
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    question_count: int = 0

    def add_error(self, message: str) -> None:
        """Add an error and mark as invalid."""
        self.errors.append(message)
        self.is_valid = False

    def add_warning(self, message: str) -> None:
        """Add a warning (does not affect validity)."""
        self.warnings.append(message)

    def merge(self, other: "ValidationResult") -> None:
        """Merge another result into this one."""
        if not other.is_valid:
            self.is_valid = False
        self.errors.extend(other.errors)
        self.warnings.extend(other.warnings)

    def log_all(self, prefix: str = "") -> None:
        """Log all errors and warnings."""
        for error in self.errors:
            logger.error(f"{prefix}{error}")
        for warning in self.warnings:
            logger.warning(f"{prefix}{warning}")


def validate_questions(
    questions: List[Dict[str, Any]],
    module_slug: str,
    strict: bool = False,
) -> ValidationResult:
    """
    Validate a list of questions.

    Performs the following checks:
    - All questions have unique IDs
    - All showIf references point to existing question IDs
    - Required fields are present (id, text, type)
    - Options are valid for choice-type questions

    Args:
        questions: List of question dictionaries to validate
        module_slug: Module identifier (for error messages)
        strict: If True, treat warnings as errors

    Returns:
        ValidationResult with errors and warnings
    """
    result = ValidationResult()
    result.question_count = len(questions)

    if not questions:
        result.add_warning(f"[{module_slug}] Questions list is empty")
        return result

    seen_ids: Set[str] = set()
    all_ids: Set[str] = {q.get("id", "") for q in questions if q.get("id")}

    for i, q in enumerate(questions):
        q_prefix = f"[{module_slug}] Question {i + 1}"

        # Check for required fields
        if not isinstance(q, dict):
            result.add_error(f"{q_prefix}: Must be an object, got {type(q).__name__}")
            continue

        # Validate question ID
        qid = q.get("id")
        if not qid or not isinstance(qid, str):
            result.add_error(f"{q_prefix}: Missing or invalid 'id' field")
            continue

        q_prefix = f"[{module_slug}] Question '{qid}'"

        # Check for duplicate IDs
        if qid in seen_ids:
            result.add_error(f"{q_prefix}: Duplicate question ID")
        else:
            seen_ids.add(qid)

        # Validate text field
        text = q.get("text")
        if not text or not isinstance(text, str):
            result.add_error(f"{q_prefix}: Missing or invalid 'text' field")

        # Validate type field
        qtype = q.get("type")
        if not qtype or not isinstance(qtype, str):
            result.add_error(f"{q_prefix}: Missing or invalid 'type' field")
        else:
            # Validate type value
            valid_types = {
                "single_select", "multi_select", "multiple_select",
                "multiple_choice", "choice", "text", "free_text",
                "number", "yes_no", "spreadsheet"
            }
            if qtype not in valid_types:
                result.add_warning(f"{q_prefix}: Unknown question type '{qtype}'")

        # Validate options for choice-type questions
        choice_types = {"multiple_choice", "choice", "multiple_select", "single_select", "multi_select"}
        if qtype in choice_types:
            options = q.get("options")
            if options is not None:
                if not isinstance(options, list):
                    result.add_error(f"{q_prefix}: 'options' must be an array")
                else:
                    option_result = _validate_options(options, qid, module_slug)
                    result.merge(option_result)

        # Validate spreadsheetConfig for spreadsheet-type questions
        if qtype == "spreadsheet":
            spreadsheet_config = q.get("spreadsheetConfig")
            if not spreadsheet_config:
                result.add_error(f"{q_prefix}: spreadsheet type requires 'spreadsheetConfig'")
            elif not isinstance(spreadsheet_config, dict):
                result.add_error(f"{q_prefix}: 'spreadsheetConfig' must be an object")
            else:
                columns = spreadsheet_config.get("columns")
                if not columns or not isinstance(columns, list) or len(columns) == 0:
                    result.add_error(f"{q_prefix}: spreadsheetConfig must have at least one column")
                else:
                    seen_keys: Set[str] = set()
                    for col_idx, col in enumerate(columns):
                        if not isinstance(col, dict):
                            result.add_error(f"{q_prefix}: column {col_idx + 1} must be an object")
                            continue
                        col_key = col.get("key")
                        if not col_key:
                            result.add_error(f"{q_prefix}: column {col_idx + 1} missing 'key'")
                        elif col_key in seen_keys:
                            result.add_error(f"{q_prefix}: duplicate column key '{col_key}'")
                        else:
                            seen_keys.add(col_key)
                        if not col.get("label"):
                            result.add_error(f"{q_prefix}: column {col_idx + 1} missing 'label'")

        # Validate showIf references
        show_if = q.get("showIf")
        if show_if is not None:
            if not isinstance(show_if, dict):
                result.add_error(f"{q_prefix}: 'showIf' must be an object")
            else:
                ref_id = show_if.get("questionId")
                if not ref_id:
                    result.add_error(f"{q_prefix}: showIf missing 'questionId'")
                elif ref_id not in all_ids:
                    result.add_warning(
                        f"{q_prefix}: showIf references non-existent question '{ref_id}'"
                    )

                # Check for condition
                has_condition = any([
                    show_if.get("answerId"),
                    show_if.get("equals"),
                    show_if.get("notEquals"),
                    show_if.get("contains"),
                ])
                if not has_condition:
                    result.add_warning(
                        f"{q_prefix}: showIf has no condition (answerId, equals, notEquals, or contains)"
                    )

    # In strict mode, convert warnings to errors
    if strict and result.warnings:
        result.errors.extend(result.warnings)
        result.warnings = []
        result.is_valid = False

    return result


def _validate_options(
    options: List[Any],
    question_id: str,
    module_slug: str,
) -> ValidationResult:
    """Validate question options."""
    result = ValidationResult()
    seen_option_ids: Set[str] = set()

    for j, opt in enumerate(options):
        opt_prefix = f"[{module_slug}] Question '{question_id}', option {j + 1}"

        if not isinstance(opt, dict):
            result.add_error(f"{opt_prefix}: Must be an object")
            continue

        # Check for id or value
        opt_id = opt.get("id") or opt.get("value")
        if not opt_id:
            result.add_error(f"{opt_prefix}: Missing 'id' or 'value' field")
        else:
            if opt_id in seen_option_ids:
                result.add_warning(f"{opt_prefix}: Duplicate option ID '{opt_id}'")
            seen_option_ids.add(opt_id)

        # Check for label
        if not opt.get("label"):
            result.add_error(f"{opt_prefix}: Missing 'label' field")

    return result


def validate_questions_config(
    data: Dict[str, Any],
    module_slug: str,
    strict: bool = False,
) -> ValidationResult:
    """
    Validate a complete questions configuration (with version, questions array, etc.)

    Args:
        data: The full configuration dict (with "version", "questions", etc.)
        module_slug: Module identifier
        strict: If True, treat warnings as errors

    Returns:
        ValidationResult with errors and warnings
    """
    result = ValidationResult()

    # Check for questions array
    if "questions" not in data:
        result.add_error(f"[{module_slug}] Configuration missing 'questions' array")
        return result

    questions = data["questions"]
    if not isinstance(questions, list):
        result.add_error(f"[{module_slug}] 'questions' must be an array")
        return result

    # Validate individual questions
    questions_result = validate_questions(questions, module_slug, strict)
    result.merge(questions_result)
    result.question_count = questions_result.question_count

    # Check version field (warning only)
    if "version" not in data:
        result.add_warning(f"[{module_slug}] Configuration missing 'version' field")

    return result


def validate_with_pydantic(
    data: Dict[str, Any],
    module_slug: str,
) -> ValidationResult:
    """
    Validate using Pydantic models for stricter type checking.

    This is more strict than validate_questions_config and uses
    the Pydantic schema definitions.

    Args:
        data: The full configuration dict
        module_slug: Module identifier

    Returns:
        ValidationResult with any Pydantic validation errors as warnings
    """
    result = ValidationResult()

    try:
        config = QuestionsConfig.model_validate(data)
        result.question_count = len(config.questions)

        # Check showIf references
        showif_warnings = config.validate_showif_references()
        for warning in showif_warnings:
            result.add_warning(f"[{module_slug}] {warning}")

    except ValidationError as e:
        # Convert Pydantic errors to warnings (not blocking for now)
        for error in e.errors():
            loc = ".".join(str(x) for x in error["loc"])
            msg = error["msg"]
            result.add_warning(f"[{module_slug}] Schema: {loc} - {msg}")

    return result
