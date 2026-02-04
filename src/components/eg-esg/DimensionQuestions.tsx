/**
 * DimensionQuestions - Step 1 of EG/ESG wizard
 *
 * Multi-select cards for employment types and pay methods,
 * plus Yes/No questions for FLSA and union status.
 */

import { CheckCircle } from 'lucide-react';
import { useEmployeeGroupStore } from '../../stores/employeeGroupStore';

// =============================================================================
// Options Configuration
// =============================================================================

const EMPLOYMENT_TYPES = [
  { id: 'regular', label: 'Regular', description: 'Full-time permanent employees' },
  { id: 'part-time', label: 'Part-Time', description: 'Employees working less than full-time hours' },
  { id: 'temporary', label: 'Temporary', description: 'Fixed-term or temporary workers' },
  { id: 'intern', label: 'Intern', description: 'Internship or trainee positions' },
  { id: 'seasonal', label: 'Seasonal', description: 'Workers hired for specific seasons' },
  { id: 'contractor', label: 'Contractor', description: 'Independent contractors or 1099 workers' },
];

const PAY_METHODS = [
  { id: 'salaried', label: 'Salaried', description: 'Fixed salary regardless of hours worked' },
  { id: 'hourly', label: 'Hourly', description: 'Paid based on hours worked' },
];

// =============================================================================
// Component
// =============================================================================

export function DimensionQuestions() {
  const {
    dimensions,
    setEmploymentTypes,
    setPayMethods,
    setHasBothFlsaTypes,
    setHasUnionEmployees,
    generateFromDimensions,
    nextStep,
  } = useEmployeeGroupStore();

  const toggleEmploymentType = (id: string) => {
    if (dimensions.employmentTypes.includes(id)) {
      setEmploymentTypes(dimensions.employmentTypes.filter(t => t !== id));
    } else {
      setEmploymentTypes([...dimensions.employmentTypes, id]);
    }
  };

  const togglePayMethod = (id: string) => {
    if (dimensions.payMethods.includes(id)) {
      setPayMethods(dimensions.payMethods.filter(t => t !== id));
    } else {
      setPayMethods([...dimensions.payMethods, id]);
    }
  };

  const canContinue =
    dimensions.employmentTypes.length > 0 &&
    dimensions.payMethods.length > 0 &&
    dimensions.hasBothFlsaTypes !== null &&
    dimensions.hasUnionEmployees !== null;

  const handleContinue = () => {
    generateFromDimensions();
    nextStep();
  };

  return (
    <div className="space-y-8">
      {/* Question 1: Employment Types */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          What employment types does your company have?
        </h3>
        <p className="text-sm text-gray-500 mb-4">Select all that apply</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {EMPLOYMENT_TYPES.map((option) => {
            const isSelected = dimensions.employmentTypes.includes(option.id);
            return (
              <button
                key={option.id}
                onClick={() => toggleEmploymentType(option.id)}
                className={`w-full rounded-lg border-2 px-4 py-3 text-left transition-all ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <CheckCircle className="h-4 w-4 text-white" />}
                  </div>
                  <div>
                    <span className="font-medium">{option.label}</span>
                    <p className="text-sm text-gray-500">{option.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Question 2: Pay Methods */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          How are employees' wages calculated?
        </h3>
        <p className="text-sm text-gray-500 mb-4">Select all that apply</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PAY_METHODS.map((option) => {
            const isSelected = dimensions.payMethods.includes(option.id);
            return (
              <button
                key={option.id}
                onClick={() => togglePayMethod(option.id)}
                className={`w-full rounded-lg border-2 px-4 py-3 text-left transition-all ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <CheckCircle className="h-4 w-4 text-white" />}
                  </div>
                  <div>
                    <span className="font-medium">{option.label}</span>
                    <p className="text-sm text-gray-500">{option.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Question 3: FLSA Status */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Do you have both exempt and non-exempt employees?
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          FLSA classification determines overtime eligibility
        </p>
        <div className="flex gap-4">
          {[
            { value: true, label: 'Yes' },
            { value: false, label: 'No' },
          ].map((option) => (
            <button
              key={String(option.value)}
              onClick={() => setHasBothFlsaTypes(option.value)}
              className={`flex-1 rounded-lg border-2 px-6 py-4 text-lg font-medium transition-all ${
                dimensions.hasBothFlsaTypes === option.value
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Question 4: Union Employees */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Do you have union employees?
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Union membership may require separate subgroup tracking
        </p>
        <div className="flex gap-4">
          {[
            { value: true, label: 'Yes' },
            { value: false, label: 'No' },
          ].map((option) => (
            <button
              key={String(option.value)}
              onClick={() => setHasUnionEmployees(option.value)}
              className={`flex-1 rounded-lg border-2 px-6 py-4 text-lg font-medium transition-all ${
                dimensions.hasUnionEmployees === option.value
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Continue Button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
