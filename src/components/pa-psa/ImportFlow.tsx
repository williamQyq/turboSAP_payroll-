/**
 * ImportFlow - Import path for PA/PSA wizard
 *
 * Three sub-steps:
 * 1. File upload (CSV/TSV)
 * 2. Column mapping
 * 3. Preview extracted structure
 */

import { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, Check, ArrowRight } from 'lucide-react';
import { usePersonnelAreaStore } from '../../stores/personnelAreaStore';

// =============================================================================
// Step 1: File Upload
// =============================================================================

export function ImportUpload() {
  const { setImportedData, setStep } = usePersonnelAreaStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const parseFile = async (file: File) => {
    try {
      const text = await file.text();
      const delimiter = file.name.endsWith('.csv') ? ',' : '\t';
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        setError('File must have at least a header row and one data row');
        return;
      }

      // Parse header
      const columns = lines[0].split(delimiter).map(col => col.trim().replace(/^"|"$/g, ''));

      // Parse data rows
      const rows: Record<string, string>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(delimiter).map(cell => cell.trim().replace(/^"|"$/g, ''));
        const row: Record<string, string> = {};
        columns.forEach((col, idx) => {
          row[col] = cells[idx] || '';
        });
        rows.push(row);
      }

      setImportedData(rows, columns);
    } catch (e) {
      setError('Failed to parse file. Please check the format.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Upload Your File
        </h3>
        <p className="text-sm text-gray-500">
          Upload a CSV or TSV file containing your location data.
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
          ${dragOver
            ? 'border-purple-500 bg-purple-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
        `}
      >
        <Upload className={`h-12 w-12 mx-auto mb-4 ${dragOver ? 'text-purple-500' : 'text-gray-400'}`} />
        <p className="text-lg font-medium text-gray-700">
          Drop your file here
        </p>
        <p className="text-sm text-gray-500 mt-1">
          or click to browse
        </p>
        <p className="text-xs text-gray-400 mt-4">
          Supports CSV and TSV files
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.txt"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Example format */}
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Expected format:</p>
        <pre className="text-xs text-gray-600 font-mono bg-white p-3 rounded border border-gray-200 overflow-x-auto">
{`Region,Location
Southwest,Phoenix Office
Southwest,Denver Office
Pacific,Los Angeles
Pacific,San Francisco`}
        </pre>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          onClick={() => setStep('complexity')}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Step 2: Column Mapping
// =============================================================================

export function ImportMapping() {
  const {
    importedColumns,
    importedRows,
    columnMapping,
    setColumnMapping,
    processImportedData,
    setStep,
  } = usePersonnelAreaStore();

  const [mapping, setMapping] = useState({
    paName: columnMapping?.paName || '',
    paCode: columnMapping?.paCode || null,
    psaName: columnMapping?.psaName || '',
    psaCode: columnMapping?.psaCode || null,
  });

  const handleChange = (field: string, value: string) => {
    setMapping(prev => ({
      ...prev,
      [field]: value === '' ? null : value,
    }));
  };

  const handleContinue = () => {
    setColumnMapping({
      paName: mapping.paName,
      paCode: mapping.paCode,
      psaName: mapping.psaName,
      psaCode: mapping.psaCode,
    });
    processImportedData();
  };

  const canContinue = mapping.paName && mapping.psaName;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Map Your Columns
        </h3>
        <p className="text-sm text-gray-500">
          Tell us which columns contain your Personnel Area and Subarea data.
        </p>
      </div>

      {/* Preview of imported data */}
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm font-medium text-gray-700 mb-2">
          Preview ({importedRows?.length || 0} rows detected)
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                {importedColumns.map(col => (
                  <th key={col} className="px-2 py-1 text-left text-gray-500 font-medium">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {importedRows?.slice(0, 3).map((row, i) => (
                <tr key={i}>
                  {importedColumns.map(col => (
                    <td key={col} className="px-2 py-1 text-gray-600">
                      {row[col] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {(importedRows?.length || 0) > 3 && (
            <p className="text-xs text-gray-400 mt-1">
              ...and {(importedRows?.length || 0) - 3} more rows
            </p>
          )}
        </div>
      </div>

      {/* Mapping Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PA Name (required) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Personnel Area Name *
          </label>
          <select
            value={mapping.paName}
            onChange={(e) => handleChange('paName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
          >
            <option value="">Select column...</option>
            {importedColumns.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>

        {/* PA Code (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Personnel Area Code
            <span className="text-xs text-gray-400 ml-1">(optional)</span>
          </label>
          <select
            value={mapping.paCode || ''}
            onChange={(e) => handleChange('paCode', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
          >
            <option value="">Auto-generate</option>
            {importedColumns.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>

        {/* PSA Name (required) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subarea Name *
          </label>
          <select
            value={mapping.psaName}
            onChange={(e) => handleChange('psaName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
          >
            <option value="">Select column...</option>
            {importedColumns.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>

        {/* PSA Code (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subarea Code
            <span className="text-xs text-gray-400 ml-1">(optional)</span>
          </label>
          <select
            value={mapping.psaCode || ''}
            onChange={(e) => handleChange('psaCode', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
          >
            <option value="">Auto-generate</option>
            {importedColumns.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Codes will be auto-generated if not mapped. PA codes will be 1000, 1100, 1200, etc.
        Subarea codes will be derived from names.
      </p>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          onClick={() => setStep('import-upload')}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Step 3: Import Preview
// =============================================================================

export function ImportPreview() {
  const {
    personnelAreas,
    personnelSubareas,
    getSubareasForArea,
    setStep,
  } = usePersonnelAreaStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Preview Imported Structure
        </h3>
        <p className="text-sm text-gray-500">
          Review the extracted hierarchy. You can go back to edit if needed.
        </p>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-2 text-sm">
        <Check className="h-5 w-5 text-green-500" />
        <span className="text-gray-700">
          Extracted <strong>{personnelAreas.length}</strong> Personnel Areas with{' '}
          <strong>{personnelSubareas.length}</strong> Subareas
        </span>
      </div>

      {/* Tree Preview */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white max-h-64 overflow-y-auto">
        {personnelAreas.map((pa) => {
          const subareas = getSubareasForArea(pa.code);
          return (
            <div key={pa.code} className="mb-3 last:mb-0">
              <div className="flex items-center gap-2 font-medium text-gray-800">
                <FileText className="h-4 w-4 text-amber-500" />
                <span className="font-mono">{pa.code}</span>
                <span>-</span>
                <span>{pa.description}</span>
              </div>
              <div className="ml-6 mt-1 space-y-0.5">
                {subareas.map((psa, idx) => (
                  <div key={psa.code} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-gray-300">
                      {idx === subareas.length - 1 ? '└──' : '├──'}
                    </span>
                    <span className="font-mono">{psa.code}</span>
                    <span>-</span>
                    <span>{psa.description}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          onClick={() => setStep('import-mapping')}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={() => setStep('review')}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-700"
        >
          Continue to Review
        </button>
      </div>
    </div>
  );
}
