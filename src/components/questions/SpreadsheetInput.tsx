/**
 * SpreadsheetInput - Editable spreadsheet component for tabular data entry
 *
 * Features:
 * - Configurable columns from question config
 * - Inline cell editing with Tab/Enter navigation
 * - Paste handler for TSV/CSV from clipboard
 * - File import (CSV/TSV upload)
 * - Add/delete rows
 * - Validation indicators
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Trash2, Upload, AlertCircle } from 'lucide-react';
import type { SpreadsheetConfig, SpreadsheetRow } from '../../api/modules';

interface SpreadsheetInputProps {
  config: SpreadsheetConfig;
  value: SpreadsheetRow[];
  onChange: (rows: SpreadsheetRow[]) => void;
  disabled?: boolean;
}

export function SpreadsheetInput({
  config,
  value = [],
  onChange,
  disabled = false,
}: SpreadsheetInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { columns, minRows = 1, maxRows } = config;

  // Create an empty row based on column config
  const createEmptyRow = useCallback((): SpreadsheetRow => {
    const row: SpreadsheetRow = {};
    columns.forEach((col) => {
      row[col.key] = col.type === 'number' ? null : '';
    });
    return row;
  }, [columns]);

  // Initialize with minimum rows if empty
  useEffect(() => {
    if (value.length < minRows) {
      const newRows = [...value];
      while (newRows.length < minRows) {
        newRows.push(createEmptyRow());
      }
      onChange(newRows);
    }
  }, [minRows, value.length, createEmptyRow, onChange]);

  // Validate a single row
  const validateRow = useCallback(
    (rowIndex: number, row: SpreadsheetRow) => {
      const newErrors: Record<string, string> = {};

      columns.forEach((col) => {
        const errorKey = `${rowIndex}-${col.key}`;
        const cellValue = row[col.key];

        if (col.required && (cellValue === '' || cellValue === null || cellValue === undefined)) {
          newErrors[errorKey] = 'Required';
        } else if (col.type === 'number' && cellValue !== null && cellValue !== '') {
          if (typeof cellValue === 'string' && isNaN(Number(cellValue))) {
            newErrors[errorKey] = 'Must be a number';
          }
        }
      });

      setErrors((prev) => {
        // Remove old errors for this row, add new ones
        const updated = { ...prev };
        columns.forEach((col) => {
          const key = `${rowIndex}-${col.key}`;
          delete updated[key];
        });
        return { ...updated, ...newErrors };
      });
    },
    [columns]
  );

  // Handle cell value changes
  const handleCellChange = (rowIndex: number, colKey: string, cellValue: string) => {
    const column = columns.find((c) => c.key === colKey);
    const newRows = [...value];

    if (column?.type === 'number') {
      newRows[rowIndex] = {
        ...newRows[rowIndex],
        [colKey]: cellValue === '' ? null : Number(cellValue),
      };
    } else {
      newRows[rowIndex] = {
        ...newRows[rowIndex],
        [colKey]: cellValue,
      };
    }

    onChange(newRows);
    validateRow(rowIndex, newRows[rowIndex]);
  };

  // Add a new row
  const handleAddRow = () => {
    if (maxRows && value.length >= maxRows) return;
    onChange([...value, createEmptyRow()]);
  };

  // Delete a row
  const handleDeleteRow = (rowIndex: number) => {
    if (value.length <= minRows) return;
    const newRows = value.filter((_, i) => i !== rowIndex);
    onChange(newRows);
    // Clear errors for deleted row
    setErrors((prev) => {
      const updated = { ...prev };
      columns.forEach((col) => {
        delete updated[`${rowIndex}-${col.key}`];
      });
      return updated;
    });
  };

  // Handle paste from clipboard (Excel/Sheets copies as TSV)
  const handlePaste = (
    e: React.ClipboardEvent,
    startRow: number,
    startColIndex: number
  ) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    const rows = pasteData.split('\n').filter((row) => row.trim());

    const newRows = [...value];

    rows.forEach((rowData, rowOffset) => {
      const targetRowIndex = startRow + rowOffset;
      const cells = rowData.split('\t');

      // Add new rows if needed (respecting maxRows)
      if (targetRowIndex >= newRows.length) {
        if (maxRows && newRows.length >= maxRows) return;
        newRows.push(createEmptyRow());
      }

      cells.forEach((cellValue, colOffset) => {
        const targetColIndex = startColIndex + colOffset;
        if (targetColIndex < columns.length) {
          const colKey = columns[targetColIndex].key;
          const column = columns[targetColIndex];

          if (column.type === 'number') {
            const num = parseFloat(cellValue.trim());
            newRows[targetRowIndex][colKey] = isNaN(num) ? null : num;
          } else {
            newRows[targetRowIndex][colKey] = cellValue.trim();
          }
        }
      });
    });

    onChange(newRows);
  };

  // Handle CSV/TSV file import
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const delimiter = file.name.endsWith('.csv') ? ',' : '\t';
    const lines = text.split('\n').filter((line) => line.trim());

    // Skip header row if it matches column labels
    const startIndex = lines[0]
      ?.split(delimiter)
      .some((cell) =>
        columns.some(
          (col) => col.label.toLowerCase() === cell.trim().toLowerCase()
        )
      )
      ? 1
      : 0;

    const newRows: SpreadsheetRow[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      if (maxRows && newRows.length >= maxRows) break;

      const cells = lines[i].split(delimiter);
      const row = createEmptyRow();

      cells.forEach((cellValue, colIndex) => {
        if (colIndex < columns.length) {
          const column = columns[colIndex];
          // Handle quoted CSV values
          let cleanValue = cellValue.trim();
          if (cleanValue.startsWith('"') && cleanValue.endsWith('"')) {
            cleanValue = cleanValue.slice(1, -1);
          }
          if (column.type === 'number') {
            const num = parseFloat(cleanValue);
            row[column.key] = isNaN(num) ? null : num;
          } else {
            row[column.key] = cleanValue;
          }
        }
      });

      newRows.push(row);
    }

    // Ensure minimum rows
    while (newRows.length < minRows) {
      newRows.push(createEmptyRow());
    }

    onChange(newRows);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (
    e: React.KeyboardEvent,
    rowIndex: number,
    colIndex: number
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Move to same column in next row
      const nextRowIndex = rowIndex + 1;
      if (nextRowIndex < value.length) {
        const nextInput = document.querySelector(
          `[data-row="${nextRowIndex}"][data-col="${colIndex}"]`
        ) as HTMLInputElement;
        nextInput?.focus();
      } else if (!maxRows || value.length < maxRows) {
        handleAddRow();
        // Focus new row after render
        setTimeout(() => {
          const newInput = document.querySelector(
            `[data-row="${nextRowIndex}"][data-col="${colIndex}"]`
          ) as HTMLInputElement;
          newInput?.focus();
        }, 0);
      }
    }
  };

  const canAddRow = !maxRows || value.length < maxRows;
  const canDeleteRow = value.length > minRows;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleAddRow}
          disabled={disabled || !canAddRow}
          className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          Add Row
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload className="h-4 w-4" />
          Import CSV
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.txt"
          onChange={handleFileImport}
          className="hidden"
        />

        <span className="text-sm text-gray-500 ml-auto">
          {value.length} row{value.length !== 1 ? 's' : ''}
          {minRows > 0 && ` (min: ${minRows})`}
          {maxRows && ` (max: ${maxRows})`}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-10 px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width ? `${col.width}px` : 'auto' }}
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {col.label}
                  {col.required && <span className="text-red-500 ml-1">*</span>}
                </th>
              ))}
              <th className="w-10 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {value.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                <td className="px-2 py-1 text-center text-sm text-gray-400">
                  {rowIndex + 1}
                </td>
                {columns.map((col, colIndex) => {
                  const errorKey = `${rowIndex}-${col.key}`;
                  const hasError = errors[errorKey];
                  const cellValue = row[col.key];

                  return (
                    <td key={col.key} className="px-1 py-1">
                      <div className="relative">
                        <input
                          type={col.type === 'number' ? 'number' : 'text'}
                          value={cellValue ?? ''}
                          onChange={(e) =>
                            handleCellChange(rowIndex, col.key, e.target.value)
                          }
                          onPaste={(e) => handlePaste(e, rowIndex, colIndex)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                          data-row={rowIndex}
                          data-col={colIndex}
                          disabled={disabled}
                          placeholder={col.placeholder}
                          className={`
                            w-full px-2 py-1.5 text-sm border rounded
                            focus:outline-none focus:ring-1
                            ${
                              hasError
                                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                                : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500'
                            }
                            disabled:bg-gray-50 disabled:cursor-not-allowed
                          `}
                        />
                        {hasError && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2" title={hasError}>
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="px-2 py-1">
                  <button
                    type="button"
                    onClick={() => handleDeleteRow(rowIndex)}
                    disabled={disabled || !canDeleteRow}
                    className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Delete row"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paste hint */}
      <p className="text-xs text-gray-500">
        Tip: You can paste data from Excel or other spreadsheets (Ctrl/Cmd+V)
      </p>
    </div>
  );
}

// Validation helper for submit button
export function isSpreadsheetValid(
  rows: SpreadsheetRow[] | null | undefined,
  config: SpreadsheetConfig | undefined
): boolean {
  if (!rows || !config) return false;
  if (rows.length < (config.minRows || 1)) return false;

  const requiredColumns = config.columns.filter((col) => col.required);
  if (requiredColumns.length === 0) return true;

  // Check that at least one row has all required fields
  // (allows empty rows as long as there's at least one complete row)
  return rows.some((row) =>
    requiredColumns.every((col) => {
      const val = row[col.key];
      return val !== null && val !== '' && val !== undefined;
    })
  );
}
