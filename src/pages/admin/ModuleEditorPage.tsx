/**
 * ModuleEditorPage - Edit a module's questions and settings
 *
 * Route: /admin/modules/:slug
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  AlertCircle,
  Loader2,
  Settings,
  FileText,
  Eye,
} from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { QuestionList } from '../../components/admin/QuestionList';
import { QuestionEditor } from '../../components/admin/QuestionEditor';
import {
  getModule,
  updateModule,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  type ModuleDetail,
  type Question,
} from '../../api/modules';

type TabType = 'questions' | 'settings' | 'preview';

export function ModuleEditorPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [module, setModule] = useState<ModuleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('questions');

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    description: '',
    icon: '',
    status: 'draft',
  });
  const [settingsDirty, setSettingsDirty] = useState(false);

  // Question editor modal
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showQuestionEditor, setShowQuestionEditor] = useState(false);

  // Load module
  useEffect(() => {
    if (slug) {
      loadModule();
    }
  }, [slug]);

  async function loadModule() {
    try {
      setLoading(true);
      setError(null);
      const data = await getModule(slug!);
      setModule(data);
      setSettingsForm({
        name: data.metadata.name,
        description: data.metadata.description || '',
        icon: data.metadata.icon || 'box',
        status: data.metadata.status || 'draft',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load module');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings() {
    if (!slug) return;

    try {
      setSaving(true);
      await updateModule(slug, settingsForm);
      setSettingsDirty(false);
      await loadModule();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddQuestion(question: Partial<Question>) {
    if (!slug) return;

    try {
      setSaving(true);
      await addQuestion(slug, question);
      setShowQuestionEditor(false);
      setEditingQuestion(null);
      await loadModule();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add question');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateQuestion(
    questionId: string,
    updates: Partial<Question>
  ) {
    if (!slug) return;

    try {
      setSaving(true);
      await updateQuestion(slug, questionId, updates);
      setShowQuestionEditor(false);
      setEditingQuestion(null);
      await loadModule();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update question');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteQuestion(questionId: string) {
    if (!slug) return;

    try {
      setSaving(true);
      await deleteQuestion(slug, questionId);
      await loadModule();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete question');
    } finally {
      setSaving(false);
    }
  }

  async function handleReorderQuestions(questionIds: string[]) {
    if (!slug) return;

    try {
      await reorderQuestions(slug, questionIds);
      await loadModule();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder questions');
    }
  }

  function handleEditQuestion(question: Question) {
    setEditingQuestion(question);
    setShowQuestionEditor(true);
  }

  function handleNewQuestion() {
    setEditingQuestion(null);
    setShowQuestionEditor(true);
  }

  const tabs = [
    { id: 'questions' as const, label: 'Questions', icon: FileText },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
    { id: 'preview' as const, label: 'Preview', icon: Eye },
  ];

  if (loading) {
    return (
      <AdminLayout title="Loading..." description="">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      </AdminLayout>
    );
  }

  if (!module) {
    return (
      <AdminLayout title="Module Not Found" description="">
        <div className="text-center py-12">
          <p className="text-gray-600">Module "{slug}" could not be found.</p>
          <button
            onClick={() => navigate('/admin/modules')}
            className="mt-4 inline-flex items-center gap-2 text-amber-600 hover:text-amber-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Modules
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={module.name}
      description={`Editing module: ${module.slug}`}
    >
      {/* Back Button */}
      <button
        onClick={() => navigate('/admin/modules')}
        className="mb-4 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Modules
      </button>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-lg bg-red-50 p-4 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'questions' && (
        <div>
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-gray-600">
              {module.questions.length} question
              {module.questions.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={handleNewQuestion}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              <Plus className="h-4 w-4" />
              Add Question
            </button>
          </div>

          {/* Questions List */}
          <QuestionList
            questions={module.questions}
            onEdit={handleEditQuestion}
            onDelete={handleDeleteQuestion}
            onReorder={handleReorderQuestions}
          />
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-2xl">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Module Settings
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Module Name
                </label>
                <input
                  type="text"
                  value={settingsForm.name}
                  onChange={(e) => {
                    setSettingsForm((f) => ({ ...f, name: e.target.value }));
                    setSettingsDirty(true);
                  }}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={settingsForm.description}
                  onChange={(e) => {
                    setSettingsForm((f) => ({
                      ...f,
                      description: e.target.value,
                    }));
                    setSettingsDirty(true);
                  }}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  value={settingsForm.status}
                  onChange={(e) => {
                    setSettingsForm((f) => ({ ...f, status: e.target.value }));
                    setSettingsDirty(true);
                  }}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="pt-4">
                <button
                  onClick={handleSaveSettings}
                  disabled={!settingsDirty || saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Settings
                </button>
              </div>
            </div>
          </div>

          {/* Output Files Info */}
          {module.outputFiles.length > 0 && (
            <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Output Files
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Files generated when this module is completed:
              </p>
              <ul className="space-y-1">
                {module.outputFiles.map((file) => (
                  <li
                    key={file}
                    className="flex items-center gap-2 text-sm text-gray-700"
                  >
                    <FileText className="h-4 w-4 text-gray-400" />
                    {file}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {activeTab === 'preview' && (
        <div className="max-w-2xl">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Module Preview
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This is how the module will appear to users.
            </p>

            {module.questions.length === 0 ? (
              <p className="text-gray-500 italic">
                No questions yet. Add some questions to see a preview.
              </p>
            ) : (
              <div className="space-y-6">
                {module.questions.map((q, index) => (
                  <div
                    key={q.id}
                    className="rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-medium text-amber-700">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{q.text}</p>
                        {q.helpText && (
                          <p className="mt-1 text-sm text-gray-500">
                            {q.helpText}
                          </p>
                        )}
                        <div className="mt-2 text-xs text-gray-400">
                          Type: {q.type}
                          {q.showIf && (
                            <span className="ml-2">
                              | Conditional on: {q.showIf.questionId}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Question Editor Modal */}
      {showQuestionEditor && (
        <QuestionEditor
          question={editingQuestion}
          existingQuestions={module.questions}
          onSave={
            editingQuestion
              ? (updates) => handleUpdateQuestion(editingQuestion.id, updates)
              : handleAddQuestion
          }
          onClose={() => {
            setShowQuestionEditor(false);
            setEditingQuestion(null);
          }}
          saving={saving}
        />
      )}
    </AdminLayout>
  );
}
