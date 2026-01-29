/**
 * Modules API Client
 *
 * API functions for managing config-driven modules.
 */

import { apiFetch } from './utils';

// =============================================================================
// Types
// =============================================================================

export interface ModuleSummary {
  slug: string;
  name: string;
  description: string;
  category: string | null;
  icon: string;
  status: string;
  order: number;
  question_count: number;
  output_files: string[];
  has_config: boolean;
  has_questions: boolean;
}

export interface ModuleMetadata {
  slug: string;
  name: string;
  description: string;
  category: string | null;
  icon: string;
  status: string;
  order: number;
  version: string;
  createdAt: string | null;
  createdBy: string | null;
  updatedAt: string | null;
}

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}

export interface ShowIfCondition {
  questionId: string;
  equals?: string;
  notEquals?: string;
  contains?: string;
  answerId?: string; // Legacy
}

export interface OutputMapping {
  file: string;
  column: string;
  transform: 'direct' | 'yes_no' | 'value_lookup' | 'row_per_selected';
  valueMap?: Record<string, string>;
}

export interface SpreadsheetColumn {
  key: string;
  label: string;
  width?: number;
  required?: boolean;
  type?: 'text' | 'number';
  placeholder?: string;
}

export interface SpreadsheetConfig {
  columns: SpreadsheetColumn[];
  minRows?: number;
  maxRows?: number;
}

export type SpreadsheetRow = Record<string, string | number | null>;

export interface Question {
  id: string;
  text: string;
  type: 'single_select' | 'multi_select' | 'text' | 'number' | 'yes_no' | 'spreadsheet' | string;
  options?: QuestionOption[];
  showIf?: ShowIfCondition;
  order?: number;
  helpText?: string;
  outputMapping?: OutputMapping;
  spreadsheetConfig?: SpreadsheetConfig;
}

export interface ModuleDetail {
  slug: string;
  name: string;
  metadata: ModuleMetadata;
  questions: Question[];
  outputFiles: string[];
}

export interface SessionState {
  sessionId: string;
  moduleSlug: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  answers: Record<string, unknown>;
  currentQuestionId: string | null;
  currentQuestion: Question | null;
  progress: {
    answered: number;
    total: number;
    percentage: number;
    isComplete: boolean;
  };
  startedAt: string | null;
  completedAt: string | null;
}

export interface AnswerResult {
  success: boolean;
  message: string | null;
  nextQuestionId: string | null;
  nextQuestion: Question | null;
  isComplete: boolean;
  progress: {
    answered: number;
    total: number;
    percentage: number;
    isComplete: boolean;
  };
}

export interface OutputFileData {
  columns: string[];
  rows: Record<string, unknown>[];
}

// =============================================================================
// Module CRUD
// =============================================================================

export async function listModules(): Promise<{ modules: ModuleSummary[] }> {
  return apiFetch<{ modules: ModuleSummary[] }>('/api/modules');
}

export async function getModule(slug: string): Promise<ModuleDetail> {
  return apiFetch<ModuleDetail>(`/api/modules/${slug}`);
}

export async function createModule(data: {
  name: string;
  description?: string;
  slug?: string;
  icon?: string;
  category?: string;
}): Promise<{ success: boolean; message: string; module: ModuleSummary }> {
  return apiFetch('/api/modules', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateModule(
  slug: string,
  data: {
    name?: string;
    description?: string;
    icon?: string;
    status?: string;
    order?: number;
    category?: string;
  }
): Promise<{ success: boolean; message: string; module: ModuleMetadata }> {
  return apiFetch(`/api/modules/${slug}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteModule(
  slug: string
): Promise<{ success: boolean; message: string }> {
  return apiFetch(`/api/modules/${slug}`, {
    method: 'DELETE',
  });
}

// =============================================================================
// Question CRUD
// =============================================================================

export async function listQuestions(
  moduleSlug: string
): Promise<{ moduleSlug: string; questions: Question[]; count: number }> {
  return apiFetch(`/api/modules/${moduleSlug}/questions`);
}

export async function getQuestion(
  moduleSlug: string,
  questionId: string
): Promise<{ moduleSlug: string; question: Question }> {
  return apiFetch(`/api/modules/${moduleSlug}/questions/${questionId}`);
}

export async function addQuestion(
  moduleSlug: string,
  question: Partial<Question>
): Promise<{ success: boolean; message: string; question: Question }> {
  return apiFetch(`/api/modules/${moduleSlug}/questions`, {
    method: 'POST',
    body: JSON.stringify(question),
  });
}

export async function updateQuestion(
  moduleSlug: string,
  questionId: string,
  updates: Partial<Question>
): Promise<{ success: boolean; message: string; question: Question }> {
  return apiFetch(`/api/modules/${moduleSlug}/questions/${questionId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteQuestion(
  moduleSlug: string,
  questionId: string
): Promise<{ success: boolean; message: string }> {
  return apiFetch(`/api/modules/${moduleSlug}/questions/${questionId}`, {
    method: 'DELETE',
  });
}

export async function reorderQuestions(
  moduleSlug: string,
  questionIds: string[]
): Promise<{ success: boolean; message: string; questions: Question[] }> {
  return apiFetch(`/api/modules/${moduleSlug}/questions/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ questionIds }),
  });
}

// =============================================================================
// Session (User-Facing)
// =============================================================================

export async function startSession(
  moduleSlug: string
): Promise<{
  success: boolean;
  sessionId: string;
  moduleSlug: string;
  firstQuestionId: string | null;
  status: string;
}> {
  return apiFetch(`/api/modules/${moduleSlug}/sessions`, {
    method: 'POST',
  });
}

export async function getSession(
  moduleSlug: string,
  sessionId: string
): Promise<SessionState> {
  return apiFetch(`/api/modules/${moduleSlug}/sessions/${sessionId}`);
}

export async function submitAnswer(
  moduleSlug: string,
  sessionId: string,
  questionId: string,
  value: unknown
): Promise<AnswerResult> {
  return apiFetch(`/api/modules/${moduleSlug}/sessions/${sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ questionId, value }),
  });
}

export async function getSessionOutput(
  moduleSlug: string,
  sessionId: string,
  format: 'json' | 'csv' = 'json'
): Promise<{
  files: Record<string, OutputFileData | string>;
  format: string;
}> {
  return apiFetch(
    `/api/modules/${moduleSlug}/sessions/${sessionId}/output?format=${format}`
  );
}

export async function deleteSession(
  moduleSlug: string,
  sessionId: string
): Promise<{ success: boolean; message: string }> {
  return apiFetch(`/api/modules/${moduleSlug}/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

// =============================================================================
// Output Export (for Export Center)
// =============================================================================

export interface SessionOutputMetadata {
  sessionId: string;
  moduleSlug: string;
  completedAt: string;
  startedAt: string | null;
  answersCount: number;
  files: string[];
  userId?: number | null;
}

export interface ModuleOutputs {
  moduleName: string;
  sessions: SessionOutputMetadata[];
}

export async function listAllOutputs(): Promise<{
  success: boolean;
  outputs: Record<string, ModuleOutputs>;
}> {
  return apiFetch('/api/modules/outputs/all');
}

export async function listModuleOutputs(
  moduleSlug: string
): Promise<{
  success: boolean;
  moduleSlug: string;
  sessions: SessionOutputMetadata[];
  count: number;
}> {
  return apiFetch(`/api/modules/${moduleSlug}/outputs`);
}

export async function getPersistedOutput(
  moduleSlug: string,
  sessionId: string
): Promise<{
  success: boolean;
  moduleSlug: string;
  sessionId: string;
  metadata: SessionOutputMetadata;
  files: Record<string, string>;
}> {
  return apiFetch(`/api/modules/${moduleSlug}/outputs/${sessionId}`);
}

export async function deletePersistedOutput(
  moduleSlug: string,
  sessionId: string
): Promise<{ success: boolean; message: string }> {
  return apiFetch(`/api/modules/${moduleSlug}/outputs/${sessionId}`, {
    method: 'DELETE',
  });
}
