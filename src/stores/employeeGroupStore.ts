/**
 * Employee Group / Subgroup Store
 *
 * Zustand store for the 5-step EG/ESG configuration wizard.
 * Persisted to localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// =============================================================================
// Types
// =============================================================================

export interface EmployeeGroup {
  code: string;        // 1 char (e.g., "R", "P", "1")
  description: string; // max 20 chars
}

export interface EmployeeSubgroup {
  code: string;        // 2 chars (e.g., "SE", "NH")
  description: string; // max 20 chars
  // Optional metadata for display badges:
  isSalaried?: boolean;
  isHourly?: boolean;
  isExempt?: boolean;
  isNonExempt?: boolean;
  isUnion?: boolean;
}

export interface Combination {
  egCode: string;
  esgCode: string;
}

export interface Dimensions {
  employmentTypes: string[];   // ['regular', 'part-time', 'intern', etc.]
  payMethods: string[];        // ['salaried', 'hourly']
  hasBothFlsaTypes: boolean | null;
  hasUnionEmployees: boolean | null;
}

export type WizardStep = 'dimensions' | 'groups' | 'subgroups' | 'combinations' | 'review';

// =============================================================================
// Store Interface
// =============================================================================

interface EmployeeGroupStore {
  // Current wizard step
  currentStep: WizardStep;

  // Step 1 answers
  dimensions: Dimensions;

  // Steps 2-4 data (generated then user-edited)
  employeeGroups: EmployeeGroup[];
  employeeSubgroups: EmployeeSubgroup[];
  validCombinations: Combination[];

  // Navigation
  setStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;

  // Step 1: Dimension setters
  setEmploymentTypes: (types: string[]) => void;
  setPayMethods: (methods: string[]) => void;
  setHasBothFlsaTypes: (value: boolean | null) => void;
  setHasUnionEmployees: (value: boolean | null) => void;

  // Generation - creates initial groups/subgroups from dimensions
  generateFromDimensions: () => void;

  // Step 2: Employee Groups
  setEmployeeGroups: (groups: EmployeeGroup[]) => void;
  addEmployeeGroup: (group: EmployeeGroup) => void;
  updateEmployeeGroup: (index: number, group: Partial<EmployeeGroup>) => void;
  removeEmployeeGroup: (index: number) => void;

  // Step 3: Employee Subgroups
  setEmployeeSubgroups: (subgroups: EmployeeSubgroup[]) => void;
  addEmployeeSubgroup: (subgroup: EmployeeSubgroup) => void;
  updateEmployeeSubgroup: (index: number, subgroup: Partial<EmployeeSubgroup>) => void;
  removeEmployeeSubgroup: (index: number) => void;

  // Step 4: Combinations
  setValidCombinations: (combinations: Combination[]) => void;
  toggleCombination: (egCode: string, esgCode: string) => void;
  selectAllForGroup: (egCode: string) => void;
  clearAllForGroup: (egCode: string) => void;

  // Utility
  isCombinationValid: (egCode: string, esgCode: string) => boolean;
  getValidSubgroupsForGroup: (egCode: string) => EmployeeSubgroup[];

  // Reset
  reset: () => void;

  // Export
  generateCSV: () => string;
}

// =============================================================================
// Step Order for Navigation
// =============================================================================

const STEP_ORDER: WizardStep[] = ['dimensions', 'groups', 'subgroups', 'combinations', 'review'];

// =============================================================================
// Generation Logic
// =============================================================================

const TYPE_TO_GROUP: Record<string, { code: string; desc: string }> = {
  'regular': { code: 'R', desc: 'Regular' },
  'part-time': { code: 'P', desc: 'Part-Time' },
  'temporary': { code: 'T', desc: 'Temporary' },
  'intern': { code: 'I', desc: 'Intern' },
  'seasonal': { code: 'S', desc: 'Seasonal' },
  'contractor': { code: 'C', desc: 'Contractor' },
};

function generateGroupsAndSubgroups(dimensions: Dimensions) {
  // 1. Map employment types to groups
  const groups: EmployeeGroup[] = dimensions.employmentTypes
    .filter(t => TYPE_TO_GROUP[t])
    .map(t => ({
      code: TYPE_TO_GROUP[t].code,
      description: TYPE_TO_GROUP[t].desc,
    }));

  // 2. Generate subgroups from dimension matrix
  const subgroups: EmployeeSubgroup[] = [];
  const { payMethods, hasBothFlsaTypes, hasUnionEmployees } = dimensions;

  if (payMethods.includes('salaried')) {
    if (hasBothFlsaTypes) {
      subgroups.push({
        code: 'SE',
        description: 'Salaried Exempt',
        isSalaried: true,
        isExempt: true
      });
      subgroups.push({
        code: 'SN',
        description: 'Salaried Non-Exempt',
        isSalaried: true,
        isNonExempt: true
      });
    } else {
      subgroups.push({
        code: 'SA',
        description: 'Salaried',
        isSalaried: true
      });
    }
  }

  if (payMethods.includes('hourly')) {
    if (hasUnionEmployees) {
      subgroups.push({
        code: 'UH',
        description: 'Union Hourly',
        isHourly: true,
        isUnion: true
      });
    }
    subgroups.push({
      code: 'NH',
      description: 'Non-Union Hourly',
      isHourly: true,
      isUnion: false
    });
  }

  // 3. Default: all combinations valid
  const combinations: Combination[] = [];
  for (const eg of groups) {
    for (const esg of subgroups) {
      combinations.push({ egCode: eg.code, esgCode: esg.code });
    }
  }

  return { groups, subgroups, combinations };
}

// =============================================================================
// Initial State
// =============================================================================

const initialDimensions: Dimensions = {
  employmentTypes: [],
  payMethods: [],
  hasBothFlsaTypes: null,
  hasUnionEmployees: null,
};

// =============================================================================
// Store
// =============================================================================

export const useEmployeeGroupStore = create<EmployeeGroupStore>()(
  persist(
    (set, get) => ({
      currentStep: 'dimensions',
      dimensions: initialDimensions,
      employeeGroups: [],
      employeeSubgroups: [],
      validCombinations: [],

      // Navigation
      setStep: (step) => set({ currentStep: step }),

      nextStep: () => {
        const currentIndex = STEP_ORDER.indexOf(get().currentStep);
        if (currentIndex < STEP_ORDER.length - 1) {
          set({ currentStep: STEP_ORDER[currentIndex + 1] });
        }
      },

      prevStep: () => {
        const currentIndex = STEP_ORDER.indexOf(get().currentStep);
        if (currentIndex > 0) {
          set({ currentStep: STEP_ORDER[currentIndex - 1] });
        }
      },

      // Step 1: Dimension setters
      setEmploymentTypes: (types) =>
        set((state) => ({
          dimensions: { ...state.dimensions, employmentTypes: types }
        })),

      setPayMethods: (methods) =>
        set((state) => ({
          dimensions: { ...state.dimensions, payMethods: methods }
        })),

      setHasBothFlsaTypes: (value) =>
        set((state) => ({
          dimensions: { ...state.dimensions, hasBothFlsaTypes: value }
        })),

      setHasUnionEmployees: (value) =>
        set((state) => ({
          dimensions: { ...state.dimensions, hasUnionEmployees: value }
        })),

      // Generation
      generateFromDimensions: () => {
        const { groups, subgroups, combinations } = generateGroupsAndSubgroups(get().dimensions);
        set({
          employeeGroups: groups,
          employeeSubgroups: subgroups,
          validCombinations: combinations,
        });
      },

      // Step 2: Employee Groups
      setEmployeeGroups: (groups) => set({ employeeGroups: groups }),

      addEmployeeGroup: (group) =>
        set((state) => ({
          employeeGroups: [...state.employeeGroups, group]
        })),

      updateEmployeeGroup: (index, group) =>
        set((state) => {
          const newGroups = [...state.employeeGroups];
          newGroups[index] = { ...newGroups[index], ...group };
          return { employeeGroups: newGroups };
        }),

      removeEmployeeGroup: (index) =>
        set((state) => {
          const removedCode = state.employeeGroups[index]?.code;
          return {
            employeeGroups: state.employeeGroups.filter((_, i) => i !== index),
            // Also remove combinations for this group
            validCombinations: state.validCombinations.filter(c => c.egCode !== removedCode),
          };
        }),

      // Step 3: Employee Subgroups
      setEmployeeSubgroups: (subgroups) => set({ employeeSubgroups: subgroups }),

      addEmployeeSubgroup: (subgroup) =>
        set((state) => ({
          employeeSubgroups: [...state.employeeSubgroups, subgroup]
        })),

      updateEmployeeSubgroup: (index, subgroup) =>
        set((state) => {
          const newSubgroups = [...state.employeeSubgroups];
          newSubgroups[index] = { ...newSubgroups[index], ...subgroup };
          return { employeeSubgroups: newSubgroups };
        }),

      removeEmployeeSubgroup: (index) =>
        set((state) => {
          const removedCode = state.employeeSubgroups[index]?.code;
          return {
            employeeSubgroups: state.employeeSubgroups.filter((_, i) => i !== index),
            // Also remove combinations for this subgroup
            validCombinations: state.validCombinations.filter(c => c.esgCode !== removedCode),
          };
        }),

      // Step 4: Combinations
      setValidCombinations: (combinations) => set({ validCombinations: combinations }),

      toggleCombination: (egCode, esgCode) =>
        set((state) => {
          const exists = state.validCombinations.some(
            c => c.egCode === egCode && c.esgCode === esgCode
          );
          if (exists) {
            return {
              validCombinations: state.validCombinations.filter(
                c => !(c.egCode === egCode && c.esgCode === esgCode)
              ),
            };
          } else {
            return {
              validCombinations: [...state.validCombinations, { egCode, esgCode }],
            };
          }
        }),

      selectAllForGroup: (egCode) =>
        set((state) => {
          const existingEsgCodes = new Set(
            state.validCombinations
              .filter(c => c.egCode === egCode)
              .map(c => c.esgCode)
          );
          const newCombinations = [...state.validCombinations];
          for (const esg of state.employeeSubgroups) {
            if (!existingEsgCodes.has(esg.code)) {
              newCombinations.push({ egCode, esgCode: esg.code });
            }
          }
          return { validCombinations: newCombinations };
        }),

      clearAllForGroup: (egCode) =>
        set((state) => ({
          validCombinations: state.validCombinations.filter(c => c.egCode !== egCode),
        })),

      // Utility
      isCombinationValid: (egCode, esgCode) => {
        return get().validCombinations.some(
          c => c.egCode === egCode && c.esgCode === esgCode
        );
      },

      getValidSubgroupsForGroup: (egCode) => {
        const validEsgCodes = new Set(
          get().validCombinations
            .filter(c => c.egCode === egCode)
            .map(c => c.esgCode)
        );
        return get().employeeSubgroups.filter(esg => validEsgCodes.has(esg.code));
      },

      // Reset
      reset: () => set({
        currentStep: 'dimensions',
        dimensions: initialDimensions,
        employeeGroups: [],
        employeeSubgroups: [],
        validCombinations: [],
      }),

      // Export
      generateCSV: () => {
        const state = get();
        const lines: string[] = ['Employee_Group,EG_Description,Employee_Subgroup,ESG_Description'];

        // Sort combinations for consistent output
        const sortedCombinations = [...state.validCombinations].sort((a, b) => {
          if (a.egCode !== b.egCode) return a.egCode.localeCompare(b.egCode);
          return a.esgCode.localeCompare(b.esgCode);
        });

        for (const combo of sortedCombinations) {
          const eg = state.employeeGroups.find(g => g.code === combo.egCode);
          const esg = state.employeeSubgroups.find(s => s.code === combo.esgCode);
          if (eg && esg) {
            lines.push(`${eg.code},${eg.description},${esg.code},${esg.description}`);
          }
        }

        return lines.join('\n');
      },
    }),
    {
      name: 'turbosap-employee-group',
      partialize: (state) => ({
        currentStep: state.currentStep,
        dimensions: state.dimensions,
        employeeGroups: state.employeeGroups,
        employeeSubgroups: state.employeeSubgroups,
        validCombinations: state.validCombinations,
      }),
    }
  )
);
