/**
 * File Generators
 * Centralized generation logic for all export files
 * Extracted from PayrollResultsCard and PaymentMethodPage
 */

import type { PayrollArea, CompanyCode, TaxCompany } from '../types';
import {
  toCSVWithLabels,
  formatDatePadded,
  SAP_DEFAULTS,
  PAYDAY_TO_WEEKDAY,
} from './exportUtils';

// ============================================
// Type Definitions
// ============================================

export interface PayrollPeriodRow {
  period_parameters: string;
  payroll_year: string;
  payroll_period: string;
  period_begin_date: string;
  period_end_date: string;
  prior_period_year: string;
  prior_period_period: string;
}

export interface PayDateRow {
  molga: string;
  date_modifier: string;
  period_parameters: string;
  payroll_year: string;
  payroll_period: string;
  date_type: string;
  date: string;
}

export interface CalendarIdRow {
  period_parameters: string;
  period_parameter_name: string;
  time_unit: string;
  time_unit_desc: string;
  start_date: string;
}

export interface PayrollAreaConfigRow {
  payroll_area: string;
  payroll_area_text: string;
  period_parameters: string;
  run_payroll: string;
  date_modifier: string;
}

export interface PaymentMethodRow {
  payment_method: string;
  description: string;
  used: string;
}

export interface CheckRangeRow {
  company_code: string;
  bank_account: string;
  check_number_range: string;
}

export interface PreNotificationRow {
  pre_notification_required: string;
}

export interface CompanyCodeRow {
  company_code: string;
  company_name: string;
  short_name: string;
  currency: string;
  language: string;
  street: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  po_box: string;
  chart_of_accounts: string;
  fiscal_year_variant: string;
  vat_registration_number: string;
  credit_control_area: string;
  tax_jurisdiction_code: string;
}

export interface TaxCompanyRow {
  tax_company_code: string;
  tax_company_name: string;
  address: string;
}

export interface ExportFile {
  name: string;
  content: string;
  rowCount: number;
  module: 'payroll' | 'payment';
  type: string;
}

// ============================================
// Date Helpers (for period/paydate generation)
// ============================================

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function findClosestPayDate(base: Date, payDay: string): Date {
  const target = PAYDAY_TO_WEEKDAY[payDay.toLowerCase()];
  if (target === undefined) return new Date(base);

  const baseDow = base.getDay();
  const forward = (target - baseDow + 7) % 7;
  const backward = (baseDow - target + 7) % 7;

  const offset = forward <= backward ? forward : -backward;

  const result = new Date(base);
  result.setDate(result.getDate() + offset);
  return result;
}

function getFirstSemiMonthlyPayDate(anchor: Date, pattern: string): Date {
  const date = new Date(anchor);
  while (true) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const lastDay = getLastDayOfMonth(year, month);

    let isPayday = false;
    if (pattern === '15-last') {
      isPayday = day === 15 || day === lastDay;
    } else if (pattern === '15-30') {
      isPayday = day === 15 || day === 30;
    }

    if (isPayday) return date;
    date.setDate(day + 1);
  }
}

function getNextSemiMonthlyPayDate(current: Date, pattern: string): Date {
  const year = current.getFullYear();
  const month = current.getMonth();
  const day = current.getDate();
  const lastDay = getLastDayOfMonth(year, month);

  if (pattern === '15-last') {
    if (day === 15) {
      return new Date(year, month, lastDay);
    }
    return new Date(year, month + 1, 15);
  }

  // '15-30'
  if (day === 15) {
    return new Date(year, month, 30);
  }
  return new Date(year, month + 1, 15);
}

function getFirstMonthlyPayDate(anchor: Date, pattern: string): Date {
  const date = new Date(anchor);
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const lastDay = getLastDayOfMonth(year, month);

  let targetDay = 1;
  if (pattern === 'last') targetDay = lastDay;
  else if (pattern === '15') targetDay = 15;
  else if (pattern === '1') targetDay = 1;

  if (day <= targetDay) {
    return new Date(year, month, targetDay);
  }

  // Move to next month
  const nextMonth = month + 1;
  const nextLastDay = getLastDayOfMonth(year, nextMonth);
  let nextTarget = 1;
  if (pattern === 'last') nextTarget = nextLastDay;
  else if (pattern === '15') nextTarget = 15;
  else if (pattern === '1') nextTarget = 1;

  return new Date(year, nextMonth, nextTarget);
}

function getNextMonthlyPayDate(current: Date, pattern: string): Date {
  const year = current.getFullYear();
  const month = current.getMonth() + 1;
  const lastDay = getLastDayOfMonth(year, month);

  let targetDay = 1;
  if (pattern === 'last') targetDay = lastDay;
  else if (pattern === '15') targetDay = 15;
  else if (pattern === '1') targetDay = 1;

  return new Date(year, month, targetDay);
}

// ============================================
// Payroll Area Generators
// ============================================

/**
 * Generate payroll periods for an area
 */
export function generatePayrollPeriods(
  area: PayrollArea,
  numYears: number = 1
): PayrollPeriodRow[] {
  const rows: PayrollPeriodRow[] = [];
  let payrollPeriod = 1;
  let currentPriorYear: number | null = null;
  let priorPeriodCounter = 0;

  const pushRow = (begin: Date, end: Date) => {
    const payrollYear = end.getFullYear();
    const priorPeriodYear = end.getFullYear();

    if (currentPriorYear === null || currentPriorYear !== priorPeriodYear) {
      currentPriorYear = priorPeriodYear;
      priorPeriodCounter = 1;
    } else {
      priorPeriodCounter += 1;
    }

    rows.push({
      period_parameters: String(area.calendarId || '80'),
      payroll_year: String(payrollYear),
      payroll_period: String(payrollPeriod).padStart(2, '0'),
      period_begin_date: formatDatePadded(begin),
      period_end_date: formatDatePadded(end),
      prior_period_year: String(priorPeriodYear),
      prior_period_period: String(priorPeriodCounter).padStart(2, '0'),
    });

    payrollPeriod += 1;
  };

  const start = new Date(SAP_DEFAULTS.PERIOD_ANCHOR);

  switch (area.frequency) {
    case 'weekly': {
      const numPeriods = 52 * numYears;
      for (let i = 0; i < numPeriods; i++) {
        const begin = new Date(start);
        begin.setDate(start.getDate() + i * 7);
        const end = new Date(begin);
        end.setDate(begin.getDate() + 6);
        pushRow(begin, end);
      }
      break;
    }

    case 'biweekly': {
      const numPeriods = 26 * numYears;
      for (let i = 0; i < numPeriods; i++) {
        const begin = new Date(start);
        begin.setDate(start.getDate() + i * 14);
        const end = new Date(begin);
        end.setDate(begin.getDate() + 13);
        pushRow(begin, end);
      }
      break;
    }

    case 'semimonthly': {
      const totalMonths = 12 * numYears;
      let cursor = new Date(start);
      for (let m = 0; m < totalMonths; m++) {
        const year = cursor.getFullYear();
        const month = cursor.getMonth();

        // 1st-15th
        const firstBegin = new Date(year, month, 1);
        const firstEnd = new Date(year, month, 15);
        pushRow(firstBegin, firstEnd);

        // 16th-end
        const secondBegin = new Date(year, month, 16);
        const secondEnd = new Date(year, month + 1, 0);
        pushRow(secondBegin, secondEnd);

        cursor = new Date(year, month + 1, 1);
      }
      break;
    }

    case 'monthly': {
      const totalMonths = 12 * numYears;
      let cursor = new Date(start);
      for (let m = 0; m < totalMonths; m++) {
        const year = cursor.getFullYear();
        const month = cursor.getMonth();

        const begin = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
        pushRow(begin, end);

        cursor = new Date(year, month + 1, 1);
      }
      break;
    }

    default: {
      // Fallback: weekly
      const numPeriods = 52 * numYears;
      for (let i = 0; i < numPeriods; i++) {
        const begin = new Date(start);
        begin.setDate(start.getDate() + i * 7);
        const end = new Date(begin);
        end.setDate(begin.getDate() + 6);
        pushRow(begin, end);
      }
    }
  }

  return rows;
}

/**
 * Generate pay dates for an area
 */
export function generatePayDates(area: PayrollArea, numYears: number = 1): PayDateRow[] {
  const anchor = new Date(SAP_DEFAULTS.PAY_DATE_ANCHOR);
  const rows: PayDateRow[] = [];

  let firstPayDate: Date;
  let numRows: number;
  let useSimpleStep = false;
  let stepDays = 7;

  if (area.frequency === 'weekly' || area.frequency === 'biweekly') {
    const weekdayPayday = area.payDay || 'friday';
    firstPayDate = findClosestPayDate(anchor, weekdayPayday);
    useSimpleStep = true;
    if (area.frequency === 'weekly') {
      stepDays = 7;
      numRows = 52 * numYears;
    } else {
      stepDays = 14;
      numRows = 26 * numYears;
    }
  } else if (area.frequency === 'semimonthly') {
    const pattern = area.payDay || '15-last';
    firstPayDate = getFirstSemiMonthlyPayDate(anchor, pattern);
    numRows = 24 * numYears;
  } else if (area.frequency === 'monthly') {
    const pattern = area.payDay || 'last';
    firstPayDate = getFirstMonthlyPayDate(anchor, pattern);
    numRows = 12 * numYears;
  } else {
    firstPayDate = findClosestPayDate(anchor, area.payDay || 'friday');
    useSimpleStep = true;
    stepDays = 7;
    numRows = 52 * numYears;
  }

  let currentYear: number | null = null;
  let payrollPeriodCounter = 0;
  let currentDate = new Date(firstPayDate);

  for (let i = 0; i < numRows; i++) {
    const date = new Date(currentDate);
    const year = date.getFullYear();

    if (currentYear === null || currentYear !== year) {
      currentYear = year;
      payrollPeriodCounter = 1;
    } else {
      payrollPeriodCounter += 1;
    }

    rows.push({
      molga: SAP_DEFAULTS.MOLGA,
      date_modifier: SAP_DEFAULTS.DATE_MODIFIER,
      period_parameters: String(area.calendarId || '80'),
      payroll_year: String(year),
      payroll_period: String(payrollPeriodCounter).padStart(2, '0'),
      date_type: SAP_DEFAULTS.DATE_TYPE,
      date: formatDatePadded(date),
    });

    // Advance to next pay date
    if (useSimpleStep) {
      currentDate.setDate(currentDate.getDate() + stepDays);
    } else if (area.frequency === 'semimonthly') {
      currentDate = getNextSemiMonthlyPayDate(currentDate, area.payDay || '15-last');
    } else if (area.frequency === 'monthly') {
      currentDate = getNextMonthlyPayDate(currentDate, area.payDay || 'last');
    }
  }

  return rows;
}

/**
 * Generate calendar ID configuration row
 */
export function generateCalendarIdRow(area: PayrollArea): CalendarIdRow {
  const freqDesc: Record<string, string> = {
    weekly: 'Weekly',
    biweekly: 'Bi-weekly',
    semimonthly: 'Semi-monthly',
    monthly: 'Monthly',
  };

  return {
    period_parameters: area.calendarId || '80',
    period_parameter_name: area.description || `${freqDesc[area.frequency] || area.frequency} Payroll`,
    time_unit: SAP_DEFAULTS.TIME_UNIT,
    time_unit_desc: freqDesc[area.frequency] || area.frequency,
    start_date: SAP_DEFAULTS.CALENDAR_START_DATE,
  };
}

/**
 * Generate payroll area configuration row
 */
export function generatePayrollAreaConfigRow(area: PayrollArea): PayrollAreaConfigRow {
  return {
    payroll_area: area.region || area.code,
    payroll_area_text: SAP_DEFAULTS.PAYROLL_AREA_TEXT,
    period_parameters: area.calendarId || '80',
    run_payroll: SAP_DEFAULTS.RUN_PAYROLL,
    date_modifier: SAP_DEFAULTS.DATE_MODIFIER,
  };
}

// ============================================
// CSV Generation Functions
// ============================================

export function generatePayrollAreasCSV(areas: PayrollArea[]): string {
  const columns = [
    { key: 'code' as const, label: 'Code' },
    { key: 'description' as const, label: 'Description' },
    { key: 'frequency' as const, label: 'Frequency' },
    { key: 'periodPattern' as const, label: 'Period Pattern' },
    { key: 'payDay' as const, label: 'Pay Day' },
    { key: 'calendarId' as const, label: 'Calendar ID' },
    { key: 'employeeCount' as const, label: 'Employee Count' },
    { key: 'businessUnit' as const, label: 'Business Unit' },
    { key: 'region' as const, label: 'Region' },
  ];

  return toCSVWithLabels(areas, columns);
}

export function generateCalendarIdCSV(areas: PayrollArea[]): string {
  // Dedupe by calendarId
  const seen = new Set<string>();
  const rows: CalendarIdRow[] = [];

  for (const area of areas) {
    const calId = area.calendarId || '80';
    if (!seen.has(calId)) {
      seen.add(calId);
      rows.push(generateCalendarIdRow(area));
    }
  }

  const columns = [
    { key: 'period_parameters' as const, label: 'period_parameters' },
    { key: 'period_parameter_name' as const, label: 'period_parameter_name' },
    { key: 'time_unit' as const, label: 'time_unit' },
    { key: 'time_unit_desc' as const, label: 'time_unit_desc' },
    { key: 'start_date' as const, label: 'start_date' },
  ];

  return toCSVWithLabels(rows, columns);
}

export function generatePayrollAreaConfigCSV(areas: PayrollArea[]): string {
  const rows = areas.map(generatePayrollAreaConfigRow);

  const columns = [
    { key: 'payroll_area' as const, label: 'payroll_area' },
    { key: 'payroll_area_text' as const, label: 'payroll_area_text' },
    { key: 'period_parameters' as const, label: 'period_parameters' },
    { key: 'run_payroll' as const, label: 'run_payroll' },
    { key: 'date_modifier' as const, label: 'date_modifier' },
  ];

  return toCSVWithLabels(rows, columns);
}

export function generatePayrollPeriodCSV(area: PayrollArea): string {
  const rows = generatePayrollPeriods(area);

  const columns = [
    { key: 'period_parameters' as const, label: 'period_parameters' },
    { key: 'payroll_year' as const, label: 'payroll_year' },
    { key: 'payroll_period' as const, label: 'payroll_period' },
    { key: 'period_begin_date' as const, label: 'period_begin_date' },
    { key: 'period_end_date' as const, label: 'period_end_date' },
    { key: 'prior_period_year' as const, label: 'prior_period_year' },
    { key: 'prior_period_period' as const, label: 'prior_period_period' },
  ];

  return toCSVWithLabels(rows, columns);
}

export function generatePayDateCSV(area: PayrollArea): string {
  const rows = generatePayDates(area);

  const columns = [
    { key: 'molga' as const, label: 'molga' },
    { key: 'date_modifier' as const, label: 'date_modifier' },
    { key: 'period_parameters' as const, label: 'period_parameters' },
    { key: 'payroll_year' as const, label: 'payroll_year' },
    { key: 'payroll_period' as const, label: 'payroll_period' },
    { key: 'date_type' as const, label: 'date_type' },
    { key: 'date' as const, label: 'date' },
  ];

  return toCSVWithLabels(rows, columns);
}

// ============================================
// Payment Method Generators
// ============================================

export function generatePaymentMethodCSV(methods: PaymentMethodRow[]): string {
  const columns = [
    { key: 'payment_method' as const, label: 'Payment_Method' },
    { key: 'description' as const, label: 'Description' },
    { key: 'used' as const, label: 'Used' },
  ];

  return toCSVWithLabels(methods, columns);
}

export function generateCheckRangeCSV(ranges: CheckRangeRow[]): string {
  const columns = [
    { key: 'company_code' as const, label: 'Company_Code' },
    { key: 'bank_account' as const, label: 'Bank_Account' },
    { key: 'check_number_range' as const, label: 'Check_Number_Range' },
  ];

  return toCSVWithLabels(ranges, columns);
}

export function generatePreNotificationCSV(required: boolean): string {
  const row: PreNotificationRow = {
    pre_notification_required: required ? 'Yes' : 'No',
  };

  const columns = [
    { key: 'pre_notification_required' as const, label: 'Pre_Notification_Required' },
  ];

  return toCSVWithLabels([row], columns);
}

// ============================================
// Company Code Generators
// ============================================

export function generateCompanyCodeCSV(codes: CompanyCode[]): string {
  // Convert CompanyCode to CompanyCodeRow format
  const rows: CompanyCodeRow[] = codes
    .filter((c) => c.companyCode && c.companyName) // Only include valid rows
    .map((c) => ({
      company_code: c.companyCode || '',
      company_name: c.companyName || '',
      short_name: c.shortName || '',
      currency: c.currency || '',
      language: c.language || '',
      street: c.street || '',
      city: c.city || '',
      state: c.state || '',
      zip_code: c.zipCode || '',
      country: c.country || '',
      po_box: c.poBox || '',
      chart_of_accounts: c.chartOfAccounts || '',
      fiscal_year_variant: c.fiscalYearVariant || '',
      vat_registration_number: c.vatRegistrationNumber || '',
      credit_control_area: c.creditControlArea || '',
      tax_jurisdiction_code: c.taxJurisdictionCode || '',
    }));

  const columns = [
    { key: 'company_code' as const, label: 'Company_Code' },
    { key: 'company_name' as const, label: 'Company_Name' },
    { key: 'short_name' as const, label: 'Short_Name' },
    { key: 'currency' as const, label: 'Currency' },
    { key: 'language' as const, label: 'Language' },
    { key: 'street' as const, label: 'Street' },
    { key: 'city' as const, label: 'City' },
    { key: 'state' as const, label: 'State' },
    { key: 'zip_code' as const, label: 'Zip_Code' },
    { key: 'country' as const, label: 'Country' },
    { key: 'po_box' as const, label: 'PO_Box' },
    { key: 'chart_of_accounts' as const, label: 'Chart_of_Accounts' },
    { key: 'fiscal_year_variant' as const, label: 'Fiscal_Year_Variant' },
    { key: 'vat_registration_number' as const, label: 'VAT_Registration_Number' },
    { key: 'credit_control_area' as const, label: 'Credit_Control_Area' },
    { key: 'tax_jurisdiction_code' as const, label: 'Tax_Jurisdiction_Code' },
  ];

  return toCSVWithLabels(rows, columns);
}

export function generateTaxCompanyCSV(companies: TaxCompany[]): string {
  const rows: TaxCompanyRow[] = companies
    .filter((c) => c.code && c.name)
    .map((c) => ({
      tax_company_code: String(c.code ?? ''),
      tax_company_name: c.name || '',
      address: c.address || '',
    }));

  const columns = [
    { key: 'tax_company_code' as const, label: 'Tax_Company_Code' },
    { key: 'tax_company_name' as const, label: 'Tax_Company_Name' },
    { key: 'address' as const, label: 'Address' },
  ];

  return toCSVWithLabels(rows, columns);
}

// ============================================
// File Registry
// ============================================

export interface FileGeneratorConfig {
  id: string;
  name: string;
  description: string;
  module: 'payroll' | 'payment';
  generate: (data: unknown) => { content: string; rowCount: number };
}

export const FILE_GENERATORS: Record<string, FileGeneratorConfig> = {
  // Payroll files
  'payroll-areas': {
    id: 'payroll-areas',
    name: 'Payroll Areas',
    description: 'All configured payroll areas',
    module: 'payroll',
    generate: (data) => {
      const areas = data as PayrollArea[];
      return { content: generatePayrollAreasCSV(areas), rowCount: areas.length };
    },
  },
  'calendar-id': {
    id: 'calendar-id',
    name: 'Calendar ID',
    description: 'Period parameter definitions',
    module: 'payroll',
    generate: (data) => {
      const areas = data as PayrollArea[];
      const uniqueCalendars = new Set(areas.map(a => a.calendarId || '80')).size;
      return { content: generateCalendarIdCSV(areas), rowCount: uniqueCalendars };
    },
  },
  'payroll-area-config': {
    id: 'payroll-area-config',
    name: 'Payroll Area Config',
    description: 'Payroll area to period parameter mapping',
    module: 'payroll',
    generate: (data) => {
      const areas = data as PayrollArea[];
      return { content: generatePayrollAreaConfigCSV(areas), rowCount: areas.length };
    },
  },
  'pay-period': {
    id: 'pay-period',
    name: 'Pay Period',
    description: 'Period begin/end dates (52+ rows per calendar)',
    module: 'payroll',
    generate: (data) => {
      const area = data as PayrollArea;
      const rows = generatePayrollPeriods(area);
      return { content: generatePayrollPeriodCSV(area), rowCount: rows.length };
    },
  },
  'pay-date': {
    id: 'pay-date',
    name: 'Pay Date',
    description: 'Actual pay dates (52+ rows per calendar)',
    module: 'payroll',
    generate: (data) => {
      const area = data as PayrollArea;
      const rows = generatePayDates(area);
      return { content: generatePayDateCSV(area), rowCount: rows.length };
    },
  },

  // Payment files
  'payment-method': {
    id: 'payment-method',
    name: 'Payment Method',
    description: 'Enabled payment methods (P, Q, K, M)',
    module: 'payment',
    generate: (data) => {
      const methods = data as PaymentMethodRow[];
      return { content: generatePaymentMethodCSV(methods), rowCount: methods.length };
    },
  },
  'check-range': {
    id: 'check-range',
    name: 'Check Range',
    description: 'Bank accounts and check number ranges',
    module: 'payment',
    generate: (data) => {
      const ranges = data as CheckRangeRow[];
      return { content: generateCheckRangeCSV(ranges), rowCount: ranges.length };
    },
  },
  'pre-notification': {
    id: 'pre-notification',
    name: 'Pre-Notification',
    description: 'Pre-notification requirement',
    module: 'payment',
    generate: (data) => {
      const required = data as boolean;
      return { content: generatePreNotificationCSV(required), rowCount: 1 };
    },
  },
  'company-code-config': {
    id: 'company-code-config',
    name: 'Company Code Config',
    description: 'Company code organizational data',
    module: 'payroll',
    generate: (data) => {
      const codes = data as CompanyCode[];
      return { content: generateCompanyCodeCSV(codes), rowCount: codes.length };
    },
  },
  'tax-company': {
    id: 'tax-company',
    name: 'Tax Company',
    description: 'Tax company master data',
    module: 'payroll',
    generate: (data) => {
      const companies = data as TaxCompany[];
      return { content: generateTaxCompanyCSV(companies), rowCount: companies.length };
    },
  },
};
