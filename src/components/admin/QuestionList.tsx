/**
 * QuestionList - Draggable list of questions with edit/delete actions
 *
 * Uses @dnd-kit for drag-and-drop reordering.
 */

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Edit,
  Trash2,
  FileText,
  EyeOff,
  AlertCircle,
} from 'lucide-react';
import type { Question } from '../../api/modules';

interface QuestionListProps {
  questions: Question[];
  onEdit: (question: Question) => void;
  onDelete: (questionId: string) => void;
  onReorder: (questionIds: string[]) => void;
}

interface SortableQuestionProps {
  question: Question;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableQuestion({
  question,
  index,
  onEdit,
  onDelete,
}: SortableQuestionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  function getTypeLabel(type: string) {
    const labels: Record<string, string> = {
      text: 'Text',
      number: 'Number',
      single_select: 'Single Select',
      multi_select: 'Multi Select',
      yes_no: 'Yes/No',
      multiple_choice: 'Single Select',
      choice: 'Single Select',
      free_text: 'Text',
      spreadsheet: 'Spreadsheet',
    };
    return labels[type] || type;
  }

  function getTypeBadgeColor(type: string) {
    const colors: Record<string, string> = {
      text: 'bg-blue-50 text-blue-700',
      number: 'bg-purple-50 text-purple-700',
      single_select: 'bg-green-50 text-green-700',
      multi_select: 'bg-teal-50 text-teal-700',
      yes_no: 'bg-orange-50 text-orange-700',
      spreadsheet: 'bg-indigo-50 text-indigo-700',
    };
    return colors[type] || 'bg-gray-50 text-gray-700';
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-white transition-shadow ${
        isDragging
          ? 'border-amber-300 shadow-lg z-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab touch-none text-gray-400 hover:text-gray-600 active:cursor-grabbing"
        >
          <GripVertical className="h-5 w-5" />
        </button>

        {/* Order Number */}
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-medium text-amber-700">
          {index + 1}
        </span>

        {/* Question Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {question.text}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${getTypeBadgeColor(
                    question.type
                  )}`}
                >
                  {getTypeLabel(question.type)}
                </span>

                {question.showIf && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                    <EyeOff className="h-3 w-3" />
                    Conditional
                  </span>
                )}

                {question.outputMapping && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                    <FileText className="h-3 w-3" />
                    {question.outputMapping.file}
                  </span>
                )}

                {question.options && question.options.length > 0 && (
                  <span className="text-xs text-gray-400">
                    {question.options.length} options
                  </span>
                )}

                {question.spreadsheetConfig && (
                  <span className="text-xs text-gray-400">
                    {question.spreadsheetConfig.columns.length} columns
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={onEdit}
                className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="Edit question"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                title="Delete question"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Help Text Preview */}
          {question.helpText && (
            <p className="mt-1 text-sm text-gray-500 truncate">
              {question.helpText}
            </p>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="border-t border-gray-200 bg-red-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              Delete this question?
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete();
                  setShowDeleteConfirm(false);
                }}
                className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function QuestionList({
  questions,
  onEdit,
  onDelete,
  onReorder,
}: QuestionListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = questions.findIndex((q) => q.id === active.id);
      const newIndex = questions.findIndex((q) => q.id === over.id);

      const newOrder = arrayMove(questions, oldIndex, newIndex);
      onReorder(newOrder.map((q) => q.id));
    }
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
        <FileText className="mx-auto h-10 w-10 text-gray-400" />
        <h3 className="mt-3 text-sm font-medium text-gray-900">
          No questions yet
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Add your first question to get started.
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={questions.map((q) => q.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {questions.map((question, index) => (
            <SortableQuestion
              key={question.id}
              question={question}
              index={index}
              onEdit={() => onEdit(question)}
              onDelete={() => onDelete(question.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
