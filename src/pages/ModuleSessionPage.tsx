/**
 * ModuleSessionPage - User-facing page to complete a config-driven module
 *
 * Route: /modules/:slug
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Loader2,
  AlertCircle,
  Download,
} from 'lucide-react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import {
  getModule,
  startSession,
  getSession,
  submitAnswer,
  getSessionOutput,
  type ModuleDetail,
  type SessionState,
  type Question,
} from '../api/modules';

export function ModuleSessionPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [module, setModule] = useState<ModuleDetail | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Current answer state
  const [currentAnswer, setCurrentAnswer] = useState<unknown>(null);

  // Load module and start/resume session
  useEffect(() => {
    if (slug) {
      initModule();
    }
  }, [slug]);

  async function initModule() {
    try {
      setLoading(true);
      setError(null);

      // Load module details
      const moduleData = await getModule(slug!);
      setModule(moduleData);

      // Check for existing session in localStorage
      const savedSessionId = localStorage.getItem(`module-session-${slug}`);

      if (savedSessionId) {
        try {
          const sessionData = await getSession(slug!, savedSessionId);
          setSession(sessionData);
          return;
        } catch {
          // Session expired or invalid, start new one
          localStorage.removeItem(`module-session-${slug}`);
        }
      }

      // Start new session
      const newSession = await startSession(slug!);
      localStorage.setItem(`module-session-${slug}`, newSession.sessionId);

      // Fetch full session state
      const sessionData = await getSession(slug!, newSession.sessionId);
      setSession(sessionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load module');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitAnswer() {
    if (!session || !session.currentQuestionId || currentAnswer === null) return;

    try {
      setSubmitting(true);
      setError(null);

      const result = await submitAnswer(
        slug!,
        session.sessionId,
        session.currentQuestionId,
        currentAnswer
      );

      // Update session state
      setSession((prev) =>
        prev
          ? {
              ...prev,
              answers: { ...prev.answers, [session.currentQuestionId!]: currentAnswer },
              currentQuestionId: result.nextQuestionId,
              currentQuestion: result.nextQuestion,
              progress: result.progress,
              status: result.isComplete ? 'completed' : 'in_progress',
            }
          : null
      );

      // Reset answer for next question
      setCurrentAnswer(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadOutput() {
    if (!session) return;

    try {
      const output = await getSessionOutput(slug!, session.sessionId, 'csv');

      // Download each file
      Object.entries(output.files).forEach(([filename, content]) => {
        const blob = new Blob([content as string], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download output');
    }
  }

  function handleStartOver() {
    localStorage.removeItem(`module-session-${slug}`);
    setSession(null);
    setCurrentAnswer(null);
    initModule();
  }

  function renderQuestionInput(question: Question) {
    switch (question.type) {
      case 'text':
      case 'free_text':
        return (
          <input
            type="text"
            value={(currentAnswer as string) || ''}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            placeholder="Enter your answer..."
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            autoFocus
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={(currentAnswer as number) ?? ''}
            onChange={(e) => setCurrentAnswer(e.target.value ? Number(e.target.value) : null)}
            placeholder="Enter a number..."
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            autoFocus
          />
        );

      case 'yes_no':
        return (
          <div className="flex gap-4">
            {['yes', 'no'].map((value) => (
              <button
                key={value}
                onClick={() => setCurrentAnswer(value)}
                className={`flex-1 rounded-lg border-2 px-6 py-4 text-lg font-medium transition-all ${
                  currentAnswer === value
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {value === 'yes' ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        );

      case 'single_select':
      case 'multiple_choice':
      case 'choice':
        return (
          <div className="space-y-2">
            {question.options?.map((option) => (
              <button
                key={option.value}
                onClick={() => setCurrentAnswer(option.value)}
                className={`w-full rounded-lg border-2 px-4 py-3 text-left transition-all ${
                  currentAnswer === option.value
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className="font-medium">{option.label}</span>
                {option.description && (
                  <p className="mt-1 text-sm text-gray-500">{option.description}</p>
                )}
              </button>
            ))}
          </div>
        );

      case 'multi_select':
        const selectedValues = (currentAnswer as string[]) || [];
        return (
          <div className="space-y-2">
            {question.options?.map((option) => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    if (isSelected) {
                      setCurrentAnswer(selectedValues.filter((v) => v !== option.value));
                    } else {
                      setCurrentAnswer([...selectedValues, option.value]);
                    }
                  }}
                  className={`w-full rounded-lg border-2 px-4 py-3 text-left transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-5 w-5 rounded border-2 flex items-center justify-center ${
                        isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
                      }`}
                    >
                      {isSelected && <CheckCircle className="h-4 w-4 text-white" />}
                    </div>
                    <div>
                      <span className="font-medium">{option.label}</span>
                      {option.description && (
                        <p className="text-sm text-gray-500">{option.description}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={(currentAnswer as string) || ''}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            placeholder="Enter your answer..."
            className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-purple-500 focus:outline-none"
          />
        );
    }
  }

  const pageTitle = module?.name || 'Module';

  if (loading) {
    return (
      <DashboardLayout title={pageTitle}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (!module) {
    return (
      <DashboardLayout title="Module Not Found">
        <div className="text-center py-20">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
          <h2 className="mt-4 text-lg font-medium text-gray-900">Module not found</h2>
          <p className="mt-2 text-gray-500">The module "{slug}" could not be found.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 inline-flex items-center gap-2 text-purple-600 hover:text-purple-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
        </div>
      </DashboardLayout>
    );
  }

  // Completed state
  if (session?.status === 'completed' || session?.progress.isComplete) {
    return (
      <DashboardLayout title={`${module.name} - Complete`}>
        <div className="mx-auto max-w-2xl py-12">
          <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-200 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-gray-900">
              {module.name} Complete!
            </h2>
            <p className="mt-2 text-gray-500">
              You've answered all questions in this module.
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={handleDownloadOutput}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-700"
              >
                <Download className="h-5 w-5" />
                Download Output Files
              </button>
              <button
                onClick={handleStartOver}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
              >
                Start Over
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Question flow
  const currentQuestion = session?.currentQuestion;

  return (
    <DashboardLayout title={module.name} description={module.metadata.description}>
      <div className="mx-auto max-w-2xl py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
        </div>

        {/* Progress Bar */}
        {session && (
          <div className="mb-8">
            <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
              <span>Progress</span>
              <span>
                {session.progress.answered} of {session.progress.total} questions
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-purple-600 transition-all duration-300"
                style={{ width: `${session.progress.percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
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

        {/* Current Question */}
        {currentQuestion ? (
          <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-200">
            <div className="mb-6">
              <span className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700">
                Question {(session?.progress.answered ?? 0) + 1}
              </span>
            </div>

            <h2 className="text-xl font-medium text-gray-900 mb-2">
              {currentQuestion.text}
            </h2>

            {currentQuestion.helpText && (
              <p className="text-gray-500 mb-6">{currentQuestion.helpText}</p>
            )}

            <div className="mb-8">{renderQuestionInput(currentQuestion)}</div>

            <div className="flex justify-end">
              <button
                onClick={handleSubmitAnswer}
                disabled={
                  submitting ||
                  currentAnswer === null ||
                  currentAnswer === '' ||
                  (Array.isArray(currentAnswer) && currentAnswer.length === 0)
                }
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-200 text-center">
            <p className="text-gray-500">No questions available.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
