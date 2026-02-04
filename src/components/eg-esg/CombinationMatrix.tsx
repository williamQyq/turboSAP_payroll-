/**
 * CombinationMatrix - Step 4 of EG/ESG wizard
 *
 * Checkbox grid for selecting valid EG/ESG combinations.
 * Rows = Employee Groups, Columns = Employee Subgroups
 */

import { Check, Square, CheckSquare, XSquare } from 'lucide-react';
import { useEmployeeGroupStore } from '../../stores/employeeGroupStore';

export function CombinationMatrix() {
  const {
    employeeGroups,
    employeeSubgroups,
    isCombinationValid,
    toggleCombination,
    selectAllForGroup,
    clearAllForGroup,
    nextStep,
    prevStep,
    validCombinations,
  } = useEmployeeGroupStore();

  // Count selected combinations per group for summary
  const getSelectedCount = (egCode: string) => {
    return validCombinations.filter(c => c.egCode === egCode).length;
  };

  const totalCombinations = validCombinations.length;
  const maxPossible = employeeGroups.length * employeeSubgroups.length;

  const canContinue = totalCombinations > 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Select Valid Combinations
        </h3>
        <p className="text-sm text-gray-500">
          Choose which Employee Group / Subgroup combinations are valid for your organization.
          Click a cell to toggle, or use row controls to select/clear all.
        </p>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-600">
          <strong className="text-purple-600">{totalCombinations}</strong> of {maxPossible} combinations selected
        </span>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-r border-gray-200 min-w-[180px]">
                Employee Group
              </th>
              {employeeSubgroups.map((esg) => (
                <th
                  key={esg.code}
                  className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase min-w-[80px]"
                >
                  <div className="flex flex-col items-center">
                    <span className="font-mono font-bold text-gray-700">{esg.code}</span>
                    <span className="text-[10px] font-normal normal-case text-gray-400 mt-0.5 max-w-[70px] truncate" title={esg.description}>
                      {esg.description}
                    </span>
                  </div>
                </th>
              ))}
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase border-l border-gray-200 min-w-[100px]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employeeGroups.map((eg) => {
              const selectedCount = getSelectedCount(eg.code);
              const allSelected = selectedCount === employeeSubgroups.length;
              const noneSelected = selectedCount === 0;

              return (
                <tr key={eg.code} className="hover:bg-gray-50">
                  {/* Row Header - sticky left */}
                  <td className="sticky left-0 bg-white px-4 py-3 border-r border-gray-200">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                        {eg.code}
                      </span>
                      <span className="text-sm text-gray-600">{eg.description}</span>
                      <span className="text-xs text-gray-400 ml-auto">
                        ({selectedCount}/{employeeSubgroups.length})
                      </span>
                    </div>
                  </td>

                  {/* Combination Cells */}
                  {employeeSubgroups.map((esg) => {
                    const isValid = isCombinationValid(eg.code, esg.code);

                    return (
                      <td key={esg.code} className="px-3 py-3 text-center">
                        <button
                          onClick={() => toggleCombination(eg.code, esg.code)}
                          className={`w-8 h-8 rounded flex items-center justify-center transition-all ${
                            isValid
                              ? 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                              : 'bg-gray-50 text-gray-300 hover:bg-gray-100 hover:text-gray-400'
                          }`}
                          title={isValid ? 'Click to remove' : 'Click to add'}
                        >
                          {isValid ? (
                            <Check className="h-5 w-5" />
                          ) : (
                            <Square className="h-5 w-5" />
                          )}
                        </button>
                      </td>
                    );
                  })}

                  {/* Row Actions */}
                  <td className="px-3 py-3 border-l border-gray-200">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => selectAllForGroup(eg.code)}
                        disabled={allSelected}
                        className="p-1.5 rounded text-gray-400 hover:text-green-600 hover:bg-green-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Select all"
                      >
                        <CheckSquare className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => clearAllForGroup(eg.code)}
                        disabled={noneSelected}
                        className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Clear all"
                      >
                        <XSquare className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Hint */}
      <p className="text-xs text-gray-500">
        Tip: Uncheck combinations that don't apply. For example, Interns typically don't have Salaried Exempt positions.
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
