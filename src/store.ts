import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  CompanyProfile,
  PayrollArea,
  ValidationResult,
  PayFrequency,
  BusinessUnit,
  Union,
  TimeZone,
} from './types';
import {
  calculateMinimalAreas,
  validateConfiguration,
  generateSAPCalendars,
  generateSAPAreas,
} from './payrollLogic';

interface ConfigurationStore {
  // Company profile data
  profile: CompanyProfile;

  // Generated payroll areas
  payrollAreas: PayrollArea[];

  // Validation results
  validation: ValidationResult;

  // Payment data sync - incremented when payment localStorage changes
  // Used to trigger re-renders in useExportData since localStorage isn't reactive
  paymentDataVersion: number;
  notifyPaymentDataChanged: () => void;

  // Company code data sync - incremented when company code localStorage changes
  companyCodeVersion: number;
  notifyCompanyCodeChanged: () => void;

  // Tax company data sync - incremented when tax company localStorage changes
  taxCompanyVersion: number;
  notifyTaxCompanyChanged: () => void;

  // Actions
  updateCompanyName: (name: string) => void;
  updateTotalEmployees: (count: number) => void;
  addPayFrequency: (freq: PayFrequency) => void;
  updatePayFrequency: (index: number, freq: Partial<PayFrequency>) => void;
  removePayFrequency: (index: number) => void;
  addBusinessUnit: (bu: BusinessUnit) => void;
  updateBusinessUnit: (index: number, bu: Partial<BusinessUnit>) => void;
  removeBusinessUnit: (index: number) => void;
  addUnion: (union: Union) => void;
  updateUnion: (index: number, union: Partial<Union>) => void;
  removeUnion: (index: number) => void;
  addTimeZone: (tz: TimeZone) => void;
  updateTimeZone: (index: number, tz: Partial<TimeZone>) => void;
  removeTimeZone: (index: number) => void;
  toggleSecuritySplitting: () => void;

  // Recalculate payroll areas based on current profile
  recalculate: () => void;

  // Direct payroll area management
  updatePayrollArea: (index: number, area: Partial<PayrollArea>) => void;
  setPayrollAreas: (areas: PayrollArea[]) => void;

  // Reset to initial state
  reset: () => void;

  // Export configuration
  exportJSON: () => string;
}

// Initial template data for new company configuration
// Start with sample data to demonstrate the tool
const initialProfile: CompanyProfile = {
  companyId: 'new-company',
  companyName: 'New Company Configuration',
  totalEmployees: 0,
  payFrequencies: [
    // Start with one example - users can edit/remove/add more
    {
      type: 'weekly',
      employeeCount: 0,
      calendarPattern: 'mon-sun',
      payDay: 'friday',
    },
  ],
  businessUnits: [
    {
      code: 'all',
      name: 'All Business Units',
      employeeCount: 0,
      requiresSeparateArea: false,
    },
  ],
  timeZones: [
    {
      code: 'ML',
      name: 'Mainland',
      employeeCount: 0,
      affectsProcessing: false,
    },
  ],
  unions: [],
  securitySplitting: false,
};

export const useConfigStore = create<ConfigurationStore>()(
  persist(
    (set, get) => ({
      profile: initialProfile,
      // Start with empty payrollAreas - they get populated when user completes the chat flow
      // This ensures sidebar shows "not started" initially instead of "incomplete" with template data
      payrollAreas: [],
      validation: {
        isValid: false,
        employeesCovered: 0,
        totalEmployees: 0,
        warnings: [],
        errors: [],
      },

      // Payment data sync
      paymentDataVersion: 0,
      notifyPaymentDataChanged: () => set((state) => ({
        paymentDataVersion: state.paymentDataVersion + 1
      })),

      // Company code data sync
      companyCodeVersion: 0,
      notifyCompanyCodeChanged: () => set((state) => ({
        companyCodeVersion: state.companyCodeVersion + 1
      })),
     
      // Tax company data sync
      taxCompanyVersion: 0,
      notifyTaxCompanyChanged: () => set((state) => ({
        taxCompanyVersion: (state as any).taxCompanyVersion + 1
      })),

      updateCompanyName: (name) =>
      set((state) => {
        const newProfile = { ...state.profile, companyName: name };
        return { profile: newProfile };
      }),

      updateTotalEmployees: (count) =>
        set((state) => {
          const newProfile = { ...state.profile, totalEmployees: count };
          const newAreas = calculateMinimalAreas(newProfile);
          const newValidation = validateConfiguration(newProfile, newAreas);
          return { profile: newProfile, payrollAreas: newAreas, validation: newValidation };
        }),

  addPayFrequency: (freq) =>
    set((state) => {
      const newProfile = {
        ...state.profile,
        payFrequencies: [...state.profile.payFrequencies, freq],
      };
      const newAreas = calculateMinimalAreas(newProfile);
      const newValidation = validateConfiguration(newProfile, newAreas);
      return { profile: newProfile, payrollAreas: newAreas, validation: newValidation };
    }),

  updatePayFrequency: (index, freq) =>
    set((state) => {
      const newFrequencies = [...state.profile.payFrequencies];
      newFrequencies[index] = { ...newFrequencies[index], ...freq };
      const newProfile = { ...state.profile, payFrequencies: newFrequencies };
      const newAreas = calculateMinimalAreas(newProfile);
      const newValidation = validateConfiguration(newProfile, newAreas);
      return { profile: newProfile, payrollAreas: newAreas, validation: newValidation };
    }),

  removePayFrequency: (index) =>
    set((state) => {
      const newFrequencies = state.profile.payFrequencies.filter((_, i) => i !== index);
      const newProfile = { ...state.profile, payFrequencies: newFrequencies };
      const newAreas = calculateMinimalAreas(newProfile);
      const newValidation = validateConfiguration(newProfile, newAreas);
      return { profile: newProfile, payrollAreas: newAreas, validation: newValidation };
    }),

  addBusinessUnit: (bu) =>
    set((state) => {
      const newProfile = {
        ...state.profile,
        businessUnits: [...state.profile.businessUnits, bu],
      };
      const newAreas = calculateMinimalAreas(newProfile);
      const newValidation = validateConfiguration(newProfile, newAreas);
      return { profile: newProfile, payrollAreas: newAreas, validation: newValidation };
    }),

  updateBusinessUnit: (index, bu) =>
    set((state) => {
      const newUnits = [...state.profile.businessUnits];
      newUnits[index] = { ...newUnits[index], ...bu };
      const newProfile = { ...state.profile, businessUnits: newUnits };
      const newAreas = calculateMinimalAreas(newProfile);
      const newValidation = validateConfiguration(newProfile, newAreas);
      return { profile: newProfile, payrollAreas: newAreas, validation: newValidation };
    }),

  removeBusinessUnit: (index) =>
    set((state) => {
      const newUnits = state.profile.businessUnits.filter((_, i) => i !== index);
      const newProfile = { ...state.profile, businessUnits: newUnits };
      const newAreas = calculateMinimalAreas(newProfile);
      const newValidation = validateConfiguration(newProfile, newAreas);
      return { profile: newProfile, payrollAreas: newAreas, validation: newValidation };
    }),

  addUnion: (union) =>
    set((state) => {
      const newProfile = {
        ...state.profile,
        unions: [...state.profile.unions, union],
      };
      const newAreas = calculateMinimalAreas(newProfile);
      const newValidation = validateConfiguration(newProfile, newAreas);
      return { profile: newProfile, payrollAreas: newAreas, validation: newValidation };
    }),

  updateUnion: (index, union) =>
    set((state) => {
      const newUnions = [...state.profile.unions];
      newUnions[index] = { ...newUnions[index], ...union };
      const newProfile = { ...state.profile, unions: newUnions };
      const newAreas = calculateMinimalAreas(newProfile);
      const newValidation = validateConfiguration(newProfile, newAreas);
      return { profile: newProfile, payrollAreas: newAreas, validation: newValidation };
    }),

  removeUnion: (index) =>
    set((state) => {
      const newUnions = state.profile.unions.filter((_, i) => i !== index);
      const newProfile = { ...state.profile, unions: newUnions };
      const newAreas = calculateMinimalAreas(newProfile);
      const newValidation = validateConfiguration(newProfile, newAreas);
      return { profile: newProfile, payrollAreas: newAreas, validation: newValidation };
    }),

  addTimeZone: (tz) =>
    set((state) => {
      const newProfile = {
        ...state.profile,
        timeZones: [...state.profile.timeZones, tz],
      };
      const newAreas = calculateMinimalAreas(newProfile);
      const newValidation = validateConfiguration(newProfile, newAreas);
      return { profile: newProfile, payrollAreas: newAreas, validation: newValidation };
    }),

  updateTimeZone: (index, tz) =>
    set((state) => {
      const newTimeZones = [...state.profile.timeZones];
      newTimeZones[index] = { ...newTimeZones[index], ...tz };
      const newProfile = { ...state.profile, timeZones: newTimeZones };
      const newAreas = calculateMinimalAreas(newProfile);
      const newValidation = validateConfiguration(newProfile, newAreas);
      return { profile: newProfile, payrollAreas: newAreas, validation: newValidation };
    }),

  removeTimeZone: (index) =>
    set((state) => {
      const newTimeZones = state.profile.timeZones.filter((_, i) => i !== index);
      const newProfile = { ...state.profile, timeZones: newTimeZones };
      const newAreas = calculateMinimalAreas(newProfile);
      const newValidation = validateConfiguration(newProfile, newAreas);
      return { profile: newProfile, payrollAreas: newAreas, validation: newValidation };
    }),

  toggleSecuritySplitting: () =>
    set((state) => {
      const newProfile = {
        ...state.profile,
        securitySplitting: !state.profile.securitySplitting,
      };
      const newAreas = calculateMinimalAreas(newProfile);
      const newValidation = validateConfiguration(newProfile, newAreas);
      return { profile: newProfile, payrollAreas: newAreas, validation: newValidation };
    }),

  recalculate: () =>
    set((state) => {
      const newAreas = calculateMinimalAreas(state.profile);
      const newValidation = validateConfiguration(state.profile, newAreas);
      return { payrollAreas: newAreas, validation: newValidation };
    }),

  updatePayrollArea: (index, area) =>
    set((state) => {
      const newAreas = [...state.payrollAreas];
      newAreas[index] = { ...newAreas[index], ...area };
      const newValidation = validateConfiguration(state.profile, newAreas);
      return { payrollAreas: newAreas, validation: newValidation };
    }),

  setPayrollAreas: (areas) =>
    set((state) => {
      const newValidation = validateConfiguration(state.profile, areas);
      return { payrollAreas: areas, validation: newValidation };
    }),

  reset: () => {
    // Reset to empty state, not pre-calculated areas
    // This ensures sidebar shows "not started" after reset
    set({
      profile: initialProfile,
      payrollAreas: [],
      validation: {
        isValid: false,
        employeesCovered: 0,
        totalEmployees: 0,
        warnings: [],
        errors: [],
      },
    });
  },

  exportJSON: () => {
    const state = get();
    const config = {
      profile: state.profile,
      payrollAreas: state.payrollAreas,
      sapTables: {
        T549Q: generateSAPCalendars(state.payrollAreas),
        T549A: generateSAPAreas(state.payrollAreas),
      },
      validation: state.validation,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(config, null, 2);
  },
    }),
    {
      name: 'turbosap-config',
      // Only persist data, not actions
      partialize: (state) => ({
        profile: state.profile,
        payrollAreas: state.payrollAreas,
        validation: state.validation,
        paymentDataVersion: state.paymentDataVersion,
        companyCodeVersion: state.companyCodeVersion,
        taxCompanyVersion: (state as any).taxCompanyVersion ?? 0,
      }),
    }
  )
);
