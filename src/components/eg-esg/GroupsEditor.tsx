/**
 * GroupsEditor - Step 2 of EG/ESG wizard
 *
 * Editable table for Employee Groups.
 * Code is 1 character, Description is max 20 chars.
 */

import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { useEmployeeGroupStore } from '../../stores/employeeGroupStore';
import type { EmployeeGroup } from '../../stores/employeeGroupStore';

export function GroupsEditor() {
  const {
    employeeGroups,
    addEmployeeGroup,
    updateEmployeeGroup,
    removeEmployeeGroup,
    nextStep,
    prevStep,
  } = useEmployeeGroupStore();

  const handleAddRow = () => {
    addEmployeeGroup({ code: '', description: '' });
  };

  const handleCodeChange = (index: number, value: string) => {
    // Limit to 1 character, uppercase
    const code = value.toUpperCase().slice(0, 1);
    updateEmployeeGroup(index, { code });
  };

  const handleDescriptionChange = (index: number, value: string) => {
    // Limit to 20 characters
    const description = value.slice(0, 20);
    updateEmployeeGroup(index, { description });
  };

  // Validation
  const getRowErrors = (group: EmployeeGroup, index: number): string[] => {
    const errors: string[] = [];
    if (!group.code) {
      errors.push('Code is required');
    }
    if (!group.description) {
      errors.push('Description is required');
    }
    // Check for duplicate codes
    const duplicateIndex = employeeGroups.findIndex(
      (g, i) => i !== index && g.code === group.code && group.code !== ''
    );
    if (duplicateIndex !== -1) {
      errors.push('Duplicate code');
    }
    return errors;
  };

  const hasAnyErrors = employeeGroups.some((g, i) => getRowErrors(g, i).length > 0);
  const canContinue = employeeGroups.length > 0 && !hasAnyErrors;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Review Employee Groups
        </h3>
        <p className="text-sm text-gray-500">
          These groups were generated based on your employment types. You can edit, add, or remove groups.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleAddRow}
          className="inline-flex items-center gap-2 rounded-md bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100"
        >
          <Plus className="h-4 w-4" />
          Add Group
        </button>
        <span className="text-sm text-gray-500">
          {employeeGroups.length} group{employeeGroups.length !== 1 ? 's' : ''}
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
              <th className="w-24 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Code*
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Description*
              </th>
              <th className="w-16 px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employeeGroups.map((group, index) => {
              const errors = getRowErrors(group, index);
              const hasErrors = errors.length > 0;

              return (
                <tr key={index} className={hasErrors ? 'bg-red-50' : 'hover:bg-gray-50'}>
                  <td className="px-3 py-2 text-sm text-gray-500">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={group.code}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      placeholder="R"
                      maxLength={1}
                      className={`w-16 px-2 py-1.5 text-sm border rounded uppercase font-mono focus:outline-none focus:ring-1 ${
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
                        value={group.description}
                        onChange={(e) => handleDescriptionChange(index, e.target.value)}
                        placeholder="Regular"
                        maxLength={20}
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
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => removeEmployeeGroup(index)}
                      disabled={employeeGroups.length <= 1}
                      className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Delete group"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {employeeGroups.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  No employee groups. Click "Add Group" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Hint */}
      <p className="text-xs text-gray-500">
        Code must be 1 character (A-Z or 0-9). Description max 20 characters.
      </p>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          onClick={prevStep}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={nextStep}
          disabled={!canContinue}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
