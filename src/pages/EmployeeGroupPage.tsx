/**
 * EmployeeGroupPage - 5-Step Wizard for EG/ESG Configuration
 *
 * Steps:
 * 1. Dimension Questions - Select employment types, pay methods, FLSA, union
 * 2. Employee Groups - Review/edit generated groups
 * 3. Employee Subgroups - Review/edit generated subgroups
 * 4. Combination Matrix - Select valid EG/ESG combinations
 * 5. Final Review - Tree view, CSV preview, export
 */

import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useEmployeeGroupStore } from '../stores/employeeGroupStore';
import type { WizardStep } from '../stores/employeeGroupStore';
import {
  DimensionQuestions,
  GroupsEditor,
  SubgroupsEditor,
  CombinationMatrix,
  FinalReview,
} from '../components/eg-esg';
import { Check } from 'lucide-react';

// =============================================================================
// Step Configuration
// =============================================================================

interface StepConfig {
  id: WizardStep;
  label: string;
  shortLabel: string;
}

const STEPS: StepConfig[] = [
  { id: 'dimensions', label: 'Dimension Questions', shortLabel: 'Dimensions' },
  { id: 'groups', label: 'Employee Groups', shortLabel: 'Groups' },
  { id: 'subgroups', label: 'Employee Subgroups', shortLabel: 'Subgroups' },
  { id: 'combinations', label: 'Valid Combinations', shortLabel: 'Combinations' },
  { id: 'review', label: 'Final Review', shortLabel: 'Review' },
];

// =============================================================================
// Step Indicator Component
// =============================================================================

function StepIndicator({
  step,
  index,
  currentIndex,
  onClick,
}: {
  step: StepConfig;
  index: number;
  currentIndex: number;
  onClick: () => void;
}) {
  const isCompleted = index < currentIndex;
  const isCurrent = index === currentIndex;
  const isClickable = index <= currentIndex;

  return (
    <button
      onClick={onClick}
      disabled={!isClickable}
      className={`flex items-center gap-2 ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
    >
      {/* Step Circle */}
      <div
        className={`
          w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
          transition-colors
          ${isCompleted
            ? 'bg-purple-600 text-white'
            : isCurrent
              ? 'bg-purple-600 text-white ring-4 ring-purple-100'
              : 'bg-gray-200 text-gray-500'
          }
        `}
      >
        {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
      </div>

      {/* Step Label - hidden on small screens */}
      <span
        className={`
          hidden md:inline text-sm font-medium
          ${isCurrent ? 'text-purple-600' : isCompleted ? 'text-gray-700' : 'text-gray-400'}
        `}
      >
        {step.shortLabel}
      </span>
    </button>
  );
}

function StepConnector({ isCompleted }: { isCompleted: boolean }) {
  return (
    <div
      className={`
        hidden md:block flex-1 h-0.5 mx-2
        ${isCompleted ? 'bg-purple-600' : 'bg-gray-200'}
      `}
    />
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export function EmployeeGroupPage() {
  const { currentStep, setStep } = useEmployeeGroupStore();

  const currentIndex = STEPS.findIndex(s => s.id === currentStep);
  const currentStepConfig = STEPS[currentIndex];

  const handleStepClick = (stepId: WizardStep, index: number) => {
    // Only allow clicking on completed steps or current step
    if (index <= currentIndex) {
      setStep(stepId);
    }
  };

  // Render the current step's content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'dimensions':
        return <DimensionQuestions />;
      case 'groups':
        return <GroupsEditor />;
      case 'subgroups':
        return <SubgroupsEditor />;
      case 'combinations':
        return <CombinationMatrix />;
      case 'review':
        return <FinalReview />;
      default:
        return <DimensionQuestions />;
    }
  };

  return (
    <DashboardLayout
      title="Employee Group / Subgroup"
      description="Configure SAP Employee Groups (EG) and Employee Subgroups (ESG)"
    >
      <div className="max-w-4xl mx-auto">
        {/* Step Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                <StepIndicator
                  step={step}
                  index={index}
                  currentIndex={currentIndex}
                  onClick={() => handleStepClick(step.id, index)}
                />
                {index < STEPS.length - 1 && (
                  <StepConnector isCompleted={index < currentIndex} />
                )}
              </div>
            ))}
          </div>

          {/* Current Step Title - visible on small screens */}
          <div className="md:hidden mt-4 text-center">
            <span className="text-sm font-medium text-purple-600">
              Step {currentIndex + 1}: {currentStepConfig.label}
            </span>
          </div>
        </div>

        {/* Step Content Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 md:p-8">
          {renderStepContent()}
        </div>
      </div>
    </DashboardLayout>
  );
}
