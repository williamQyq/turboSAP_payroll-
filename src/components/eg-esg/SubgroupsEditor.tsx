/**
 * SubgroupsEditor - Step 3 of EG/ESG wizard
 *
 * Editable table for Employee Subgroups.
 * Code is 2 characters, Description is max 20 chars.
 * Shows attribute badges (Salaried/Hourly, Exempt/Non-Exempt, Union).
 */

import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { useEmployeeGroupStore } from '../../stores/employeeGroupStore';
import type { EmployeeSubgroup } from '../../stores/employeeGroupStore';

// Badge component for subgroup attributes
function AttributeBadge({ label, color }: { label: string; color: 'blue' | 'green' | 'amber' | 'purple' }) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    purple: 'bg-purple-100 text-purple-700',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClasses[color]}`}>
      {label}
    </span>
  );
}

function SubgroupBadges({ subgroup }: { subgroup: EmployeeSubgroup }) {
  const badges: { label: string; color: 'blue' | 'green' | 'amber' | 'purple' }[] = [];

  if (subgroup.isSalaried) badges.push({ label: 'Salaried', color: 'blue' });
  if (subgroup.isHourly) badges.push({ label: 'Hourly', color: 'blue' });
  if (subgroup.isExempt) badges.push({ label: 'Exempt', color: 'green' });
  if (subgroup.isNonExempt) badges.push({ label: 'Non-Exempt', color: 'amber' });
  if (subgroup.isUnion) badges.push({ label: 'Union', color: 'purple' });

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {badges.map((badge, i) => (
        <AttributeBadge key={i} label={badge.label} color={badge.color} />
      ))}
    </div>
  );
}

export function SubgroupsEditor() {
  const {
    employeeSubgroups,
    addEmployeeSubgroup,
    updateEmployeeSubgroup,
    removeEmployeeSubgroup,
    nextStep,
    prevStep,
  } = useEmployeeGroupStore();

  const handleAddRow = () => {
    addEmployeeSubgroup({ code: '', description: '' });
  };

  const handleCodeChange = (index: number, value: string) => {
    // Limit to 2 characters, uppercase
    const code = value.toUpperCase().slice(0, 2);
    updateEmployeeSubgroup(index, { code });
  };

  const handleDescriptionChange = (index: number, value: string) => {
    // Limit to 20 characters
    const description = value.slice(0, 20);
    updateEmployeeSubgroup(index, { description });
  };

  // Validation
  const getRowErrors = (subgroup: EmployeeSubgroup, index: number): string[] => {
    const errors: string[] = [];
    if (!subgroup.code) {
      errors.push('Code is required');
    } else if (subgroup.code.length < 2) {
      errors.push('Code must be 2 characters');
    }
    if (!subgroup.description) {
      errors.push('Description is required');
    }
    // Check for duplicate codes
    const duplicateIndex = employeeSubgroups.findIndex(
      (s, i) => i !== index && s.code === subgroup.code && subgroup.code !== ''
    );
    if (duplicateIndex !== -1) {
      errors.push('Duplicate code');
    }
    return errors;
  };

  const hasAnyErrors = employeeSubgroups.some((s, i) => getRowErrors(s, i).length > 0);
  const canContinue = employeeSubgroups.length > 0 && !hasAnyErrors;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Review Employee Subgroups
        </h3>
        <p className="text-sm text-gray-500">
          These subgroups were generated based on pay methods, FLSA status, and union membership.
          You can edit, add, or remove subgroups.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleAddRow}
          className="inline-flex items-center gap-2 rounded-md bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100"
        >
          <Plus className="h-4 w-4" />
          Add Subgroup
        </button>
        <span className="text-sm text-gray-500">
          {employeeSubgroups.length} subgroup{employeeSubgroups.length !== 1 ? 's' : ''}
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
              <th className="w-48 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Attributes
              </th>
              <th className="w-16 px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employeeSubgroups.map((subgroup, index) => {
              const errors = getRowErrors(subgroup, index);
              const hasErrors = errors.length > 0;

              return (
                <tr key={index} className={hasErrors ? 'bg-red-50' : 'hover:bg-gray-50'}>
                  <td className="px-3 py-2 text-sm text-gray-500">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={subgroup.code}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      placeholder="SE"
                      maxLength={2}
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
                        value={subgroup.description}
                        onChange={(e) => handleDescriptionChange(index, e.target.value)}
                        placeholder="Salaried Exempt"
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
                  <td className="px-3 py-2">
                    <SubgroupBadges subgroup={subgroup} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => removeEmployeeSubgroup(index)}
                      disabled={employeeSubgroups.length <= 1}
                      className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Delete subgroup"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {employeeSubgroups.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No employee subgroups. Click "Add Subgroup" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Hint */}
      <p className="text-xs text-gray-500">
        Code must be 2 characters (A-Z or 0-9). Description max 20 characters.
        Badges are auto-generated based on characteristics.
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
