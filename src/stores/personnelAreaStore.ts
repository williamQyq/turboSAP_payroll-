/**
 * Personnel Area / Subarea Store
 *
 * Zustand store for the PA/PSA configuration wizard.
 * Supports three paths: Simple, Regional, Import.
 * Persisted to localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// =============================================================================
// Types
// =============================================================================

export interface PersonnelArea {
  code: string;           // 4 chars (e.g., "1000", "1200", "CORP")
  description: string;    // max 30 chars
  companyCode: string;    // FK to existing Company Code
}

export interface PersonnelSubarea {
  code: string;           // 4 chars (e.g., "9999", "PHX1", "WATR")
  description: string;    // max 15 chars
  personnelAreaCode: string;  // FK to parent PA
}

export interface CompanyCodeOption {
  code: string;
  name: string;
}

export interface ColumnMapping {
  paName: string;
  paCode: string | null;
  psaName: string;
  psaCode: string | null;
}

export type ComplexityType = 'simple' | 'regional' | 'import' | null;

export type WizardStep =
  | 'complexity'
  | 'simple-form'
  | 'areas'
  | 'subareas'
  | 'company-codes'
  | 'import-upload'
  | 'import-mapping'
  | 'import-preview'
  | 'review';

// =============================================================================
// Store Interface
// =============================================================================

interface PersonnelAreaStore {
  // Current wizard step
  currentStep: WizardStep;

  // Step 1 choice
  complexity: ComplexityType;

  // Main data
  personnelAreas: PersonnelArea[];
  personnelSubareas: PersonnelSubarea[];

  // For import flow
  importedRows: Record<string, string>[] | null;
  importedColumns: string[];
  columnMapping: ColumnMapping | null;

  // Available company codes (loaded from existing config)
  availableCompanyCodes: CompanyCodeOption[];

  // Navigation
  setStep: (step: WizardStep) => void;
  setComplexity: (complexity: ComplexityType) => void;

  // Company Codes
  loadCompanyCodes: () => void;

  // Simple path
  createSimpleSetup: (paDescription: string, companyCode: string) => void;

  // Personnel Areas (Regional path)
  addPersonnelArea: (area?: Partial<PersonnelArea>) => void;
  updatePersonnelArea: (code: string, updates: Partial<PersonnelArea>) => void;
  removePersonnelArea: (code: string) => void;

  // Personnel Subareas
  addPersonnelSubarea: (personnelAreaCode: string, subarea?: Partial<PersonnelSubarea>) => void;
  updatePersonnelSubarea: (paCode: string, psaCode: string, updates: Partial<PersonnelSubarea>) => void;
  removePersonnelSubarea: (paCode: string, psaCode: string) => void;
  getSubareasForArea: (paCode: string) => PersonnelSubarea[];

  // Import flow
  setImportedData: (rows: Record<string, string>[], columns: string[]) => void;
  setColumnMapping: (mapping: ColumnMapping) => void;
  processImportedData: () => void;
  clearImport: () => void;

  // Bulk company code assignment
  assignCompanyCodeToAll: (companyCode: string) => void;

  // Utility
  generateNextPACode: () => string;
  generatePSACode: (name: string, existingCodes: string[]) => string;

  // Validation
  canProceedFromAreas: () => boolean;
  canProceedFromSubareas: () => boolean;

  // Reset
  reset: () => void;

  // Export
  generateCSV: () => string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function loadCompanyCodesFromStorage(): CompanyCodeOption[] {
  try {
    // Try to find company codes in localStorage
    // They're stored per-user, so we need to find the right key
    const keys = Object.keys(localStorage);
    const ccKey = keys.find(k => k.startsWith('turbosap.company_code.draft.v1.'));

    if (ccKey) {
      const data = JSON.parse(localStorage.getItem(ccKey) || '[]');
      return data
        .filter((cc: any) => cc.companyCode && cc.companyName)
        .map((cc: any) => ({
          code: cc.companyCode,
          name: cc.companyName,
        }));
    }
  } catch (e) {
    console.error('Failed to load company codes:', e);
  }
  return [];
}

function generatePACode(existingCodes: string[]): string {
  let code = 1000;
  const existing = new Set(existingCodes);
  while (existing.has(code.toString().padStart(4, '0'))) {
    code += 100;
  }
  return code.toString().padStart(4, '0');
}

function generatePSACodeFromName(name: string, existingCodes: string[]): string {
  // First 4 chars, uppercase, alphanumeric only
  let base = name
    .substring(0, 4)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .padEnd(4, '0');

  if (!existingCodes.includes(base)) {
    return base;
  }

  // If exists, try adding numbers
  for (let i = 1; i <= 99; i++) {
    const candidate = base.substring(0, 3) + i.toString();
    if (!existingCodes.includes(candidate)) {
      return candidate.substring(0, 4);
    }
  }

  return base; // Fallback
}

// =============================================================================
// Store
// =============================================================================

export const usePersonnelAreaStore = create<PersonnelAreaStore>()(
  persist(
    (set, get) => ({
      currentStep: 'complexity',
      complexity: null,
      personnelAreas: [],
      personnelSubareas: [],
      importedRows: null,
      importedColumns: [],
      columnMapping: null,
      availableCompanyCodes: [],

      // Navigation
      setStep: (step) => set({ currentStep: step }),

      setComplexity: (complexity) => {
        set({ complexity });
        // Navigate to appropriate next step
        if (complexity === 'simple') {
          set({ currentStep: 'simple-form' });
        } else if (complexity === 'regional') {
          // Initialize with one empty PA
          const code = generatePACode([]);
          set({
            currentStep: 'areas',
            personnelAreas: [{ code, description: '', companyCode: '' }],
            personnelSubareas: [{ code: '9999', description: 'General Subarea', personnelAreaCode: code }],
          });
        } else if (complexity === 'import') {
          set({ currentStep: 'import-upload' });
        }
      },

      // Company Codes
      loadCompanyCodes: () => {
        const codes = loadCompanyCodesFromStorage();
        set({ availableCompanyCodes: codes });
      },

      // Simple path
      createSimpleSetup: (paDescription, companyCode) => {
        set({
          personnelAreas: [{
            code: '1000',
            description: paDescription,
            companyCode,
          }],
          personnelSubareas: [{
            code: '9999',
            description: 'General Subarea',
            personnelAreaCode: '1000',
          }],
          currentStep: 'review',
        });
      },

      // Personnel Areas
      addPersonnelArea: (area) => {
        const state = get();
        const existingCodes = state.personnelAreas.map(pa => pa.code);
        const newCode = area?.code || generatePACode(existingCodes);

        const newPA: PersonnelArea = {
          code: newCode,
          description: area?.description || '',
          companyCode: area?.companyCode || '',
        };

        // Also add a default subarea
        const newPSA: PersonnelSubarea = {
          code: '9999',
          description: 'General Subarea',
          personnelAreaCode: newCode,
        };

        set({
          personnelAreas: [...state.personnelAreas, newPA],
          personnelSubareas: [...state.personnelSubareas, newPSA],
        });
      },

      updatePersonnelArea: (code, updates) => {
        set((state) => {
          const newAreas = state.personnelAreas.map(pa => {
            if (pa.code === code) {
              const updated = { ...pa, ...updates };
              // If code changed, update all subareas too
              if (updates.code && updates.code !== code) {
                set((s) => ({
                  personnelSubareas: s.personnelSubareas.map(psa =>
                    psa.personnelAreaCode === code
                      ? { ...psa, personnelAreaCode: updates.code! }
                      : psa
                  ),
                }));
              }
              return updated;
            }
            return pa;
          });
          return { personnelAreas: newAreas };
        });
      },

      removePersonnelArea: (code) => {
        set((state) => ({
          personnelAreas: state.personnelAreas.filter(pa => pa.code !== code),
          personnelSubareas: state.personnelSubareas.filter(psa => psa.personnelAreaCode !== code),
        }));
      },

      // Personnel Subareas
      addPersonnelSubarea: (personnelAreaCode, subarea) => {
        const state = get();
        const existingCodes = state.personnelSubareas
          .filter(psa => psa.personnelAreaCode === personnelAreaCode)
          .map(psa => psa.code);

        const newCode = subarea?.code || generatePSACodeFromName(subarea?.description || 'NEW', existingCodes);

        const newPSA: PersonnelSubarea = {
          code: newCode,
          description: subarea?.description || '',
          personnelAreaCode,
        };

        set({ personnelSubareas: [...state.personnelSubareas, newPSA] });
      },

      updatePersonnelSubarea: (paCode, psaCode, updates) => {
        set((state) => ({
          personnelSubareas: state.personnelSubareas.map(psa =>
            psa.personnelAreaCode === paCode && psa.code === psaCode
              ? { ...psa, ...updates }
              : psa
          ),
        }));
      },

      removePersonnelSubarea: (paCode, psaCode) => {
        set((state) => ({
          personnelSubareas: state.personnelSubareas.filter(
            psa => !(psa.personnelAreaCode === paCode && psa.code === psaCode)
          ),
        }));
      },

      getSubareasForArea: (paCode) => {
        return get().personnelSubareas.filter(psa => psa.personnelAreaCode === paCode);
      },

      // Import flow
      setImportedData: (rows, columns) => {
        set({
          importedRows: rows,
          importedColumns: columns,
          currentStep: 'import-mapping',
        });
      },

      setColumnMapping: (mapping) => {
        set({ columnMapping: mapping });
      },

      processImportedData: () => {
        const state = get();
        if (!state.importedRows || !state.columnMapping) return;

        const { paName, paCode, psaName, psaCode } = state.columnMapping;
        const hierarchy = new Map<string, { pa: PersonnelArea; psas: PersonnelSubarea[] }>();
        const usedPACodes = new Set<string>();

        for (const row of state.importedRows) {
          const paNameVal = row[paName] || '';
          if (!paNameVal) continue;

          let paCodeVal = paCode ? row[paCode] : null;
          if (!paCodeVal) {
            // Generate PA code
            paCodeVal = generatePACode(Array.from(usedPACodes));
          }
          paCodeVal = paCodeVal.substring(0, 4).toUpperCase();
          usedPACodes.add(paCodeVal);

          const psaNameVal = row[psaName] || 'General Subarea';
          let psaCodeVal = psaCode ? row[psaCode] : null;

          if (!hierarchy.has(paCodeVal)) {
            hierarchy.set(paCodeVal, {
              pa: { code: paCodeVal, description: paNameVal, companyCode: '' },
              psas: [],
            });
          }

          const entry = hierarchy.get(paCodeVal)!;
          const existingPSACodes = entry.psas.map(p => p.code);

          if (!psaCodeVal) {
            psaCodeVal = generatePSACodeFromName(psaNameVal, existingPSACodes);
          }
          psaCodeVal = psaCodeVal.substring(0, 4).toUpperCase();

          // Avoid duplicate subareas
          if (!existingPSACodes.includes(psaCodeVal)) {
            entry.psas.push({
              code: psaCodeVal,
              description: psaNameVal,
              personnelAreaCode: paCodeVal,
            });
          }
        }

        // Convert to arrays
        const personnelAreas: PersonnelArea[] = [];
        const personnelSubareas: PersonnelSubarea[] = [];

        hierarchy.forEach(({ pa, psas }) => {
          personnelAreas.push(pa);
          personnelSubareas.push(...psas);
        });

        set({
          personnelAreas,
          personnelSubareas,
          currentStep: 'import-preview',
        });
      },

      clearImport: () => {
        set({
          importedRows: null,
          importedColumns: [],
          columnMapping: null,
        });
      },

      // Bulk company code assignment
      assignCompanyCodeToAll: (companyCode) => {
        set((state) => ({
          personnelAreas: state.personnelAreas.map(pa => ({
            ...pa,
            companyCode,
          })),
        }));
      },

      // Utility
      generateNextPACode: () => {
        const state = get();
        return generatePACode(state.personnelAreas.map(pa => pa.code));
      },

      generatePSACode: (name, existingCodes) => {
        return generatePSACodeFromName(name, existingCodes);
      },

      // Validation
      canProceedFromAreas: () => {
        const state = get();
        return state.personnelAreas.length > 0 &&
          state.personnelAreas.every(pa => pa.code && pa.description);
      },

      canProceedFromSubareas: () => {
        const state = get();
        // Every PA must have at least one subarea with code and description
        return state.personnelAreas.every(pa => {
          const subareas = state.personnelSubareas.filter(psa => psa.personnelAreaCode === pa.code);
          return subareas.length > 0 && subareas.every(psa => psa.code && psa.description);
        });
      },

      // Reset
      reset: () => set({
        currentStep: 'complexity',
        complexity: null,
        personnelAreas: [],
        personnelSubareas: [],
        importedRows: null,
        importedColumns: [],
        columnMapping: null,
      }),

      // Export
      generateCSV: () => {
        const state = get();
        const lines: string[] = ['Personnel_Area,PA_Description,Personnel_Subarea,PSA_Description'];

        // Sort by PA code, then PSA code
        const sortedPAs = [...state.personnelAreas].sort((a, b) => a.code.localeCompare(b.code));

        for (const pa of sortedPAs) {
          const psas = state.personnelSubareas
            .filter(psa => psa.personnelAreaCode === pa.code)
            .sort((a, b) => a.code.localeCompare(b.code));

          for (const psa of psas) {
            lines.push(`${pa.code},${pa.description},${psa.code},${psa.description}`);
          }
        }

        return lines.join('\n');
      },
    }),
    {
      name: 'turbosap-personnel-area',
      partialize: (state) => ({
        currentStep: state.currentStep,
        complexity: state.complexity,
        personnelAreas: state.personnelAreas,
        personnelSubareas: state.personnelSubareas,
        columnMapping: state.columnMapping,
      }),
    }
  )
);
