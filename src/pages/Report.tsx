import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useStore } from '../store/useStore';
import { Printer } from 'lucide-react';
import { calculateScore, HypothesisAnalysis } from '../services/scoring';
import { EvidenceMatrix } from '../components/EvidenceMatrix';

function EvidenceExcerpt({ excerpt, provenanceState }: { excerpt: string; provenanceState: 'exact' | 'normalized' | 'unverified' }) {
  if (provenanceState === 'unverified') return <p className="text-sm leading-6 text-surface-600">Inference only — no verified source quote is available.</p>;
  return <p className="font-medium text-surface-900 mb-1">“{excerpt}” <span className="ml-1 text-xs font-semibold uppercase tracking-wide text-surface-500">{provenanceState} match</span></p>;
}

export function Report() {
  const activeProjectId = useStore(state => state.activeProjectId);
  const project = useLiveQuery(() => activeProjectId ? db.projects.get(activeProjectId) : undefined, [activeProjectId]);
  const hypotheses = useLiveQuery(() => activeProjectId ? db.hypotheses.where('projectId').equals(activeProjectId).toArray() : [], [activeProjectId], []);
  const sources = useLiveQuery(() => activeProjectId ? db.sources.where('projectId').equals(activeProjectId).toArray() : [], [activeProjectId], []);
  const evidence = useLiveQuery(() => activeProjectId ? db.evidenceSignals.where('projectId').equals(activeProjectId).toArray() : [], [activeProjectId], []);
  const decisions = useLiveQuery(() => activeProjectId ? db.decisions.where('projectId').equals(activeProjectId).toArray() : [], [activeProjectId], []);

  const analyses = useMemo(() => {
    const result: Record<string, HypothesisAnalysis> = {};
    for (const hypothesis of hypotheses) {
      result[hypothesis.id] = {
        hypothesisId: hypothesis.id,
        ...calculateScore(evidence.filter((signal) => signal.hypothesisId === hypothesis.id)),
      };
    }
    return result;
  }, [evidence, hypotheses]);

  if (!activeProjectId) {
    return <div className="text-center py-12 text-surface-500">Please select a project first.</div>;
  }

  const printReport = () => {
    window.print();
  };

  const pricingEvidence = evidence.filter(e => e.classification === 'willingness_to_pay');

  // Categorize hypotheses based on validation
  const validated = hypotheses.filter(h => analyses[h.id]?.status === 'strongly-supported' || analyses[h.id]?.status === 'moderately-supported');
  const weak = hypotheses.filter(h => analyses[h.id]?.status === 'unvalidated' || analyses[h.id]?.status === 'weak-evidence' || analyses[h.id]?.status === 'mixed');
  const contradicted = hypotheses.filter(h => analyses[h.id]?.status === 'contradicted');

  return (
    <div className="page-shell max-w-5xl pb-24 print:pb-0">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="page-title">Validation Report</h1>
          <p className="page-description">A portable, evidence-backed summary of the current validation state.</p>
        </div>
        <button
          onClick={printReport}
          className="button-secondary"
        >
          <Printer size={20} />
          Print / Save PDF
        </button>
      </div>

      <div className="panel p-5 sm:p-8 lg:p-10 print:shadow-none print:border-none print:p-0">
        <header className="mb-10 border-b border-surface-200 pb-8">
          <h1 className="text-3xl font-extrabold text-surface-900 mb-2">{project?.name || 'Validation Project'}</h1>
          <p className="text-lg text-surface-600 mb-4">{project?.productDescription}</p>
          <div className="bg-surface-50 p-4 rounded-lg">
            <h3 className="font-semibold text-surface-900 mb-1">Research Objective</h3>
            <p className="text-surface-700">{project?.validationObjective || 'Not specified'}</p>
          </div>
          <div className="mt-4 flex gap-6 text-sm text-surface-500">
            <div><strong>Sources:</strong> {sources?.length || 0}</div>
            <div><strong>Evidence Points:</strong> {evidence?.length || 0}</div>
            <div><strong>Report Date:</strong> {new Date().toLocaleDateString()}</div>
          </div>
        </header>

        <section className="mb-10">
          <h2 className="text-xl font-bold text-surface-900 border-b border-surface-200 pb-2 mb-4">1. Supported Hypotheses</h2>
          {validated.length > 0 ? (
            <div className="space-y-4">
              {validated.map(h => (
                <div key={h.id} className="p-4 bg-green-50/50 border border-green-100 rounded-lg">
                  <h3 className="font-semibold text-surface-900">{h.statement}</h3>
                  <div className="mt-2 text-sm text-surface-700">
                    Support score: {analyses[h.id]?.score}/100 • {analyses[h.id]?.uniqueSupportingSourcesCount} independent supporting source{analyses[h.id]?.uniqueSupportingSourcesCount === 1 ? '' : 's'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-surface-500 italic">No hypotheses have moderate or strong support yet.</p>
          )}
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold text-surface-900 border-b border-surface-200 pb-2 mb-4">2. Contradicted Hypotheses</h2>
          {contradicted.length > 0 ? (
            <div className="space-y-4">
              {contradicted.map(h => (
                <div key={h.id} className="p-4 bg-red-50/50 border border-red-100 rounded-lg">
                  <h3 className="font-semibold text-surface-900">{h.statement}</h3>
                  <div className="mt-2 text-sm text-surface-700">
                    {analyses[h.id]?.uniqueContradictingSourcesCount} independent contradicting source{analyses[h.id]?.uniqueContradictingSourcesCount === 1 ? '' : 's'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-surface-500 italic">No hypotheses have been strongly contradicted.</p>
          )}
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold text-surface-900 border-b border-surface-200 pb-2 mb-4">3. Evidence Matrix</h2>
          <EvidenceMatrix />
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold text-surface-900 border-b border-surface-200 pb-2 mb-4">4. Pricing Evidence</h2>
          {pricingEvidence.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {pricingEvidence.map(e => (
                <div key={e.id} className="p-4 border border-surface-200 rounded-lg text-sm">
                  <EvidenceExcerpt excerpt={e.exactExcerpt} provenanceState={e.provenanceState ?? 'unverified'} />
                  <p className="text-surface-500">— Participant from {sources?.find(s => s.id === e.sourceId)?.type}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-surface-500 italic">No pricing evidence gathered yet.</p>
          )}
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold text-surface-900 border-b border-surface-200 pb-2 mb-4">5. Key Decisions Made</h2>
          {decisions && decisions.length > 0 ? (
            <div className="space-y-6">
              {decisions.map(d => (
                <div key={d.id}>
                  <h3 className="font-semibold text-surface-900 mb-1">{d.title}</h3>
                  <p className="text-sm text-surface-700">{d.reason}</p>
                  <div className="text-xs text-surface-500 mt-1 uppercase tracking-wider">Decision confidence: {d.confidence}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-surface-500 italic">No decisions recorded.</p>
          )}
        </section>

        <section>
          <h2 className="text-xl font-bold text-surface-900 border-b border-surface-200 pb-2 mb-4">6. Unresolved / Next Steps</h2>
          {weak.length > 0 ? (
            <ul className="list-disc pl-5 space-y-2 text-surface-700">
              {weak.map(h => (
                <li key={h.id}>
                  <span className="font-medium">{h.statement}</span>
                  <div className="text-sm text-surface-500 mt-0.5">Needs more evidence (support score {analyses[h.id]?.score}/100)</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-surface-500 italic">All current hypotheses resolved.</p>
          )}
        </section>

      </div>
    </div>
  );
}
