/**
 * ModulesListPage - User-facing list of available config-driven modules
 *
 * Route: /modules
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { listModules, type ModuleSummary } from '../api/modules';

export function ModulesListPage() {
  const navigate = useNavigate();
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadModules();
  }, []);

  async function loadModules() {
    try {
      setLoading(true);
      setError(null);
      const response = await listModules();
      // Only show active modules to users
      setModules(response.modules.filter((m) => m.status === 'active'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load modules');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout title="Modules">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Configuration Modules" description="Complete these modules to configure your SAP system">
      <div className="mx-auto max-w-4xl py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Configuration Modules</h1>
          <p className="mt-1 text-gray-500">
            Complete these modules to configure your SAP system.
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-lg bg-red-50 p-4 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {modules.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No modules available
            </h3>
            <p className="mt-2 text-gray-500">
              Check back later for configuration modules.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {modules.map((module) => (
              <button
                key={module.slug}
                onClick={() => navigate(`/modules/${module.slug}`)}
                className="group rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm hover:shadow-md hover:border-purple-200 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                    <Package className="h-6 w-6" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-purple-500 transition-colors" />
                </div>
                <h3 className="mt-4 font-semibold text-gray-900">{module.name}</h3>
                {module.description && (
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                    {module.description}
                  </p>
                )}
                <div className="mt-4 text-sm text-gray-400">
                  {module.question_count} questions
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
