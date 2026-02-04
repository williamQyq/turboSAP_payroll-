/**
 * PersonnelSubareasEditor - Step 3 of Regional path
 *
 * Accordion UI - one section per Personnel Area.
 * Each section contains an editable table of Subareas.
 */

import { useState } from 'react';
import { Plus, Trash2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { usePersonnelAreaStore } from '../../stores/personnelAreaStore';
import type { PersonnelSubarea } from '../../stores/personnelAreaStore';

export function PersonnelSubareasEditor() {
  const {
    personnelAreas,
    personnelSubareas,
    addPersonnelSubarea,
    updatePersonnelSubarea,
    removePersonnelSubarea,
    getSubareasForArea,
    canProceedFromSubareas,
    setStep,
  } = usePersonnelAreaStore();

  // Track which accordions are expanded
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(
    new Set(personnelAreas.map(pa => pa.code))
  );

  const toggleArea = (code: string) => {
    setExpandedAreas(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const handleCodeChange = (paCode: string, oldPsaCode: string, newCode: string) => {
    const code = newCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    updatePersonnelSubarea(paCode, oldPsaCode, { code });
  };

  const handleDescriptionChange = (paCode: string, psaCode: string, value: string) => {
    updatePersonnelSubarea(paCode, psaCode, { description: value.slice(0, 15) });
  };

  // Validation
  const getRowErrors = (psa: PersonnelSubarea, paCode: string): string[] => {
    const errors: string[] = [];
    if (!psa.code) {
      errors.push('Code is required');
    } else if (psa.code.length < 4) {
      errors.push('Code must be 4 characters');
    }
    if (!psa.description) {
      errors.push('Description is required');
    }
    // Check for duplicate codes within the same PA
    const siblings = personnelSubareas.filter(p => p.personnelAreaCode === paCode);
    const duplicateIndex = siblings.findIndex(
      (p) => p !== psa && p.code === psa.code && psa.code !== ''
    );
    if (duplicateIndex !== -1) {
      errors.push('Duplicate code in this area');
    }
    return errors;
  };

  const canContinue = canProceedFromSubareas();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Define Personnel Subareas
        </h3>
        <p className="text-sm text-gray-500">
          Each Personnel Area needs at least one Subarea. Subareas typically represent
          offices, buildings, or functional divisions within an area.
        </p>
      </div>

      {/* Summary */}
      <div className="text-sm text-gray-600">
        {personnelAreas.length} Personnel Area{personnelAreas.length !== 1 ? 's' : ''} •{' '}
        {personnelSubareas.length} Subarea{personnelSubareas.length !== 1 ? 's' : ''} total
      </div>

      {/* Accordion List */}
      <div className="space-y-3">
        {personnelAreas.map((pa) => {
          const isExpanded = expandedAreas.has(pa.code);
          const subareas = getSubareasForArea(pa.code);
          const hasErrors = subareas.some(psa => getRowErrors(psa, pa.code).length > 0);

          return (
            <div key={pa.code} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Accordion Header */}
              <button
                onClick={() => toggleArea(pa.code)}
                className={`w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors ${
                  hasErrors ? 'bg-red-50 hover:bg-red-100' : ''
                }`}
              >
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                )}
                <span className="font-mono font-medium text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200">
                  {pa.code}
                </span>
                <span className="font-medium text-gray-900">{pa.description || '(No description)'}</span>
                <span className="text-sm text-gray-500 ml-auto">
                  {subareas.length} subarea{subareas.length !== 1 ? 's' : ''}
                </span>
                {hasErrors && (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
              </button>

              {/* Accordion Content */}
              {isExpanded && (
                <div className="p-4 bg-white">
                  {/* Add button */}
                  <div className="flex items-center gap-3 mb-3">
                    <button
                      onClick={() => addPersonnelSubarea(pa.code)}
                      className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100"
                    >
                      <Plus className="h-3 w-3" />
                      Add Subarea
                    </button>
                  </div>

                  {/* Subareas Table */}
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="w-28 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Code*
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Description*
                          </th>
                          <th className="w-12 px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {subareas.map((psa) => {
                          const errors = getRowErrors(psa, pa.code);
                          const hasRowErrors = errors.length > 0;

                          return (
                            <tr key={psa.code} className={hasRowErrors ? 'bg-red-50' : 'hover:bg-gray-50'}>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={psa.code}
                                  onChange={(e) => handleCodeChange(pa.code, psa.code, e.target.value)}
                                  placeholder="PHX1"
                                  maxLength={4}
                                  className={`w-20 px-2 py-1 text-sm border rounded uppercase font-mono focus:outline-none focus:ring-1 ${
                                    hasRowErrors
                                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                                      : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500'
                                  }`}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={psa.description}
                                    onChange={(e) => handleDescriptionChange(pa.code, psa.code, e.target.value)}
                                    placeholder="e.g., Phoenix Office"
                                    maxLength={15}
                                    className={`flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 ${
                                      hasRowErrors
                                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                                        : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500'
                                    }`}
                                  />
                                  {hasRowErrors && (
                                    <div className="flex-shrink-0" title={errors.join(', ')}>
                                      <AlertCircle className="h-4 w-4 text-red-500" />
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  onClick={() => removePersonnelSubarea(pa.code, psa.code)}
                                  disabled={subareas.length <= 1}
                                  className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Delete subarea"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {subareas.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">
                              No subareas. Click "Add Subarea" to create one.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Hint */}
      <p className="text-xs text-gray-500">
        Subarea codes must be 4 characters. Description max 15 characters.
        The same subarea code can be used in different Personnel Areas.
      </p>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          onClick={() => setStep('areas')}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={() => setStep('review')}
          disabled={!canContinue}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue to Review
        </button>
      </div>
    </div>
  );
}
