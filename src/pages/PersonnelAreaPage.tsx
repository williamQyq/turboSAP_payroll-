/**
 * PersonnelAreaPage - Wizard for PA/PSA Configuration
 *
 * Supports three paths:
 * - Simple: Single location quick setup
 * - Regional: Manual entry with full customization
 * - Import: File upload with column mapping
 */

import { DashboardLayout } from '../components/layout/DashboardLayout';
import { usePersonnelAreaStore } from '../stores/personnelAreaStore';
import type { WizardStep } from '../stores/personnelAreaStore';
import {
  ComplexitySelector,
  SimpleForm,
  PersonnelAreasEditor,
  PersonnelSubareasEditor,
  ImportUpload,
  ImportMapping,
  ImportPreview,
  FinalReview,
} from '../components/pa-psa';
import { Check, MapPin, Map, Upload, FileCheck } from 'lucide-react';

// =============================================================================
// Step Configuration
// =============================================================================

interface StepConfig {
  id: WizardStep;
  label: string;
  shortLabel: string;
  path: 'all' | 'simple' | 'regional' | 'import';
}

// Define steps per path
const ALL_STEPS: StepConfig[] = [
  { id: 'complexity', label: 'Choose Setup Type', shortLabel: 'Type', path: 'all' },
  // Simple path
  { id: 'simple-form', label: 'Simple Setup', shortLabel: 'Setup', path: 'simple' },
  // Regional path
  { id: 'areas', label: 'Personnel Areas', shortLabel: 'Areas', path: 'regional' },
  { id: 'subareas', label: 'Personnel Subareas', shortLabel: 'Subareas', path: 'regional' },
  // Import path
  { id: 'import-upload', label: 'Upload File', shortLabel: 'Upload', path: 'import' },
  { id: 'import-mapping', label: 'Map Columns', shortLabel: 'Map', path: 'import' },
  { id: 'import-preview', label: 'Preview', shortLabel: 'Preview', path: 'import' },
  // All paths end here
  { id: 'review', label: 'Final Review', shortLabel: 'Review', path: 'all' },
];

function getStepsForPath(complexity: 'simple' | 'regional' | 'import' | null): StepConfig[] {
  if (!complexity) {
    return ALL_STEPS.filter(s => s.id === 'complexity');
  }

  return ALL_STEPS.filter(s => s.path === 'all' || s.path === complexity);
}

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

  // Icon based on step path
  const getIcon = () => {
    if (isCompleted) return <Check className="h-4 w-4" />;
    if (step.path === 'simple') return <MapPin className="h-4 w-4" />;
    if (step.path === 'regional') return <Map className="h-4 w-4" />;
    if (step.path === 'import') return <Upload className="h-4 w-4" />;
    if (step.id === 'review') return <FileCheck className="h-4 w-4" />;
    return <span>{index + 1}</span>;
  };

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
        {getIcon()}
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

export function PersonnelAreaPage() {
  const { currentStep, complexity, setStep } = usePersonnelAreaStore();

  const visibleSteps = getStepsForPath(complexity);
  const currentIndex = visibleSteps.findIndex(s => s.id === currentStep);
  const currentStepConfig = visibleSteps[currentIndex];

  const handleStepClick = (stepId: WizardStep, index: number) => {
    if (index <= currentIndex) {
      setStep(stepId);
    }
  };

  // Render the current step's content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'complexity':
        return <ComplexitySelector />;
      case 'simple-form':
        return <SimpleForm />;
      case 'areas':
        return <PersonnelAreasEditor />;
      case 'subareas':
        return <PersonnelSubareasEditor />;
      case 'import-upload':
        return <ImportUpload />;
      case 'import-mapping':
        return <ImportMapping />;
      case 'import-preview':
        return <ImportPreview />;
      case 'review':
        return <FinalReview />;
      default:
        return <ComplexitySelector />;
    }
  };

  return (
    <DashboardLayout
      title="Personnel Area / Subarea"
      description="Configure SAP Personnel Areas (PA) and Personnel Subareas (PSA)"
    >
      <div className="max-w-4xl mx-auto">
        {/* Step Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {visibleSteps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                <StepIndicator
                  step={step}
                  index={index}
                  currentIndex={currentIndex}
                  onClick={() => handleStepClick(step.id, index)}
                />
                {index < visibleSteps.length - 1 && (
                  <StepConnector isCompleted={index < currentIndex} />
                )}
              </div>
            ))}
          </div>

          {/* Current Step Title - visible on small screens */}
          <div className="md:hidden mt-4 text-center">
            <span className="text-sm font-medium text-purple-600">
              Step {currentIndex + 1}: {currentStepConfig?.label}
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
