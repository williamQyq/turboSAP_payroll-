/**
 * Export Center Page
 * Unified export interface for all SAP configuration files
 * Directory tree + preview panel layout
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useExportData } from '../hooks/useExportData';
import type { PayrollArea } from '../types';
import {
  FolderOpen,
  Folder,
  FileText,
  Download,
  Archive,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Save,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  generatePayrollAreasCSV,
  generateCalendarIdCSV,
  generatePayrollAreaConfigCSV,
  generatePayrollPeriodCSV,
  generatePayDateCSV,
  generatePaymentMethodCSV,
  generateCheckRangeCSV,
  generatePreNotificationCSV,
  generateCompanyCodeCSV,
  generateTaxCompanyCSV,
} from '../utils/fileGenerators';
import { downloadCSV, downloadAsZip } from '../utils/exportUtils';
import {
  listAllOutputs,
  getPersistedOutput,
  type ModuleOutputs,
} from '../api/modules';

// ============================================
// Types
// ============================================

interface FileNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  module: 'payroll' | 'payment' | 'company-code' | 'config';
  children?: FileNode[];
  generator?: string; // Key into FILE_GENERATORS
  disabled?: boolean;
  rowCount?: number;
  // For config module files
  configModuleSlug?: string;
  configSessionId?: string;
}

interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

// ============================================
// Header-only CSVs (for empty state preview)
// ============================================

const EMPTY_CSVS: Record<string, string> = {
  'payroll-areas': 'Code,Description,Frequency,Period Pattern,Pay Day,Calendar ID,Employee Count,Business Unit,Region',
  'calendar-id': 'period_parameters,period_parameter_name,time_unit,time_unit_desc,start_date',
  'payroll-area-config': 'payroll_area,payroll_area_text,period_parameters,run_payroll,date_modifier',
  'pay-period': 'period_parameters,payroll_year,payroll_period,period_begin_date,period_end_date,prior_period_year,prior_period_period',
  'pay-date': 'molga,date_modifier,period_parameters,payroll_year,payroll_period,date_type,date',
  'payment-method': 'Payment_Method,Description,Used',
  'check-range': 'Company_Code,Bank_Account,Check_Number_Range',
  'pre-notification': 'Pre_Notification_Required',
  'company-code': 'Company_Code,Company_Name,Short_Name,Currency,Language,Street,City,State,Zip_Code,Country,PO_Box,Chart_of_Accounts,Fiscal_Year_Variant,VAT_Registration_Number,Credit_Control_Area,Tax_Jurisdiction_Code',
  'tax-company': 'Tax_Company_Code,Tax_Company_Name,Address',
};

// ============================================
// CSV Parsing/Serialization
// ============================================

function parseCSV(content: string): ParsedCSV {
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);

  return { headers, rows };
}

function serializeCSV(data: ParsedCSV): string {
  const escapeCell = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const headerLine = data.headers.map(escapeCell).join(',');
  const dataLines = data.rows.map((row) => row.map(escapeCell).join(','));

  return [headerLine, ...dataLines].join('\n');
}

// ============================================
// Components
// ============================================

function StatusBadge({ status }: { status: 'complete' | 'not-started' }) {
  const config = {
    complete: {
      icon: CheckCircle2,
      text: 'Ready',
      className: 'bg-success/10 text-success border-success/30',
    },
    'not-started': {
      icon: AlertCircle,
      text: 'Not Started',
      className: 'bg-secondary text-muted-foreground border-border',
    },
  };

  const { icon: Icon, text, className } = config[status];

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border', className)}>
      <Icon className="w-3 h-3" />
      {text}
    </span>
  );
}

interface FileTreeNodeProps {
  node: FileNode;
  level: number;
  expanded: Set<string>;
  selected: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}

function FileTreeNode({ node, level, expanded, selected, onToggle, onSelect }: FileTreeNodeProps) {
  const isExpanded = expanded.has(node.id);
  const isSelected = selected === node.id;
  const hasChildren = node.children && node.children.length > 0;
  const isDisabled = node.disabled;

  const handleClick = () => {
    if (node.type === 'folder' && hasChildren) {
      onToggle(node.id);
    } else if (node.type === 'file') {
      // Allow selection even when disabled - users can preview structure
      onSelect(node.id);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left rounded-md transition-colors',
          isSelected && 'bg-primary/10 text-primary',
          !isSelected && 'hover:bg-secondary',
          isDisabled && 'opacity-50'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {node.type === 'folder' ? (
          <>
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )
            ) : (
              <span className="w-4" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-amber-500" />
            ) : (
              <Folder className="w-4 h-4 text-amber-500" />
            )}
          </>
        ) : (
          <>
            <span className="w-4" />
            <FileText className="w-4 h-4 text-muted-foreground" />
          </>
        )}
        <span className={cn('flex-1 truncate', isDisabled && 'text-muted-foreground')}>
          {node.name}
        </span>
        {node.rowCount !== undefined && (
          <span className="text-xs text-muted-foreground">
            {node.rowCount} rows
          </span>
        )}
      </button>
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <FileTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expanded={expanded}
              selected={selected}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface PreviewPanelProps {
  fileId: string | null;
  content: string;
  onContentChange: (content: string) => void;
  onDownload: () => void;
  fileName: string;
  hasData: boolean;
}

function PreviewPanel({ fileId, content, onContentChange, onDownload, fileName, hasData }: PreviewPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<ParsedCSV | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);

  const parsedContent = useMemo(() => parseCSV(content), [content]);
  const isEmpty = parsedContent.rows.length === 0;

  const handleStartEdit = () => {
    setEditedData({ ...parsedContent, rows: parsedContent.rows.map((r) => [...r]) });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedData(null);
    setIsEditing(false);
    setEditingCell(null);
  };

  const handleSaveEdit = () => {
    if (editedData) {
      onContentChange(serializeCSV(editedData));
    }
    setIsEditing(false);
    setEditingCell(null);
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    if (!editedData) return;
    const newRows = [...editedData.rows];
    newRows[rowIndex] = [...newRows[rowIndex]];
    newRows[rowIndex][colIndex] = value;
    setEditedData({ ...editedData, rows: newRows });
  };

  const displayData = isEditing && editedData ? editedData : parsedContent;

  if (!fileId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-card rounded-lg border border-border">
        <div className="text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Select a file to preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-card rounded-lg border border-border overflow-hidden">
      {/* Preview Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border flex items-center justify-between bg-secondary/50">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm text-foreground">{fileName}</span>
          <span className="text-xs text-muted-foreground">({displayData.rows.length} rows)</span>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleStartEdit}
                disabled={isEmpty}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                  isEmpty
                    ? "text-muted-foreground/50 cursor-not-allowed"
                    : "text-muted-foreground hover:bg-secondary"
                )}
              >
                <Edit3 className="w-4 h-4" />
                Edit
              </button>
              <button
                type="button"
                onClick={onDownload}
                disabled={!hasData}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                  hasData
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </>
          )}
        </div>
      </div>

      {/* CSV Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-secondary">
            <tr>
              {displayData.headers.map((header, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-left font-medium text-foreground border-b border-border whitespace-nowrap"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isEmpty ? (
              <tr>
                <td
                  colSpan={displayData.headers.length}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No data configured yet. Complete the module configuration to populate this file.
                </td>
              </tr>
            ) : (
              displayData.rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b border-border hover:bg-secondary/50"
                >
                  {row.map((cell, colIndex) => (
                    <td
                      key={colIndex}
                      className="px-3 py-2 text-muted-foreground whitespace-nowrap"
                      onClick={() => isEditing && setEditingCell({ row: rowIndex, col: colIndex })}
                    >
                      {isEditing && editingCell?.row === rowIndex && editingCell?.col === colIndex ? (
                        <input
                          type="text"
                          value={cell}
                          onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                          onBlur={() => setEditingCell(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') setEditingCell(null);
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          autoFocus
                          className="w-full px-1 py-0.5 border border-primary rounded bg-card text-foreground outline-none"
                        />
                      ) : (
                        <span className={cn(isEditing && 'cursor-text hover:bg-primary/10 px-1 rounded')}>
                          {cell}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// Helpers
// ============================================

function findFileNode(nodes: FileNode[], id: string): FileNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findFileNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

// ============================================
// Main Component
// ============================================

export function ExportCenterPage() {
  const { payrollAreas, payrollStatus, paymentData, paymentStatus, companyCodes, companyCodeStatus, taxCompanies, taxCompanyStatus, publishToS3 } = useExportData();

  const [expanded, setExpanded] = useState<Set<string>>(new Set(['payroll', 'payment', 'company-code', 'config']));
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [editedContents, setEditedContents] = useState<Record<string, string>>({});
  const [isPublishing, setIsPublishing] = useState(false);

  // Config module outputs state
  const [configOutputs, setConfigOutputs] = useState<Record<string, ModuleOutputs>>({});
  const [configFileContents, setConfigFileContents] = useState<Record<string, string>>({});

  // Fetch config module outputs on mount
  useEffect(() => {
    async function fetchConfigOutputs() {
      try {
        const response = await listAllOutputs();
        setConfigOutputs(response.outputs);
      } catch (err) {
        console.error('Failed to load config module outputs:', err);
      }
    }
    fetchConfigOutputs();
  }, []);

  const handlePublish = async () => {
    // Determine the primary company for naming/pathing
    const primary = companyCodes.find(c => c.companyCode && c.companyName);

    if (!primary) {
      alert("Please complete at least one Company Code configuration before publishing.");
      return;
    }

    try {
      setIsPublishing(true);
      await publishToS3(primary.companyName, primary.companyCode);
      // You might want to use a toast notification here
      alert("Successfully published configuration to S3 for SAP retrieval!");
    } catch (err) {
      console.error(err);
      alert("Failed to publish to S3.");
    } finally {
      setIsPublishing(false);
    }
  };

  // Build file tree structure
  const fileTree = useMemo((): FileNode[] => {
    const payrollDisabled = payrollStatus.status === 'not-started';
    const paymentDisabled = paymentStatus.status === 'not-started';
    const companyCodeDisabled = companyCodeStatus.status === 'not-started';
    const taxCompanyDisabled = taxCompanyStatus.status === 'not-started';
    const validCompanyCodes = companyCodes.filter((c) => c.companyCode && c.companyName);

    // Get unique calendars and group areas by calendar
    const calendarMap = new Map<string, PayrollArea>();
    payrollAreas.forEach((area) => {
      const calId = area.calendarId || '80';
      if (!calendarMap.has(calId)) {
        calendarMap.set(calId, area);
      }
    });

    // Build Pay Periods folder with one file per calendar
    const payPeriodsChildren: FileNode[] = Array.from(calendarMap.entries()).map(([calId, _area]) => ({
      id: `pay-period-${calId}`,
      name: `pay_period_${calId}.csv`,
      type: 'file',
      module: 'payroll',
      generator: 'pay-period',
      disabled: payrollDisabled,
      rowCount: 52, // Approximate
    }));

    // Build Pay Dates folder with one file per calendar
    const payDatesChildren: FileNode[] = Array.from(calendarMap.entries()).map(([calId, _area]) => ({
      id: `pay-date-${calId}`,
      name: `pay_date_${calId}.csv`,
      type: 'file',
      module: 'payroll',
      generator: 'pay-date',
      disabled: payrollDisabled,
      rowCount: 52, // Approximate
    }));

    return [
      {
        id: 'payroll',
        name: 'Payroll Configuration',
        type: 'folder',
        module: 'payroll',
        disabled: payrollDisabled,
        children: [
          {
            id: 'payroll-areas',
            name: 'payroll_areas.csv',
            type: 'file',
            module: 'payroll',
            generator: 'payroll-areas',
            disabled: payrollDisabled,
            rowCount: payrollAreas.length,
          },
          {
            id: 'calendar-id',
            name: 'calendar_id.csv',
            type: 'file',
            module: 'payroll',
            generator: 'calendar-id',
            disabled: payrollDisabled,
            rowCount: calendarMap.size,
          },
          {
            id: 'payroll-area-config',
            name: 'payroll_area_config.csv',
            type: 'file',
            module: 'payroll',
            generator: 'payroll-area-config',
            disabled: payrollDisabled,
            rowCount: payrollAreas.length,
          },
          {
            id: 'pay-periods-folder',
            name: 'Pay Periods',
            type: 'folder',
            module: 'payroll',
            disabled: payrollDisabled,
            children: payPeriodsChildren,
          },
          {
            id: 'pay-dates-folder',
            name: 'Pay Dates',
            type: 'folder',
            module: 'payroll',
            disabled: payrollDisabled,
            children: payDatesChildren,
          },
        ],
      },
      {
        id: 'tax-company',
        name: 'Tax Company Configuration',
        type: 'folder',
        module: 'payroll',
        disabled: taxCompanyDisabled,
        children: [
          {
            id: 'tax-company-file',
            name: 'tax_company.csv',
            type: 'file',
            module: 'payroll',
            generator: 'tax-company',
            disabled: taxCompanyDisabled,
            rowCount: taxCompanies.length,
          },
        ],
      },
      {
        id: 'payment',
        name: 'Payment Configuration',
        type: 'folder',
        module: 'payment',
        disabled: paymentDisabled,
        children: [
          {
            id: 'payment-method',
            name: 'payment_method.csv',
            type: 'file',
            module: 'payment',
            generator: 'payment-method',
            disabled: paymentDisabled,
            rowCount: paymentData?.methods.length ?? 0,
          },
          {
            id: 'check-range',
            name: 'check_range.csv',
            type: 'file',
            module: 'payment',
            generator: 'check-range',
            disabled: paymentDisabled,
            rowCount: paymentData?.checkRanges.length ?? 0,
          },
          {
            id: 'pre-notification',
            name: 'pre_notification.csv',
            type: 'file',
            module: 'payment',
            generator: 'pre-notification',
            disabled: paymentDisabled,
            rowCount: 1,
          },
        ],
      },
      {
        id: 'company-code',
        name: 'Company Code Configuration',
        type: 'folder',
        module: 'company-code',
        disabled: companyCodeDisabled,
        children: [
          {
            id: 'company-code-file',
            name: 'company_code.csv',
            type: 'file',
            module: 'company-code',
            generator: 'company-code',
            disabled: companyCodeDisabled,
            rowCount: validCompanyCodes.length,
          },
        ],
      },
      // Config Modules - one folder per module, showing latest session's files
      ...(Object.keys(configOutputs).length > 0
        ? [
            {
              id: 'config',
              name: 'Config Modules',
              type: 'folder' as const,
              module: 'config' as const,
              children: Object.entries(configOutputs)
                .filter(([, moduleData]) => moduleData.sessions.length > 0)
                .map(([moduleSlug, moduleData]): FileNode => {
                  // Use the latest session (sessions are sorted by completedAt descending)
                  const latestSession = moduleData.sessions[0];

                  return {
                    id: `config-${moduleSlug}`,
                    name: moduleData.moduleName,
                    type: 'folder' as const,
                    module: 'config' as const,
                    children: latestSession.files.map((filename): FileNode => ({
                      id: `config-${moduleSlug}-${latestSession.sessionId}-${filename}`,
                      name: filename,
                      type: 'file' as const,
                      module: 'config' as const,
                      configModuleSlug: moduleSlug,
                      configSessionId: latestSession.sessionId,
                    })),
                  };
                }),
            },
          ]
        : []),
    ];
  }, [payrollAreas, payrollStatus, paymentData, paymentStatus, companyCodes, companyCodeStatus, taxCompanies, taxCompanyStatus, configOutputs]);

  // Fetch config file content when a config file is selected
  useEffect(() => {
    async function fetchConfigFileContent() {
      if (!selectedFile?.startsWith('config-')) return;

      // Check if already loaded
      if (configFileContents[selectedFile]) return;

      // Find the file node to get moduleSlug and sessionId
      const fileNode = findFileNode(fileTree, selectedFile);
      if (!fileNode || !fileNode.configModuleSlug || !fileNode.configSessionId) {
        console.error('Could not find file node for:', selectedFile);
        return;
      }

      const { configModuleSlug, configSessionId } = fileNode;
      const filename = fileNode.name;

      try {
        const output = await getPersistedOutput(configModuleSlug, configSessionId);
        if (output.files[filename]) {
          setConfigFileContents((prev) => ({
            ...prev,
            [selectedFile]: output.files[filename],
          }));
        }
      } catch (err) {
        console.error('Failed to load config file content:', err);
      }
    }
    fetchConfigFileContent();
  }, [selectedFile, configFileContents, fileTree]);

  // Generate file content
  const generateContent = useCallback(
    (fileId: string): string => {
      // Return edited content if available
      if (editedContents[fileId]) {
        return editedContents[fileId];
      }

      // Handle config module files - content is fetched async
      if (fileId.startsWith('config-')) {
        return configFileContents[fileId] || 'Loading...';
      }

      // Helper to return headers-only if no data
      const getEmptyOrGenerated = (hasData: boolean, generator: () => string, emptyKey?: string): string => {
        if (hasData) {
          return generator();
        }
        return EMPTY_CSVS[emptyKey || fileId] || '';
      };

      // Handle calendar-specific pay-period files
      if (fileId.startsWith('pay-period-')) {
        const calendarId = fileId.replace('pay-period-', '');
        const area = payrollAreas.find((a) => (a.calendarId || '80') === calendarId);
        return getEmptyOrGenerated(!!area, () => generatePayrollPeriodCSV(area!), 'pay-period');
      }

      // Handle calendar-specific pay-date files
      if (fileId.startsWith('pay-date-')) {
        const calendarId = fileId.replace('pay-date-', '');
        const area = payrollAreas.find((a) => (a.calendarId || '80') === calendarId);
        return getEmptyOrGenerated(!!area, () => generatePayDateCSV(area!), 'pay-date');
      }

      switch (fileId) {
        case 'payroll-areas':
          return getEmptyOrGenerated(payrollAreas.length > 0, () => generatePayrollAreasCSV(payrollAreas));
        case 'calendar-id':
          return getEmptyOrGenerated(payrollAreas.length > 0, () => generateCalendarIdCSV(payrollAreas));
        case 'payroll-area-config':
          return getEmptyOrGenerated(payrollAreas.length > 0, () => generatePayrollAreaConfigCSV(payrollAreas));
        case 'payment-method':
          return getEmptyOrGenerated(!!paymentData?.methods.length, () => generatePaymentMethodCSV(paymentData!.methods));
        case 'check-range':
          return getEmptyOrGenerated(!!paymentData?.checkRanges.length, () => generateCheckRangeCSV(paymentData!.checkRanges));
        case 'pre-notification':
          return getEmptyOrGenerated(!!paymentData, () => generatePreNotificationCSV(paymentData!.preNotificationRequired));
        case 'company-code-file':
          return getEmptyOrGenerated(companyCodes.length > 0, () => generateCompanyCodeCSV(companyCodes), 'company-code');
        case 'tax-company-file':
          return getEmptyOrGenerated(taxCompanies.length > 0, () => generateTaxCompanyCSV(taxCompanies), 'tax-company');
        default:
          return EMPTY_CSVS[fileId] || '';
      }
    },
    [payrollAreas, paymentData, companyCodes, taxCompanies, editedContents, configFileContents]
  );

  // Get file name from ID
  const getFileName = (fileId: string): string => {
    // Handle config module files: config-{moduleSlug}-{sessionId}-{filename}
    if (fileId.startsWith('config-')) {
      const parts = fileId.replace('config-', '').split('-');
      // Last part is the filename
      return parts[parts.length - 1];
    }

    // Handle calendar-specific files
    if (fileId.startsWith('pay-period-')) {
      const calendarId = fileId.replace('pay-period-', '');
      return `pay_period_${calendarId}.csv`;
    }
    if (fileId.startsWith('pay-date-')) {
      const calendarId = fileId.replace('pay-date-', '');
      return `pay_date_${calendarId}.csv`;
    }

    const fileMap: Record<string, string> = {
      'payroll-areas': 'payroll_areas.csv',
      'calendar-id': 'calendar_id.csv',
      'payroll-area-config': 'payroll_area_config.csv',
      'payment-method': 'payment_method.csv',
      'check-range': 'check_range.csv',
      'pre-notification': 'pre_notification.csv',
      'company-code-file': 'company_code.csv',
      'tax-company-file': 'tax_company.csv',
    };
    return fileMap[fileId] || `${fileId}.csv`;
  };

  const handleToggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelect = (id: string) => {
    setSelectedFile(id);
  };

  const handleContentChange = (content: string) => {
    if (selectedFile) {
      setEditedContents((prev) => ({ ...prev, [selectedFile]: content }));
    }
  };

  const handleDownloadSingle = () => {
    if (!selectedFile) return;
    const content = generateContent(selectedFile);
    downloadCSV(content, getFileName(selectedFile));
  };

  const handleDownloadAll = async () => {
    const files: { name: string; content: string }[] = [];

    // Collect all payroll files
    if (payrollStatus.status !== 'not-started') {
      files.push({ name: 'payroll_areas.csv', content: generateContent('payroll-areas') });
      files.push({ name: 'calendar_id.csv', content: generateContent('calendar-id') });
      files.push({ name: 'payroll_area_config.csv', content: generateContent('payroll-area-config') });

      // Get unique calendars
      const uniqueCalendars = new Set(payrollAreas.map((a) => a.calendarId || '80'));

      // Add pay period file for each calendar
      uniqueCalendars.forEach((calendarId) => {
        const fileId = `pay-period-${calendarId}`;
        files.push({ name: getFileName(fileId), content: generateContent(fileId) });
      });

      // Add pay date file for each calendar
      uniqueCalendars.forEach((calendarId) => {
        const fileId = `pay-date-${calendarId}`;
        files.push({ name: getFileName(fileId), content: generateContent(fileId) });
      });
    }

    // Collect all payment files
    if (paymentStatus.status !== 'not-started') {
      files.push({ name: 'payment_method.csv', content: generateContent('payment-method') });
      files.push({ name: 'check_range.csv', content: generateContent('check-range') });
      files.push({ name: 'pre_notification.csv', content: generateContent('pre-notification') });
    }

    // Collect company code files
    if (companyCodeStatus.status !== 'not-started') {
      files.push({ name: 'company_code.csv', content: generateContent('company-code-file') });
    }

    // Collect tax company files
    if (taxCompanyStatus.status !== 'not-started') {
      files.push({ name: 'tax_company.csv', content: generateContent('tax-company-file') });
    }

    if (files.length > 0) {
      await downloadAsZip(files, 'sap_configuration');
    }
  };

  const selectedContent = selectedFile ? generateContent(selectedFile) : '';

  return (
    <DashboardLayout title="Export Center" description="Preview, edit, and download SAP configuration files">
      <div className="flex flex-col h-[calc(100vh-64px)] p-6 gap-6">
        {/* Header Actions */}
        <div className="shrink-0 flex items-center justify-between bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-2">
           <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-600 rounded-lg">
               <Archive className="w-5 h-5 text-white" />
             </div>
             <div>
               <h3 className="text-sm font-semibold text-indigo-900">Publish Configuration</h3>
               <p className="text-xs text-indigo-700">Push the latest configuration to S3 for SAP API access.</p>
             </div>
        </div>

        <div className="flex items-center gap-3">
          <button
             type="button"
             onClick={handleDownloadAll}
             className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
          >
             <Download className="w-4 h-4" />
             Local ZIP
          </button>
    
            <button
             type="button"
             onClick={handlePublish}
             disabled={isPublishing || (payrollStatus.status === 'not-started' && paymentStatus.status === 'not-started')}
             className={cn(
                  "flex items-center gap-2 px-6 py-2 text-sm font-bold rounded-lg shadow-sm transition-all",
                  isPublishing 
                     ? "bg-gray-400 text-white cursor-not-allowed" 
                     : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
              )}
            >
              {isPublishing ? (
                <>
                     <span className="animate-spin mr-2">◌</span>
                     Publishing...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Publish to SAP
                </>
              )}
            </button>
        </div>
     </div>

        {/* Module Status Summary */}
        <div className="shrink-0 grid grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border">
            <div className="p-2 bg-secondary rounded-lg">
              <FolderOpen className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">Payroll Configuration</span>
                <StatusBadge status={payrollStatus.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {payrollStatus.itemCount} payroll area{payrollStatus.itemCount !== 1 ? 's' : ''} configured
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border">
            <div className="p-2 bg-secondary rounded-lg">
              <FolderOpen className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">Payment Configuration</span>
                <StatusBadge status={paymentStatus.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {paymentStatus.itemCount} payment method{paymentStatus.itemCount !== 1 ? 's' : ''} enabled
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border">
            <div className="p-2 bg-secondary rounded-lg">
              <FolderOpen className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">Company Codes</span>
                <StatusBadge status={companyCodeStatus.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {companyCodeStatus.itemCount} company code{companyCodeStatus.itemCount !== 1 ? 's' : ''} configured
              </p>
            </div>
          </div>
        </div>

        {/* Main Content: File Tree + Preview */}
        <div className="flex-1 min-h-0 flex gap-6">
          {/* File Tree */}
          <div className="w-80 shrink-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
            <div className="shrink-0 px-4 py-3 border-b border-border bg-secondary/50">
              <h2 className="font-medium text-sm text-foreground">Files</h2>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {fileTree.map((node) => (
                <FileTreeNode
                  key={node.id}
                  node={node}
                  level={0}
                  expanded={expanded}
                  selected={selectedFile}
                  onToggle={handleToggle}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </div>

          {/* Preview Panel */}
          <PreviewPanel
            fileId={selectedFile}
            content={selectedContent}
            onContentChange={handleContentChange}
            onDownload={handleDownloadSingle}
            fileName={selectedFile ? getFileName(selectedFile) : ''}
            hasData={
              selectedFile
                ? selectedFile.startsWith('config-')
                  ? !!configFileContents[selectedFile]
                  : selectedFile.startsWith('pay-period-') || selectedFile.startsWith('pay-date-') || ['payroll-areas', 'calendar-id', 'payroll-area-config'].includes(selectedFile)
                    ? payrollAreas.length > 0
                    : selectedFile === 'company-code-file'
                      ? companyCodes.filter((c) => c.companyCode && c.companyName).length > 0
                      : selectedFile === 'tax-company-file'
                        ? taxCompanies.length > 0
                        : !!paymentData?.methods.length
                : false
            }
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
