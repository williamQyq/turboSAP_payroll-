/**
 * SimpleForm - Simple path for PA/PSA wizard
 *
 * Just two fields:
 * - Personnel Area Name
 * - Company Code (dropdown)
 *
 * Auto-creates PA code "1000" and PSA "9999 - General Subarea"
 */

import { AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { usePersonnelAreaStore } from '../../stores/personnelAreaStore';

export function SimpleForm() {
  const {
    availableCompanyCodes,
    createSimpleSetup,
    setStep,
  } = usePersonnelAreaStore();

  const [paDescription, setPaDescription] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!paDescription.trim()) {
      setError('Please enter a Personnel Area name');
      return;
    }
    if (!companyCode && availableCompanyCodes.length > 0) {
      setError('Please select a Company Code');
      return;
    }

    createSimpleSetup(paDescription.trim(), companyCode);
  };

  const hasCompanyCodes = availableCompanyCodes.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Simple Setup
        </h3>
        <p className="text-sm text-gray-500">
          We'll create a single Personnel Area with one General Subarea.
        </p>
      </div>

      {/* Warning if no company codes */}
      {!hasCompanyCodes && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              No Company Codes found
            </p>
            <p className="text-sm text-amber-700 mt-1">
              You should configure Company Codes first for a complete setup.
              You can continue without one, but it's recommended.
            </p>
            <a
              href="/company-code"
              className="text-sm text-amber-600 hover:text-amber-800 underline mt-2 inline-block"
            >
              Configure Company Codes →
            </a>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="space-y-4">
        {/* Personnel Area Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Personnel Area Name *
          </label>
          <input
            type="text"
            value={paDescription}
            onChange={(e) => {
              setPaDescription(e.target.value.slice(0, 30));
              setError('');
            }}
            placeholder="e.g., Main Company, Corporate, US Operations"
            maxLength={30}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Max 30 characters. Code will be auto-generated as "1000".
          </p>
        </div>

        {/* Company Code Dropdown */}
        {hasCompanyCodes && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Code *
            </label>
            <select
              value={companyCode}
              onChange={(e) => {
                setCompanyCode(e.target.value);
                setError('');
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
            >
              <option value="">Select a Company Code...</option>
              {availableCompanyCodes.map((cc) => (
                <option key={cc.code} value={cc.code}>
                  {cc.code} - {cc.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
        <div className="text-sm text-gray-600 font-mono">
          <div>📁 1000 - {paDescription || '(Personnel Area Name)'}</div>
          <div className="ml-4">└── 9999 - General Subarea</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          onClick={() => setStep('complexity')}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={!paDescription.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue to Review
        </button>
      </div>
    </div>
  );
}
