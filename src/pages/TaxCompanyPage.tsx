import { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuthStore } from '../store/auth';
import { useConfigStore } from '../store';
import type { TaxCompany } from '../types';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

const STORAGE_KEY_PREFIX = 'turbosap.tax_company.draft.v1';

function getStorageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}.${userId}`;
}

function loadDraft(userId: string): TaxCompany[] {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDraft(userId: string, data: TaxCompany[]) {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(data));
}

export function TaxCompanyPage() {
  const { user } = useAuthStore();
  const userId = user?.userId ? String(user.userId) : 'anonymous';
  const notifyTaxCompanyChanged = useConfigStore((s: any) => s.notifyTaxCompanyChanged);

  const [rows, setRows] = useState<TaxCompany[]>([]);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [, setHasChanges] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loaded = loadDraft(userId);
    setRows(loaded);
  }, [userId]);

  const triggerSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('saving');
    setHasChanges(true);

    saveTimeoutRef.current = setTimeout(() => {
      saveDraft(userId, rows);
      if (notifyTaxCompanyChanged) {
        notifyTaxCompanyChanged();
      }
      setSaveStatus('saved');
      setHasChanges(false);

      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 800);
  }, [userId, rows, notifyTaxCompanyChanged]);

  useEffect(() => {
    triggerSave();
  }, [rows, triggerSave]);

  const handleAddRow = () => {
    setRows((prev) => {
      const maxCode = prev.reduce((max, row) => Math.max(max, row.code), 0);
      const nextCode = maxCode === 0 ? 1000 : maxCode + 1000;
      return [...prev, { code: nextCode, name: '', address: '' }];
    });
  };

  const handleDeleteRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCellChange = (rowIndex: number, field: keyof Omit<TaxCompany, 'code'>, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[rowIndex], [field]: value } as TaxCompany;
      next[rowIndex] = row;
      return next;
    });
  };

  return (
    <DashboardLayout
      title="Tax Companies"
      description="Maintain tax company names and addresses for export to SAP"
      currentPath="/tax-company"
    >
      <div className="flex flex-col h-[calc(100vh-140px)]">
        <div className="shrink-0 flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleAddRow}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Tax Company
            </button>
            <span className="text-sm text-muted-foreground">
              {rows.length} tax company{rows.length !== 1 ? ' records' : ' record'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            {saveStatus === 'saving' && (
              <>
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-muted-foreground">Saving...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <span className="text-success">Saved</span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-card border border-border rounded-lg">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#4a5568] text-white">
                <th className="px-3 py-2 text-left font-medium w-24 border-r border-gray-600">Tax Company Code</th>
                <th className="px-3 py-2 text-left font-medium border-r border-gray-600">Tax Company Name (max 40)</th>
                <th className="px-3 py-2 text-left font-medium border-r border-gray-600">Address</th>
                <th className="px-3 py-2 text-center font-medium w-10" />
              </tr>
              <tr className="bg-[#5a6778] text-gray-300 text-xs">
                <th className="px-3 py-1 text-left border-r border-gray-600">Auto-generated</th>
                <th className="px-3 py-1 text-left border-r border-gray-600">Required</th>
                <th className="px-3 py-1 text-left border-r border-gray-600">Required</th>
                <th className="px-3 py-1" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.code}
                  className={cn(
                    'border-b border-border hover:bg-secondary/50 transition-colors',
                    index % 2 === 0 ? 'bg-card' : 'bg-secondary/20'
                  )}
                >
                  <td className="px-3 py-1 border-r border-border text-muted-foreground font-mono text-xs">
                    {row.code}
                  </td>
                  <td
                    className="px-3 py-1 border-r border-border cursor-text"
                    onClick={() => setEditingRow(index)}
                  >
                    {editingRow === index ? (
                      <input
                        type="text"
                        value={row.name}
                        maxLength={40}
                        onChange={(e) => handleCellChange(index, 'name', e.target.value)}
                        onBlur={() => setEditingRow(null)}
                        className="w-full px-2 py-1 border border-primary rounded bg-card text-foreground outline-none text-sm"
                        placeholder="Tax company legal name"
                        autoFocus
                      />
                    ) : (
                      <div
                        className={cn(
                          'px-2 py-1 min-h-[28px] rounded',
                          !row.name && 'text-muted-foreground/50'
                        )}
                      >
                        {row.name || 'Enter tax company name'}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-1 border-r border-border">
                    <textarea
                      value={row.address}
                      onChange={(e) => handleCellChange(index, 'address', e.target.value)}
                      className="w-full px-2 py-1 border border-input rounded bg-card text-foreground outline-none text-sm resize-y min-h-[32px]"
                      placeholder="Street, City, State, Zip, Country"
                    />
                  </td>
                  <td className="px-2 py-1 text-center">
                    <button
                      onClick={() => handleDeleteRow(index)}
                      className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                      title="Delete row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-12 text-center text-muted-foreground"
                  >
                    No tax companies configured. Click "Add Tax Company" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="shrink-0 mt-3 text-xs text-muted-foreground">
          Tax company code starts at 1000 and increments by 1000 for each new entry. Name is limited to 40 characters.
        </div>
      </div>
    </DashboardLayout>
  );
}
