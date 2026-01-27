"""
Question Service

Service for question CRUD within a module.
Handles validation, ordering, and showIf evaluation.
"""

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from ..schemas.question import Question, QuestionsConfig, ShowIfCondition
from .config_store import ConfigStore, config_store
from .question_validator import validate_questions_config

logger = logging.getLogger(__name__)


class QuestionServiceError(Exception):
    """Base exception for question service operations."""
    pass


class QuestionNotFoundError(QuestionServiceError):
    """Raised when a question is not found."""
    pass


class ModuleNotFoundError(QuestionServiceError):
    """Raised when the module doesn't exist."""
    pass


class QuestionService:
    """
    Service for question CRUD within a module.

    All operations use ConfigStore for persistence.
    Questions are stored in modules/{slug}/questions.json.
    """

    def __init__(self, store: Optional[ConfigStore] = None):
        """
        Initialize the question service.

        Args:
            store: ConfigStore instance. Defaults to the global config_store.
        """
        self.store = store or config_store
        self.modules_base = "modules"

    def _get_questions_path(self, module_slug: str) -> str:
        """Get the questions.json path for a module."""
        return f"{self.modules_base}/{module_slug}/questions"

    def _load_questions_data(self, module_slug: str) -> Dict[str, Any]:
        """Load raw questions data from storage."""
        data = self.store.get(self._get_questions_path(module_slug))
        if data is None:
            raise ModuleNotFoundError(f"Module '{module_slug}' not found")
        return data

    def _save_questions_data(self, module_slug: str, data: Dict[str, Any]) -> None:
        """Save questions data to storage."""
        # Update metadata
        if "metadata" not in data:
            data["metadata"] = {}
        data["metadata"]["lastModified"] = datetime.utcnow().isoformat()

        # Validate before saving (logs warnings but doesn't block)
        validation = validate_questions_config(data, module_slug)
        if validation.warnings:
            for warning in validation.warnings:
                logger.warning(warning)

        self.store.save(self._get_questions_path(module_slug), data)

    def _generate_question_id(self) -> str:
        """Generate a unique question ID."""
        return f"q_{uuid.uuid4().hex[:8]}"

    def get_questions(self, module_slug: str) -> List[Question]:
        """
        Get all questions for a module, ordered by 'order' field.

        Args:
            module_slug: Module slug

        Returns:
            List of Question objects, sorted by order
        """
        data = self._load_questions_data(module_slug)
        questions_data = data.get("questions", [])

        questions = []
        for q_data in questions_data:
            try:
                questions.append(Question.model_validate(q_data))
            except Exception as e:
                logger.warning(f"Error parsing question in {module_slug}: {e}")
                # Include as-is with model_construct to preserve data
                questions.append(Question.model_construct(**q_data))

        # Sort by order field (default to 999 if not set)
        questions.sort(key=lambda q: (q.order or 999, q.id))

        return questions

    def get_question(self, module_slug: str, question_id: str) -> Optional[Question]:
        """
        Get a single question by ID.

        Args:
            module_slug: Module slug
            question_id: Question ID

        Returns:
            Question or None if not found
        """
        questions = self.get_questions(module_slug)
        for q in questions:
            if q.id == question_id:
                return q
        return None

    def add_question(
        self,
        module_slug: str,
        question: Union[Question, Dict[str, Any]],
    ) -> Question:
        """
        Add a new question to a module.

        Args:
            module_slug: Module slug
            question: Question object or dict

        Returns:
            Created Question with generated ID if not provided
        """
        data = self._load_questions_data(module_slug)
        questions = data.get("questions", [])

        # Convert to dict if Question object
        if isinstance(question, Question):
            q_dict = question.model_dump(exclude_none=True, by_alias=True)
        else:
            q_dict = dict(question)

        # Generate ID if not provided
        if not q_dict.get("id"):
            q_dict["id"] = self._generate_question_id()

        # Check for duplicate ID
        existing_ids = {q.get("id") for q in questions}
        if q_dict["id"] in existing_ids:
            raise QuestionServiceError(f"Question ID '{q_dict['id']}' already exists")

        # Set order if not provided (add to end)
        if q_dict.get("order") is None:
            max_order = max((q.get("order", 0) for q in questions), default=0)
            q_dict["order"] = max_order + 1

        # Add to questions list
        questions.append(q_dict)
        data["questions"] = questions

        self._save_questions_data(module_slug, data)

        logger.info(f"Added question '{q_dict['id']}' to module '{module_slug}'")

        return Question.model_validate(q_dict)

    def update_question(
        self,
        module_slug: str,
        question_id: str,
        updates: Dict[str, Any],
    ) -> Question:
        """
        Update an existing question.

        Args:
            module_slug: Module slug
            question_id: Question ID to update
            updates: Dict of fields to update

        Returns:
            Updated Question

        Raises:
            QuestionNotFoundError: If question doesn't exist
        """
        data = self._load_questions_data(module_slug)
        questions = data.get("questions", [])

        # Find the question
        question_index = None
        for i, q in enumerate(questions):
            if q.get("id") == question_id:
                question_index = i
                break

        if question_index is None:
            raise QuestionNotFoundError(f"Question '{question_id}' not found in module '{module_slug}'")

        # Update fields
        q_dict = questions[question_index]
        for key, value in updates.items():
            if key != "id":  # Don't allow changing ID
                q_dict[key] = value

        questions[question_index] = q_dict
        data["questions"] = questions

        self._save_questions_data(module_slug, data)

        logger.info(f"Updated question '{question_id}' in module '{module_slug}'")

        return Question.model_validate(q_dict)

    def delete_question(self, module_slug: str, question_id: str) -> bool:
        """
        Delete a question.

        Args:
            module_slug: Module slug
            question_id: Question ID to delete

        Returns:
            True if deleted, False if not found
        """
        data = self._load_questions_data(module_slug)
        questions = data.get("questions", [])

        # Find and remove the question
        original_len = len(questions)
        questions = [q for q in questions if q.get("id") != question_id]

        if len(questions) == original_len:
            return False

        data["questions"] = questions
        self._save_questions_data(module_slug, data)

        logger.info(f"Deleted question '{question_id}' from module '{module_slug}'")

        return True

    def reorder_questions(
        self,
        module_slug: str,
        question_ids: List[str],
    ) -> List[Question]:
        """
        Reorder questions by providing an ordered list of IDs.

        Args:
            module_slug: Module slug
            question_ids: List of question IDs in desired order

        Returns:
            List of reordered Questions
        """
        data = self._load_questions_data(module_slug)
        questions = data.get("questions", [])

        # Build a map of id -> question
        q_map = {q.get("id"): q for q in questions}

        # Update order based on position in question_ids
        for order, qid in enumerate(question_ids, start=1):
            if qid in q_map:
                q_map[qid]["order"] = order

        # Questions not in the list keep their order (or get pushed to end)
        max_order = len(question_ids)
        for q in questions:
            if q.get("id") not in question_ids:
                max_order += 1
                q["order"] = max_order

        data["questions"] = questions
        self._save_questions_data(module_slug, data)

        logger.info(f"Reordered questions in module '{module_slug}'")

        return self.get_questions(module_slug)

    def get_next_question(
        self,
        module_slug: str,
        answers: Dict[str, Any],
        current_question_id: Optional[str] = None,
    ) -> Optional[Question]:
        """
        Get the next unanswered question, respecting showIf conditions.

        Args:
            module_slug: Module slug
            answers: Dict of question_id -> answer value
            current_question_id: If provided, start looking after this question

        Returns:
            Next Question to show, or None if all answered/complete
        """
        questions = self.get_questions(module_slug)

        # Find starting point
        start_index = 0
        if current_question_id:
            for i, q in enumerate(questions):
                if q.id == current_question_id:
                    start_index = i + 1
                    break

        # Find next visible, unanswered question
        for i in range(start_index, len(questions)):
            q = questions[i]

            # Skip if already answered
            if q.id in answers:
                continue

            # Check showIf condition
            if q.showIf:
                if not self.evaluate_show_if(q.showIf, answers):
                    continue

            return q

        return None

    def get_first_question(self, module_slug: str) -> Optional[Question]:
        """
        Get the first question for a module.

        Args:
            module_slug: Module slug

        Returns:
            First Question or None if no questions
        """
        return self.get_next_question(module_slug, {})

    def evaluate_show_if(
        self,
        condition: Union[ShowIfCondition, Dict[str, Any]],
        answers: Dict[str, Any],
    ) -> bool:
        """
        Evaluate whether a question should be shown based on answers.

        Args:
            condition: ShowIfCondition or dict with condition
            answers: Current answers dict

        Returns:
            True if question should be shown
        """
        # Convert dict to ShowIfCondition if needed
        if isinstance(condition, dict):
            try:
                condition = ShowIfCondition.model_validate(condition)
            except Exception:
                # If validation fails, try to evaluate manually
                return self._evaluate_show_if_dict(condition, answers)

        question_id = condition.questionId
        answer = answers.get(question_id)

        if answer is None:
            return False

        # Normalize answer to list for comparison
        answer_list = [answer] if isinstance(answer, str) else list(answer) if isinstance(answer, list) else [str(answer)]

        # Check legacy answerId
        if condition.answerId is not None:
            return condition.answerId in answer_list

        # Check equals
        if condition.equals is not None:
            return condition.equals in answer_list

        # Check notEquals
        if condition.notEquals is not None:
            return condition.notEquals not in answer_list

        # Check contains
        if condition.contains is not None:
            return condition.contains in answer_list

        return True

    def _evaluate_show_if_dict(
        self,
        condition: Dict[str, Any],
        answers: Dict[str, Any],
    ) -> bool:
        """Evaluate showIf from a raw dict (fallback for non-standard formats)."""
        question_id = condition.get("questionId")
        if not question_id:
            return True

        answer = answers.get(question_id)
        if answer is None:
            return False

        # Normalize to list
        answer_list = [answer] if isinstance(answer, str) else list(answer) if isinstance(answer, list) else [str(answer)]

        # Check various condition types
        if "answerId" in condition:
            return condition["answerId"] in answer_list
        if "equals" in condition:
            return condition["equals"] in answer_list
        if "notEquals" in condition:
            return condition["notEquals"] not in answer_list
        if "contains" in condition:
            return condition["contains"] in answer_list

        return True

    def get_visible_questions(
        self,
        module_slug: str,
        answers: Dict[str, Any],
    ) -> List[Question]:
        """
        Get all questions that should be visible given current answers.

        Args:
            module_slug: Module slug
            answers: Current answers dict

        Returns:
            List of visible Questions
        """
        questions = self.get_questions(module_slug)
        visible = []

        for q in questions:
            if q.showIf:
                if self.evaluate_show_if(q.showIf, answers):
                    visible.append(q)
            else:
                visible.append(q)

        return visible

    def is_module_complete(
        self,
        module_slug: str,
        answers: Dict[str, Any],
    ) -> bool:
        """
        Check if all visible questions have been answered.

        Args:
            module_slug: Module slug
            answers: Current answers dict

        Returns:
            True if all visible questions are answered
        """
        visible = self.get_visible_questions(module_slug, answers)

        for q in visible:
            if q.id not in answers:
                return False

        return True


# Singleton instance for easy import
question_service = QuestionService()
