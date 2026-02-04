/**
 * FinalReview - Step 5 of EG/ESG wizard
 *
 * Tree view showing structure, summary stats, CSV preview, and export button.
 */

import { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { useEmployeeGroupStore } from '../../stores/employeeGroupStore';

export function FinalReview() {
  const {
    employeeGroups,
    employeeSubgroups,
    validCombinations,
    getValidSubgroupsForGroup,
    generateCSV,
    prevStep,
    reset,
  } = useEmployeeGroupStore();

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(employeeGroups.map(g => g.code))
  );
  const [copied, setCopied] = useState(false);

  const csvContent = generateCSV();

  const toggleGroup = (code: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const handleDownload = () => {
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_group_subgroup.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(csvContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartOver = () => {
    if (confirm('Are you sure you want to start over? All progress will be lost.')) {
      reset();
    }
  };

  // Stats
  const totalGroups = employeeGroups.length;
  const totalSubgroups = employeeSubgroups.length;
  const totalCombinations = validCombinations.length;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Final Review
        </h3>
        <p className="text-sm text-gray-500">
          Review your Employee Group and Subgroup configuration before exporting.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{totalGroups}</div>
          <div className="text-sm text-purple-700">Employee Groups</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{totalSubgroups}</div>
          <div className="text-sm text-blue-700">Employee Subgroups</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{totalCombinations}</div>
          <div className="text-sm text-green-700">Valid Combinations</div>
        </div>
      </div>

      {/* Tree View */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <span className="text-sm font-medium text-gray-700">Structure Preview</span>
        </div>
        <div className="p-4 bg-white max-h-64 overflow-y-auto">
          {employeeGroups.map((eg) => {
            const isExpanded = expandedGroups.has(eg.code);
            const subgroups = getValidSubgroupsForGroup(eg.code);

            return (
              <div key={eg.code} className="mb-2">
                {/* Group Row */}
                <button
                  onClick={() => toggleGroup(eg.code)}
                  className="flex items-center gap-2 w-full text-left hover:bg-gray-50 rounded px-2 py-1 -ml-2"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                  <Folder className="h-4 w-4 text-amber-500" />
                  <span className="font-mono font-medium text-gray-700">{eg.code}</span>
                  <span className="text-gray-500">-</span>
                  <span className="text-gray-600">{eg.description}</span>
                  <span className="text-xs text-gray-400 ml-auto">
                    ({subgroups.length} subgroup{subgroups.length !== 1 ? 's' : ''})
                  </span>
                </button>

                {/* Subgroups */}
                {isExpanded && (
                  <div className="ml-6 mt-1 space-y-1">
                    {subgroups.length > 0 ? (
                      subgroups.map((esg, index) => (
                        <div
                          key={esg.code}
                          className="flex items-center gap-2 px-2 py-1 text-sm"
                        >
                          <span className="text-gray-300">
                            {index === subgroups.length - 1 ? '└──' : '├──'}
                          </span>
                          <FileText className="h-4 w-4 text-blue-400" />
                          <span className="font-mono text-gray-600">{esg.code}</span>
                          <span className="text-gray-400">-</span>
                          <span className="text-gray-500">{esg.description}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-2 px-2 py-1 text-sm text-gray-400 italic">
                        <span className="text-gray-300">└──</span>
                        No subgroups selected
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* CSV Preview */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">CSV Preview</span>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy
              </>
            )}
          </button>
        </div>
        <pre className="p-4 bg-gray-900 text-gray-100 text-sm font-mono overflow-x-auto max-h-48">
          {csvContent}
        </pre>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-700"
        >
          <Download className="h-5 w-5" />
          Download CSV
        </button>
        <button
          onClick={handleStartOver}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50"
        >
          <RotateCcw className="h-4 w-4" />
          Start Over
        </button>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-gray-200">
        <button
          onClick={prevStep}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
      </div>
    </div>
  );
}
