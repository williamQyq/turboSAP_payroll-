/**
 * QuestionEditor - Modal form for creating/editing questions
 *
 * Supports all question fields including options and outputMapping.
 */

import { useState } from 'react';
import { X, Plus, Trash2, Loader2, HelpCircle } from 'lucide-react';
import type { Question, QuestionOption, OutputMapping, SpreadsheetColumn } from '../../api/modules';

interface QuestionEditorProps {
  question: Question | null; // null = creating new
  existingQuestions: Question[];
  onSave: (question: Partial<Question>) => void;
  onClose: () => void;
  saving: boolean;
}

const QUESTION_TYPES = [
  { value: 'text', label: 'Text Input' },
  { value: 'number', label: 'Number Input' },
  { value: 'single_select', label: 'Single Select (Radio)' },
  { value: 'multi_select', label: 'Multi Select (Checkboxes)' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'spreadsheet', label: 'Spreadsheet (Table)' },
];

const TRANSFORM_TYPES = [
  { value: 'direct', label: 'Direct (pass through)' },
  { value: 'yes_no', label: 'Yes/No → Y/N' },
  { value: 'value_lookup', label: 'Value Lookup (map values)' },
  { value: 'row_per_selected', label: 'Row Per Selected (multi-select)' },
];

export function QuestionEditor({
  question,
  existingQuestions,
  onSave,
  onClose,
  saving,
}: QuestionEditorProps) {
  const isEditing = !!question;

  // Form state
  const [text, setText] = useState(question?.text || '');
  const [type, setType] = useState(question?.type || 'text');
  const [helpText, setHelpText] = useState(question?.helpText || '');
  const [options, setOptions] = useState<QuestionOption[]>(
    question?.options || []
  );

  // Spreadsheet config state
  const [spreadsheetColumns, setSpreadsheetColumns] = useState<SpreadsheetColumn[]>(
    question?.spreadsheetConfig?.columns || [{ key: 'col1', label: 'Column 1', type: 'text' }]
  );
  const [spreadsheetMinRows, setSpreadsheetMinRows] = useState(
    question?.spreadsheetConfig?.minRows || 1
  );
  const [spreadsheetMaxRows, setSpreadsheetMaxRows] = useState<number | undefined>(
    question?.spreadsheetConfig?.maxRows
  );

  // ShowIf state
  const [showIfEnabled, setShowIfEnabled] = useState(!!question?.showIf);
  const [showIfQuestionId, setShowIfQuestionId] = useState(
    question?.showIf?.questionId || ''
  );
  const [showIfCondition, setShowIfCondition] = useState<'equals' | 'notEquals'>(
    question?.showIf?.notEquals ? 'notEquals' : 'equals'
  );
  const [showIfValue, setShowIfValue] = useState(
    question?.showIf?.equals ||
      question?.showIf?.notEquals ||
      question?.showIf?.answerId ||
      ''
  );

  // Output Mapping state
  const [outputEnabled, setOutputEnabled] = useState(!!question?.outputMapping);
  const [outputFile, setOutputFile] = useState(
    question?.outputMapping?.file || ''
  );
  const [outputColumn, setOutputColumn] = useState(
    question?.outputMapping?.column || ''
  );
  const [outputTransform, setOutputTransform] = useState(
    question?.outputMapping?.transform || 'direct'
  );
  const [valueMap, setValueMap] = useState<[string, string][]>(
    Object.entries(question?.outputMapping?.valueMap || {})
  );

  // Determine if type needs options or spreadsheet config
  const needsOptions = ['single_select', 'multi_select'].includes(type);
  const needsSpreadsheetConfig = type === 'spreadsheet';

  // Get other questions for showIf dropdown (exclude current)
  const otherQuestions = existingQuestions.filter(
    (q) => q.id !== question?.id
  );

  // Get selected question's options for showIf value dropdown
  const showIfQuestion = otherQuestions.find((q) => q.id === showIfQuestionId);
  const showIfOptions = showIfQuestion?.options || [];

  function handleAddOption() {
    setOptions([...options, { value: '', label: '' }]);
  }

  function handleRemoveOption(index: number) {
    setOptions(options.filter((_, i) => i !== index));
  }

  function handleOptionChange(
    index: number,
    field: 'value' | 'label',
    value: string
  ) {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    // Auto-generate value from label if value is empty
    if (field === 'label' && !newOptions[index].value) {
      newOptions[index].value = value.toLowerCase().replace(/\s+/g, '_');
    }
    setOptions(newOptions);
  }

  function handleAddSpreadsheetColumn() {
    setSpreadsheetColumns([
      ...spreadsheetColumns,
      { key: `col${spreadsheetColumns.length + 1}`, label: '', type: 'text' },
    ]);
  }

  function handleRemoveSpreadsheetColumn(index: number) {
    if (spreadsheetColumns.length > 1) {
      setSpreadsheetColumns(spreadsheetColumns.filter((_, i) => i !== index));
    }
  }

  function handleSpreadsheetColumnChange(
    index: number,
    field: keyof SpreadsheetColumn,
    value: string | boolean
  ) {
    const newColumns = [...spreadsheetColumns];
    newColumns[index] = { ...newColumns[index], [field]: value };
    // Auto-generate key from label if label changes
    if (field === 'label' && typeof value === 'string') {
      const autoKey = value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      if (autoKey && !spreadsheetColumns.some((c, i) => i !== index && c.key === autoKey)) {
        newColumns[index].key = autoKey;
      }
    }
    setSpreadsheetColumns(newColumns);
  }

  function handleAddValueMapEntry() {
    setValueMap([...valueMap, ['', '']]);
  }

  function handleRemoveValueMapEntry(index: number) {
    setValueMap(valueMap.filter((_, i) => i !== index));
  }

  function handleValueMapChange(
    index: number,
    field: 0 | 1,
    value: string
  ) {
    const newMap = [...valueMap];
    newMap[index] = [...newMap[index]] as [string, string];
    newMap[index][field] = value;
    setValueMap(newMap);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const questionData: Partial<Question> = {
      text: text.trim(),
      type,
    };

    if (helpText.trim()) {
      questionData.helpText = helpText.trim();
    }

    if (needsOptions && options.length > 0) {
      questionData.options = options.filter((o) => o.value && o.label);
    }

    // Spreadsheet Config
    if (needsSpreadsheetConfig && spreadsheetColumns.length > 0) {
      const validColumns = spreadsheetColumns.filter((col) => col.key && col.label);
      if (validColumns.length > 0) {
        questionData.spreadsheetConfig = {
          columns: validColumns,
          minRows: spreadsheetMinRows,
          ...(spreadsheetMaxRows && { maxRows: spreadsheetMaxRows }),
        };
      }
    }

    // ShowIf
    if (showIfEnabled && showIfQuestionId && showIfValue) {
      questionData.showIf = {
        questionId: showIfQuestionId,
        [showIfCondition]: showIfValue,
      };
    }

    // Output Mapping
    if (outputEnabled && outputFile && outputColumn) {
      const mapping: OutputMapping = {
        file: outputFile.trim(),
        column: outputColumn.trim(),
        transform: outputTransform as OutputMapping['transform'],
      };
      if (outputTransform === 'value_lookup' && valueMap.length > 0) {
        mapping.valueMap = Object.fromEntries(
          valueMap.filter(([k, v]) => k && v)
        );
      }
      questionData.outputMapping = mapping;
    }

    onSave(questionData);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 py-8">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Question' : 'Add Question'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Question Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Question Text <span className="text-red-500">*</span>
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g., What is your company's primary bank?"
              rows={2}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              required
            />
          </div>

          {/* Question Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Question Type <span className="text-red-500">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Help Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Help Text <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={helpText}
              onChange={(e) => setHelpText(e.target.value)}
              placeholder="Additional guidance for the user"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Options (for select types) */}
          {needsOptions && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Options
              </label>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={option.label}
                      onChange={(e) =>
                        handleOptionChange(index, 'label', e.target.value)
                      }
                      placeholder="Label"
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      value={option.value}
                      onChange={(e) =>
                        handleOptionChange(index, 'value', e.target.value)
                      }
                      placeholder="Value"
                      className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(index)}
                      className="p-2 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-2 inline-flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700"
              >
                <Plus className="h-4 w-4" />
                Add Option
              </button>
            </div>
          )}

          {/* Spreadsheet Columns Configuration */}
          {needsSpreadsheetConfig && (
            <div className="rounded-lg border border-gray-200 p-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Spreadsheet Columns
              </label>
              <div className="space-y-2">
                {spreadsheetColumns.map((col, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={col.label}
                      onChange={(e) =>
                        handleSpreadsheetColumnChange(index, 'label', e.target.value)
                      }
                      placeholder="Column Label"
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                    <select
                      value={col.type || 'text'}
                      onChange={(e) =>
                        handleSpreadsheetColumnChange(index, 'type', e.target.value)
                      }
                      className="w-28 rounded-md border border-gray-300 px-2 py-2 text-sm"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                    </select>
                    <label className="flex items-center gap-1 text-sm whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={col.required || false}
                        onChange={(e) =>
                          handleSpreadsheetColumnChange(index, 'required', e.target.checked)
                        }
                        className="rounded border-gray-300"
                      />
                      Required
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRemoveSpreadsheetColumn(index)}
                      disabled={spreadsheetColumns.length <= 1}
                      className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAddSpreadsheetColumn}
                className="mt-2 inline-flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700"
              >
                <Plus className="h-4 w-4" />
                Add Column
              </button>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Min Rows</label>
                  <input
                    type="number"
                    min="0"
                    value={spreadsheetMinRows}
                    onChange={(e) => setSpreadsheetMinRows(Number(e.target.value) || 0)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max Rows (optional)</label>
                  <input
                    type="number"
                    min="1"
                    value={spreadsheetMaxRows || ''}
                    onChange={(e) =>
                      setSpreadsheetMaxRows(e.target.value ? Number(e.target.value) : undefined)
                    }
                    placeholder="No limit"
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ShowIf Condition */}
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showIfEnabled"
                checked={showIfEnabled}
                onChange={(e) => setShowIfEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <label
                htmlFor="showIfEnabled"
                className="text-sm font-medium text-gray-700"
              >
                Conditional Display (showIf)
              </label>
              <span title="Only show this question when a condition is met">
                <HelpCircle className="h-4 w-4 text-gray-400" />
              </span>
            </div>

            {showIfEnabled && (
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    When question
                  </label>
                  <select
                    value={showIfQuestionId}
                    onChange={(e) => setShowIfQuestionId(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">Select question...</option>
                    {otherQuestions.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.text.substring(0, 40)}...
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Condition
                  </label>
                  <select
                    value={showIfCondition}
                    onChange={(e) =>
                      setShowIfCondition(e.target.value as 'equals' | 'notEquals')
                    }
                    className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    <option value="equals">equals</option>
                    <option value="notEquals">not equals</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Value
                  </label>
                  {showIfOptions.length > 0 ? (
                    <select
                      value={showIfValue}
                      onChange={(e) => setShowIfValue(e.target.value)}
                      className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">Select value...</option>
                      {showIfOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={showIfValue}
                      onChange={(e) => setShowIfValue(e.target.value)}
                      placeholder="yes, no, etc."
                      className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Output Mapping */}
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="outputEnabled"
                checked={outputEnabled}
                onChange={(e) => setOutputEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <label
                htmlFor="outputEnabled"
                className="text-sm font-medium text-gray-700"
              >
                Output Mapping
              </label>
              <span title="Map this answer to an output file column">
                <HelpCircle className="h-4 w-4 text-gray-400" />
              </span>
            </div>

            {outputEnabled && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Output File
                    </label>
                    <input
                      type="text"
                      value={outputFile}
                      onChange={(e) => setOutputFile(e.target.value)}
                      placeholder="e.g., bank_details.csv"
                      className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Column Name
                    </label>
                    <input
                      type="text"
                      value={outputColumn}
                      onChange={(e) => setOutputColumn(e.target.value)}
                      placeholder="e.g., BankName"
                      className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Transform
                  </label>
                  <select
                    value={outputTransform}
                    onChange={(e) => setOutputTransform(e.target.value as OutputMapping['transform'])}
                    className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    {TRANSFORM_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Value Map for value_lookup transform */}
                {outputTransform === 'value_lookup' && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Value Map
                    </label>
                    <div className="space-y-2">
                      {valueMap.map(([key, val], index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={key}
                            onChange={(e) =>
                              handleValueMapChange(index, 0, e.target.value)
                            }
                            placeholder="From value"
                            className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                          />
                          <span className="text-gray-400">→</span>
                          <input
                            type="text"
                            value={val}
                            onChange={(e) =>
                              handleValueMapChange(index, 1, e.target.value)
                            }
                            placeholder="To value"
                            className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveValueMapEntry(index)}
                            className="p-1 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleAddValueMapEntry}
                      className="mt-2 inline-flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add Mapping
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !text.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Add Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
