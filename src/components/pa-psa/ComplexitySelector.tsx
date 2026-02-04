/**
 * ComplexitySelector - Step 1 of PA/PSA wizard
 *
 * Three large cards for choosing the setup path:
 * - Simple: Single location
 * - Regional: Multiple areas with manual entry
 * - Import: Upload a file
 */

import { MapPin, Map, Upload } from 'lucide-react';
import { usePersonnelAreaStore } from '../../stores/personnelAreaStore';
import type { ComplexityType } from '../../stores/personnelAreaStore';
import { useEffect } from 'react';

interface PathOption {
  id: ComplexityType;
  icon: typeof MapPin;
  title: string;
  description: string;
  details: string[];
}

const PATH_OPTIONS: PathOption[] = [
  {
    id: 'simple',
    icon: MapPin,
    title: 'Simple',
    description: 'Single location or all employees treated the same',
    details: [
      'Creates one Personnel Area',
      'One default Subarea (General)',
      'Quick setup in seconds',
    ],
  },
  {
    id: 'regional',
    icon: Map,
    title: 'Regional',
    description: 'Multiple locations, regions, or divisions',
    details: [
      'Define multiple Personnel Areas',
      'Add Subareas to each area',
      'Full customization',
    ],
  },
  {
    id: 'import',
    icon: Upload,
    title: 'Import',
    description: 'I have a file with location data',
    details: [
      'Upload CSV or Excel',
      'Map columns to fields',
      'Auto-generate structure',
    ],
  },
];

export function ComplexitySelector() {
  const { complexity, setComplexity, loadCompanyCodes } = usePersonnelAreaStore();

  // Load company codes when component mounts
  useEffect(() => {
    loadCompanyCodes();
  }, [loadCompanyCodes]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          How would you like to set up your Personnel Areas?
        </h3>
        <p className="text-sm text-gray-500">
          Choose the approach that best matches your organization's structure.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PATH_OPTIONS.map((option) => {
          const isSelected = complexity === option.id;
          const Icon = option.icon;

          return (
            <button
              key={option.id}
              onClick={() => setComplexity(option.id)}
              className={`
                relative flex flex-col items-center text-center p-6 rounded-xl border-2 transition-all
                ${isSelected
                  ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-500/20'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }
              `}
            >
              {/* Icon */}
              <div
                className={`
                  w-14 h-14 rounded-full flex items-center justify-center mb-4
                  ${isSelected ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}
                `}
              >
                <Icon className="h-7 w-7" />
              </div>

              {/* Title */}
              <h4 className={`text-lg font-semibold mb-1 ${isSelected ? 'text-purple-700' : 'text-gray-900'}`}>
                {option.title}
              </h4>

              {/* Description */}
              <p className="text-sm text-gray-500 mb-4">
                {option.description}
              </p>

              {/* Details */}
              <ul className="text-xs text-gray-400 space-y-1">
                {option.details.map((detail, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <span className="text-gray-300">•</span>
                    {detail}
                  </li>
                ))}
              </ul>

              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Info note */}
      <p className="text-xs text-gray-400 text-center">
        You can always go back and change your selection.
      </p>
    </div>
  );
}
