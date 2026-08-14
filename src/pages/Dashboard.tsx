import { useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  FileText,
  HelpCircle,
  Lightbulb,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { QuestionGenerator } from '../components/QuestionGenerator';
import { db } from '../db/db';
import { Hypothesis } from '../db/models';
import { calculateScore, HypothesisAnalysis, updateAllHypothesisScores } from '../services/scoring';
import { useStore } from '../store/useStore';

const importanceWeight: Record<Hypothesis['importance'], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function priorityClasses(importance: Hypothesis['importance']) {
  if (importance === 'critical') return 'bg-red-50 text-red-700 ring-red-100';
  if (importance === 'high') return 'bg-orange-50 text-orange-700 ring-orange-100';
  if (importance === 'medium') return 'bg-amber-50 text-amber-700 ring-amber-100';
  return 'bg-surface-100 text-surface-600 ring-surface-200';
}

export function Dashboard() {
  const activeProjectId = useStore((state) => state.activeProjectId);
  const navigate = useNavigate();
  const project = useLiveQuery(() => (activeProjectId ? db.projects.get(activeProjectId) : undefined), [activeProjectId]);
  const hypotheses = useLiveQuery(
    () => (activeProjectId ? db.hypotheses.where('projectId').equals(activeProjectId).toArray() : []),
    [activeProjectId],
  );
  const sources = useLiveQuery(
    () => (activeProjectId ? db.sources.where('projectId').equals(activeProjectId).toArray() : []),
    [activeProjectId],
  );
  const evidence = useLiveQuery(
    () => (activeProjectId ? db.evidenceSignals.where('projectId').equals(activeProjectId).toArray() : []),
    [activeProjectId],
  );

  const analyses = useMemo(() => {
    const result: Record<string, HypothesisAnalysis> = {};
    for (const hypothesis of hypotheses ?? []) {
      result[hypothesis.id] = {
        hypothesisId: hypothesis.id,
        ...calculateScore((evidence ?? []).filter((signal) => signal.hypothesisId === hypothesis.id)),
      };
    }
    return result;
  }, [evidence, hypotheses]);

  useEffect(() => {
    if (!activeProjectId || evidence === undefined) return;
    void updateAllHypothesisScores(activeProjectId);
  }, [activeProjectId, evidence]);

  if (!activeProjectId) {
    return <div className="py-12 text-center text-surface-500">Please select a project first.</div>;
  }

  const validationGaps = (hypotheses ?? [])
    .filter((hypothesis) => ['unvalidated', 'weak-evidence', 'mixed'].includes(analyses[hypothesis.id]?.status))
    .slice()
    .sort((a, b) => importanceWeight[b.importance] - importanceWeight[a.importance] || analyses[a.id].score - analyses[b.id].score)
    .slice(0, 4);

  const mostContradicted = (hypotheses ?? [])
    .filter((hypothesis) => analyses[hypothesis.id]?.contradictingCount > 0)
    .slice()
    .sort((a, b) => analyses[b.id].contradictingCount - analyses[a.id].contradictingCount)[0];
  const contradictionSignal = mostContradicted
    ? (evidence ?? []).find((signal) => signal.hypothesisId === mostContradicted.id && signal.relationship === 'contradicts')
    : undefined;

  const metrics = [
    { label: 'Sources', value: sources?.length ?? 0, icon: FileText, tone: 'text-primary-700 bg-primary-50' },
    { label: 'Hypotheses', value: hypotheses?.length ?? 0, icon: Lightbulb, tone: 'text-primary-700 bg-primary-50' },
    { label: 'Evidence Signals', value: evidence?.length ?? 0, icon: Activity, tone: 'text-primary-700 bg-primary-50' },
    {
      label: 'Strong Support',
      value: hypotheses?.filter((hypothesis) => analyses[hypothesis.id]?.status === 'strongly-supported').length ?? 0,
      icon: CheckCircle2,
      tone: 'text-emerald-700 bg-emerald-50',
    },
  ];

  return (
    <div className="page-shell">
      <header>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-description">{project?.validationObjective || 'A clear view of what your evidence supports, contradicts, and leaves unresolved.'}</p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label="Project metrics">
        {metrics.map((metric) => (
          <div key={metric.label} className="panel flex items-center gap-3 p-4 sm:gap-4 sm:p-5">
            <span className={`hidden size-11 shrink-0 items-center justify-center rounded-xl sm:flex ${metric.tone}`}>
              <metric.icon size={22} strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-surface-500">{metric.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-surface-950">{metric.value}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]">
        <section className="panel overflow-hidden">
          <div className="panel-header">
            <div className="flex items-center gap-2.5">
              <HelpCircle size={20} className="text-orange-500" />
              <h2 className="font-semibold text-surface-950">Validation Gaps</h2>
            </div>
            <span className="text-xs font-medium text-surface-400">Ordered by priority</span>
          </div>

          {validationGaps.length > 0 ? (
            <div className="divide-y divide-surface-200">
              {validationGaps.map((gap) => {
                const analysis = analyses[gap.id];
                const unresolvedReasons = [
                  analysis.uniqueSourcesCount < 3 ? `Only ${analysis.uniqueSourcesCount} independent source${analysis.uniqueSourcesCount === 1 ? '' : 's'}` : null,
                  !analysis.evidenceQuality.hasBehavioralEvidence ? 'No behavioral or pricing evidence' : null,
                  analysis.contradictingCount > 0 ? `${analysis.contradictingCount} contradicting signal${analysis.contradictingCount === 1 ? '' : 's'}` : null,
                ].filter(Boolean);

                return (
                  <article key={gap.id} className="grid gap-3 px-4 py-5 transition-colors hover:bg-surface-50 sm:grid-cols-[92px_minmax(0,1fr)_minmax(210px,0.9fr)] sm:px-5">
                    <div>
                      <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ring-1 ring-inset ${priorityClasses(gap.importance)}`}>
                        {gap.importance}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-6 text-surface-900">{gap.statement}</p>
                      <p className="mt-1 text-xs font-medium text-surface-400">Confidence {analysis.score}/100</p>
                    </div>
                    <ul className="space-y-1 text-xs leading-5 text-surface-600">
                      {unresolvedReasons.map((reason) => (
                        <li key={reason} className="flex gap-2">
                          <span className="mt-2 size-1 shrink-0 rounded-full bg-surface-400" />
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="px-6 py-14 text-center">
              <CheckCircle2 className="mx-auto text-emerald-500" size={34} />
              <p className="mt-3 font-semibold text-surface-900">No unresolved hypotheses</p>
              <p className="mt-1 text-sm text-surface-500">All current hypotheses have a clear outcome.</p>
            </div>
          )}
        </section>

        <div className="space-y-5">
          <section className="panel overflow-hidden">
            <div className="panel-header">
              <div className="flex items-center gap-2.5">
                <CircleAlert size={20} className="text-red-500" />
                <h2 className="font-semibold text-surface-950">Contradiction Engine</h2>
              </div>
            </div>
            {mostContradicted ? (
              <div>
                <div className="p-5">
                  <p className="font-semibold leading-6 text-surface-900">{mostContradicted.statement}</p>
                  <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-lg border border-surface-200 text-sm font-semibold">
                    <div className="px-3 py-2.5 text-emerald-700">{analyses[mostContradicted.id].supportingCount} Supporting</div>
                    <div className="border-l border-surface-200 px-3 py-2.5 text-red-700">{analyses[mostContradicted.id].contradictingCount} Contradicting</div>
                  </div>
                  {contradictionSignal ? (
                    <blockquote className="mt-4 border-l-2 border-red-300 pl-4 text-sm leading-6 text-surface-600">
                      “{contradictionSignal.exactExcerpt || contradictionSignal.statement}”
                    </blockquote>
                  ) : null}
                </div>
                <button type="button" onClick={() => navigate('/sources')} className="flex w-full items-center justify-between border-t border-surface-200 px-5 py-3 text-sm font-semibold text-primary-700 hover:bg-primary-50">
                  Review contradictory evidence
                  <ArrowRight size={17} />
                </button>
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <CheckCircle2 className="mx-auto text-emerald-500" size={32} />
                <p className="mt-3 text-sm font-medium text-surface-600">No contradicting evidence found.</p>
              </div>
            )}
          </section>

          <QuestionGenerator validationGaps={validationGaps.slice(0, 3)} />
        </div>
      </div>
    </div>
  );
}
