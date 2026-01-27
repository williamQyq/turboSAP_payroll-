"""
Output Generator Service

Generic output generator that reads outputMapping from questions,
applies transforms to answers, and produces output files.

NO module-specific logic - everything comes from config.
"""

import logging
from collections import defaultdict
from typing import Any, Dict, List, Optional, Union

from ..schemas.question import OutputMapping, Question
from ..schemas.session import OutputFile, OutputRow
from .question_service import QuestionService, question_service

logger = logging.getLogger(__name__)


class OutputGeneratorError(Exception):
    """Base exception for output generator operations."""
    pass


class OutputGenerator:
    """
    Generic output generator.

    Reads outputMapping from questions, applies to answers, produces files.
    Supports multiple transform types:
    - direct: Answer value goes directly to column
    - yes_no: Boolean/yes/no answer becomes "Y" or "N"
    - value_lookup: Map answer value using valueMap dict
    - row_per_selected: For multi-select, create one row per selected option
    """

    def __init__(self, question_svc: Optional[QuestionService] = None):
        """
        Initialize the output generator.

        Args:
            question_svc: QuestionService instance. Defaults to singleton.
        """
        self.question_service = question_svc or question_service

    def generate_output(
        self,
        module_slug: str,
        answers: Dict[str, Any],
    ) -> Dict[str, OutputFile]:
        """
        Generate all output files for a module based on answers.

        Args:
            module_slug: Module slug
            answers: Dict of question_id -> answer value

        Returns:
            Dict of filename -> OutputFile
        """
        # Get all visible questions with output mappings
        visible_questions = self.question_service.get_visible_questions(
            module_slug, answers
        )

        # Group questions by output file
        file_questions: Dict[str, List[Question]] = defaultdict(list)
        for q in visible_questions:
            if q.outputMapping and q.outputMapping.file:
                file_questions[q.outputMapping.file].append(q)

        # Generate each file
        output_files = {}
        for filename, questions in file_questions.items():
            try:
                output_file = self.generate_file(questions, answers, filename)
                output_files[filename] = output_file
            except Exception as e:
                logger.error(f"Error generating file '{filename}': {e}")
                raise OutputGeneratorError(f"Failed to generate '{filename}': {e}")

        return output_files

    def generate_file(
        self,
        questions: List[Question],
        answers: Dict[str, Any],
        filename: str,
    ) -> OutputFile:
        """
        Generate a single output file from questions that map to it.

        Args:
            questions: Questions with outputMapping to this file
            answers: Answer values
            filename: Output filename

        Returns:
            OutputFile with rows and columns
        """
        # Collect all columns and check for row_per_selected
        columns = set()
        has_row_per_selected = False
        row_per_selected_questions = []

        for q in questions:
            if q.outputMapping:
                columns.add(q.outputMapping.column)
                transform = q.outputMapping.transform
                if hasattr(transform, 'value'):
                    transform = transform.value
                if transform == "row_per_selected":
                    has_row_per_selected = True
                    row_per_selected_questions.append(q)

        # Sort columns for consistent output
        sorted_columns = sorted(columns)

        # Generate rows
        if has_row_per_selected and row_per_selected_questions:
            rows = self._generate_rows_per_selected(
                questions, answers, row_per_selected_questions
            )
        else:
            rows = self._generate_single_row(questions, answers)

        return OutputFile(
            filename=filename,
            content_type="text/csv",
            columns=sorted_columns,
            rows=rows,
        )

    def _generate_single_row(
        self,
        questions: List[Question],
        answers: Dict[str, Any],
    ) -> List[OutputRow]:
        """Generate a single row from all question answers."""
        row = OutputRow(columns={})

        for q in questions:
            if not q.outputMapping:
                continue

            answer = answers.get(q.id)
            if answer is None:
                continue

            mapped_values = self.apply_mapping(q, answer)
            for value_dict in mapped_values:
                for col, val in value_dict.items():
                    row.set(col, val)

        return [row] if row.columns else []

    def _generate_rows_per_selected(
        self,
        questions: List[Question],
        answers: Dict[str, Any],
        row_per_selected_questions: List[Question],
    ) -> List[OutputRow]:
        """Generate multiple rows for multi-select questions."""
        # Use the first row_per_selected question to determine row count
        primary_q = row_per_selected_questions[0]
        primary_answer = answers.get(primary_q.id, [])

        if isinstance(primary_answer, str):
            primary_answer = [primary_answer]
        elif not isinstance(primary_answer, list):
            primary_answer = [str(primary_answer)]

        if not primary_answer:
            return []

        rows = []

        # Create one row per selected value
        for selected_value in primary_answer:
            row = OutputRow(columns={})

            for q in questions:
                if not q.outputMapping:
                    continue

                answer = answers.get(q.id)
                if answer is None:
                    continue

                transform = q.outputMapping.transform
                if hasattr(transform, 'value'):
                    transform = transform.value

                if transform == "row_per_selected" and q.id == primary_q.id:
                    # For the row_per_selected question, use current selected value
                    mapped = self._apply_transform(
                        selected_value,
                        q.outputMapping,
                        transform="direct"  # Treat each value as direct
                    )
                    row.set(q.outputMapping.column, mapped)
                else:
                    # For other questions, apply normal mapping
                    mapped_values = self.apply_mapping(q, answer)
                    for value_dict in mapped_values:
                        for col, val in value_dict.items():
                            row.set(col, val)

            rows.append(row)

        return rows

    def apply_mapping(
        self,
        question: Question,
        answer: Any,
    ) -> List[Dict[str, Any]]:
        """
        Apply a single question's outputMapping to its answer.

        Args:
            question: Question with outputMapping
            answer: The answer value

        Returns:
            List of {column: value} dicts (usually single-item list)
        """
        if not question.outputMapping:
            return []

        mapping = question.outputMapping
        column = mapping.column
        transform = mapping.transform

        # Get string value of transform enum
        if hasattr(transform, 'value'):
            transform = transform.value

        # Handle row_per_selected separately (returns multiple rows)
        if transform == "row_per_selected":
            if isinstance(answer, list):
                return [{column: self._apply_transform(v, mapping, "direct")} for v in answer]
            else:
                return [{column: self._apply_transform(answer, mapping, "direct")}]

        # Single value transforms
        mapped_value = self._apply_transform(answer, mapping, transform)
        return [{column: mapped_value}]

    def _apply_transform(
        self,
        value: Any,
        mapping: OutputMapping,
        transform: str,
    ) -> Any:
        """
        Apply a transform to a single value.

        Args:
            value: The value to transform
            mapping: OutputMapping with transform config
            transform: Transform type string

        Returns:
            Transformed value
        """
        if value is None:
            return ""

        if transform == "direct":
            # Direct pass-through
            if isinstance(value, list):
                return ", ".join(str(v) for v in value)
            return str(value)

        elif transform == "yes_no":
            # Convert to Y/N
            str_val = str(value).lower()
            if str_val in ("yes", "y", "true", "1"):
                return "Y"
            elif str_val in ("no", "n", "false", "0"):
                return "N"
            else:
                # Default to the value itself
                return str(value)

        elif transform == "value_lookup":
            # Look up in valueMap
            value_map = mapping.valueMap or {}
            str_val = str(value)

            if str_val in value_map:
                return value_map[str_val]
            else:
                logger.warning(
                    f"Value '{str_val}' not found in valueMap for column '{mapping.column}'"
                )
                return str_val

        else:
            # Unknown transform, treat as direct
            logger.warning(f"Unknown transform type: {transform}")
            return str(value)

    def get_output_files(self, module_slug: str) -> List[str]:
        """
        Get list of output filenames this module produces.

        Scans all questions for outputMapping.file values.

        Args:
            module_slug: Module slug

        Returns:
            List of unique output filenames
        """
        questions = self.question_service.get_questions(module_slug)

        files = set()
        for q in questions:
            if q.outputMapping and q.outputMapping.file:
                files.add(q.outputMapping.file)

        return sorted(files)

    def preview_output(
        self,
        module_slug: str,
        answers: Dict[str, Any],
    ) -> Dict[str, str]:
        """
        Generate preview of output files as CSV strings.

        Args:
            module_slug: Module slug
            answers: Answer values

        Returns:
            Dict of filename -> CSV content string
        """
        output_files = self.generate_output(module_slug, answers)

        preview = {}
        for filename, output_file in output_files.items():
            preview[filename] = output_file.to_csv()

        return preview


# Singleton instance for easy import
output_generator = OutputGenerator()
