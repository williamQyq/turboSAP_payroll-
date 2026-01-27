/**
 * ModulesPage - Admin page for managing config-driven modules
 *
 * Lists all modules, allows creating new ones, and navigates to editor.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Edit,
  FileText,
  Box,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import {
  listModules,
  createModule,
  deleteModule,
  type ModuleSummary,
} from '../../api/modules';

export function ModulesPage() {
  const navigate = useNavigate();
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create module modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    icon: 'box',
  });
  const [creating, setCreating] = useState(false);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load modules
  useEffect(() => {
    loadModules();
  }, []);

  async function loadModules() {
    try {
      setLoading(true);
      setError(null);
      const response = await listModules();
      setModules(response.modules);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load modules');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.name.trim()) return;

    try {
      setCreating(true);
      await createModule({
        name: createForm.name.trim(),
        description: createForm.description.trim(),
        icon: createForm.icon,
      });
      setShowCreateModal(false);
      setCreateForm({ name: '', description: '', icon: 'box' });
      await loadModules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create module');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(slug: string) {
    try {
      setDeleting(true);
      await deleteModule(slug);
      setDeleteConfirm(null);
      await loadModules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete module');
    } finally {
      setDeleting(false);
    }
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      active: 'bg-green-50 text-green-700 ring-green-600/20',
      draft: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
      inactive: 'bg-gray-50 text-gray-600 ring-gray-500/20',
    };
    return styles[status] || styles.draft;
  }

  return (
    <AdminLayout
      title="Modules"
      description="Manage config-driven question modules"
    >
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

      {/* Header with Create Button */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-gray-600">
            {modules.length} module{modules.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Module
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      )}

      {/* Modules Grid */}
      {!loading && modules.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <Box className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No modules yet</h3>
          <p className="mt-2 text-gray-500">
            Create your first config-driven module to get started.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            <Plus className="h-4 w-4" />
            Create Module
          </button>
        </div>
      )}

      {!loading && modules.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <div
              key={module.slug}
              className="group rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Module Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Box className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{module.name}</h3>
                    <p className="text-sm text-gray-500">{module.slug}</p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${getStatusBadge(
                    module.status
                  )}`}
                >
                  {module.status}
                </span>
              </div>

              {/* Description */}
              {module.description && (
                <p className="mt-3 text-sm text-gray-600 line-clamp-2">
                  {module.description}
                </p>
              )}

              {/* Stats */}
              <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {module.question_count} questions
                </span>
                {module.output_files.length > 0 && (
                  <span>{module.output_files.length} output files</span>
                )}
              </div>

              {/* Actions */}
              <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-4">
                <button
                  onClick={() => navigate(`/admin/modules/${module.slug}`)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={() => setDeleteConfirm(module.slug)}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Module Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              Create New Module
            </h2>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Module Name
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g., Bank Details"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Brief description of this module..."
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !createForm.name.trim()}
                  className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Module
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              Delete Module
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete{' '}
              <span className="font-medium">{deleteConfirm}</span>? This action
              cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
