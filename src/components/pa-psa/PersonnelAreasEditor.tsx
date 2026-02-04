/**
 * PersonnelAreasEditor - Step 2 of Regional path
 *
 * Editable table for Personnel Areas.
 * Code is 4 characters, Description is max 30 chars.
 * Includes Company Code dropdown per row.
 */

import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { usePersonnelAreaStore } from '../../stores/personnelAreaStore';
import type { PersonnelArea } from '../../stores/personnelAreaStore';

export function PersonnelAreasEditor() {
  const {
    personnelAreas,
    availableCompanyCodes,
    addPersonnelArea,
    updatePersonnelArea,
    removePersonnelArea,
    canProceedFromAreas,
    setStep,
  } = usePersonnelAreaStore();

  const handleAddRow = () => {
    addPersonnelArea();
  };

  const handleCodeChange = (oldCode: string, newCode: string) => {
    // Limit to 4 characters, alphanumeric, uppercase
    const code = newCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    updatePersonnelArea(oldCode, { code });
  };

  const handleDescriptionChange = (code: string, value: string) => {
    updatePersonnelArea(code, { description: value.slice(0, 30) });
  };

  const handleCompanyCodeChange = (code: string, companyCode: string) => {
    updatePersonnelArea(code, { companyCode });
  };

  // Validation
  const getRowErrors = (area: PersonnelArea, index: number): string[] => {
    const errors: string[] = [];
    if (!area.code) {
      errors.push('Code is required');
    } else if (area.code.length < 4) {
      errors.push('Code must be 4 characters');
    }
    if (!area.description) {
      errors.push('Description is required');
    }
    // Check for duplicate codes
    const duplicateIndex = personnelAreas.findIndex(
      (pa, i) => i !== index && pa.code === area.code && area.code !== ''
    );
    if (duplicateIndex !== -1) {
      errors.push('Duplicate code');
    }
    return errors;
  };

  const hasCompanyCodes = availableCompanyCodes.length > 0;
  const canContinue = canProceedFromAreas();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Define Personnel Areas
        </h3>
        <p className="text-sm text-gray-500">
          Personnel Areas typically represent regions, divisions, or major organizational units.
        </p>
      </div>

      {/* Warning if no company codes */}
      {!hasCompanyCodes && (
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <div className="text-sm text-amber-700">
            No Company Codes configured.
            <a href="/company-code" className="underline ml-1">Configure them first</a> for a complete setup.
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleAddRow}
          className="inline-flex items-center gap-2 rounded-md bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100"
        >
          <Plus className="h-4 w-4" />
          Add Personnel Area
        </button>
        <span className="text-sm text-gray-500">
          {personnelAreas.length} area{personnelAreas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-12 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                #
              </th>
              <th className="w-28 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Code*
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Description*
              </th>
              {hasCompanyCodes && (
                <th className="w-48 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Company Code
                </th>
              )}
              <th className="w-16 px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {personnelAreas.map((area, index) => {
              const errors = getRowErrors(area, index);
              const hasErrors = errors.length > 0;

              return (
                <tr key={area.code || index} className={hasErrors ? 'bg-red-50' : 'hover:bg-gray-50'}>
                  <td className="px-3 py-2 text-sm text-gray-500">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={area.code}
                      onChange={(e) => handleCodeChange(area.code, e.target.value)}
                      placeholder="1000"
                      maxLength={4}
                      className={`w-20 px-2 py-1.5 text-sm border rounded uppercase font-mono focus:outline-none focus:ring-1 ${
                        hasErrors
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500'
                      }`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={area.description}
                        onChange={(e) => handleDescriptionChange(area.code, e.target.value)}
                        placeholder="e.g., Southwest Region"
                        maxLength={30}
                        className={`flex-1 px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 ${
                          hasErrors
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500'
                        }`}
                      />
                      {hasErrors && (
                        <div className="flex-shrink-0" title={errors.join(', ')}>
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        </div>
                      )}
                    </div>
                  </td>
                  {hasCompanyCodes && (
                    <td className="px-3 py-2">
                      <select
                        value={area.companyCode}
                        onChange={(e) => handleCompanyCodeChange(area.code, e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:border-purple-500 focus:ring-purple-500 bg-white"
                      >
                        <option value="">Select...</option>
                        {availableCompanyCodes.map((cc) => (
                          <option key={cc.code} value={cc.code}>
                            {cc.code} - {cc.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => removePersonnelArea(area.code)}
                      disabled={personnelAreas.length <= 1}
                      className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Delete area"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {personnelAreas.length === 0 && (
              <tr>
                <td colSpan={hasCompanyCodes ? 5 : 4} className="px-6 py-8 text-center text-gray-500">
                  No personnel areas. Click "Add Personnel Area" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Hint */}
      <p className="text-xs text-gray-500">
        Code must be 4 characters (A-Z or 0-9). Description max 30 characters.
        Each Personnel Area will contain one or more Subareas.
      </p>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          onClick={() => setStep('complexity')}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={() => setStep('subareas')}
          disabled={!canContinue}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
