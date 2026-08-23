import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useStore } from '../store/useStore';
import { generateId } from '../utils/id';
import { Plus, Trash2, Link } from 'lucide-react';
import type { Decision } from '../db/models';
import { deleteDecisionCascade } from '../db/operations';
import { analytics } from '../services/analytics';

export function Decisions() {
  const activeProjectId = useStore(state => state.activeProjectId);
  const decisions = useLiveQuery(
    () => activeProjectId ? db.decisions.where('projectId').equals(activeProjectId).reverse().sortBy('createdAt') : [],
    [activeProjectId]
  );

  const hypotheses = useLiveQuery(
    () => activeProjectId ? db.hypotheses.where('projectId').equals(activeProjectId).toArray() : [],
    [activeProjectId]
  );
  const evidence = useLiveQuery(
    () => activeProjectId ? db.evidenceSignals.where('projectId').equals(activeProjectId).reverse().sortBy('createdAt') : [],
    [activeProjectId],
  );

  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [confidence, setConfidence] = useState<Decision['confidence']>('moderate');
  const [selectedHypotheses, setSelectedHypotheses] = useState<string[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !activeProjectId) return;

    const newDecision: Decision = {
      id: generateId(),
      projectId: activeProjectId,
      title: title.trim(),
      description: description.trim(),
      reason: reason.trim(),
      confidence,
      createdAt: Date.now(),
    };

    await db.transaction('rw', db.decisions, db.hypothesisDecisionLinks, db.evidenceDecisionLinks, async () => {
      await db.decisions.add(newDecision);
      for (const hId of selectedHypotheses) {
        await db.hypothesisDecisionLinks.add({
          id: generateId(),
          projectId: activeProjectId,
          hypothesisId: hId,
          decisionId: newDecision.id
        });
      }
      for (const evidenceId of selectedEvidence) {
        await db.evidenceDecisionLinks.add({ id: generateId(), projectId: activeProjectId, evidenceId, decisionId: newDecision.id });
      }
    });
    analytics.track('decision_created', {
      confidence,
      linked_evidence_count: selectedEvidence.length,
      linked_hypothesis_count: selectedHypotheses.length,
    });

    setIsCreating(false);
    setTitle('');
    setDescription('');
    setReason('');
    setConfidence('moderate');
    setSelectedHypotheses([]);
    setSelectedEvidence([]);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this decision?')) {
      await deleteDecisionCascade(id);
    }
  };

  const toggleHypothesis = (id: string) => {
    setSelectedHypotheses(prev =>
      prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id]
    );
  };
  const toggleEvidence = (id: string) => setSelectedEvidence((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]);

  if (!activeProjectId) {
    return <div className="text-center py-12 text-surface-500">Please select a project first.</div>;
  }

  return (
    <div className="page-shell max-w-5xl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Decision Journal</h1>
          <p className="page-description">Record what changed, why it changed, and which assumptions informed the call.</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="button-primary"
        >
          <Plus size={20} />
          Record Decision
        </button>
      </header>

      {isCreating && (
        <section className="panel p-5 sm:p-6">
          <h2 className="text-lg font-semibold mb-4 text-surface-900">Record New Decision</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="decision-title" className="block text-sm font-medium text-surface-700 mb-1">Decision Title *</label>
              <input
                id="decision-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="field-control"
                placeholder="e.g. Prioritize iframe + GoHighLevel integration"
              />
            </div>

            <div>
              <label htmlFor="decision-summary" className="field-label">Decision Summary</label>
              <textarea
                id="decision-summary"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="field-control min-h-20 resize-y"
                placeholder="What is changing?"
              />
            </div>

            <div>
              <label htmlFor="decision-reason" className="block text-sm font-medium text-surface-700 mb-1">Reasoning</label>
              <textarea
                id="decision-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="field-control min-h-24 resize-y"
                placeholder="Why was this decision made?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-2">Link Hypotheses</label>
              <div className="max-h-48 overflow-y-auto border border-surface-200 rounded-md p-2 space-y-1">
                {hypotheses?.length === 0 && (
                  <div className="text-sm text-surface-500 p-2">No hypotheses available to link.</div>
                )}
                {hypotheses?.map(h => (
                  <label key={h.id} className="flex items-start gap-2 p-2 hover:bg-surface-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedHypotheses.includes(h.id)}
                      onChange={() => toggleHypothesis(h.id)}
                      className="mt-1 rounded text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-surface-900">{h.statement}</div>
                      <div className="text-xs text-surface-500 uppercase">{h.category} • {h.status}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-2">Link Evidence</label>
              <p className="mb-2 text-xs text-surface-500">Attach the source-backed observations that materially informed this decision.</p>
              <div className="max-h-56 overflow-y-auto rounded-md border border-surface-200 p-2 space-y-1">
                {evidence?.length === 0 && <div className="p-2 text-sm text-surface-500">No evidence available to link.</div>}
                {evidence?.map((item) => (
                  <label key={item.id} className="flex items-start gap-2 rounded p-2 hover:bg-surface-50 cursor-pointer">
                    <input type="checkbox" checked={selectedEvidence.includes(item.id)} onChange={() => toggleEvidence(item.id)} className="mt-1 rounded text-primary-600 focus:ring-primary-500" />
                    <span><span className="block text-sm font-medium text-surface-900">{item.statement}</span><span className="block text-xs text-surface-500">{item.relationship} · {item.provenanceState ?? 'unverified'} provenance</span></span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="decision-confidence" className="block text-sm font-medium text-surface-700 mb-1">Confidence in Decision</label>
              <select
                id="decision-confidence"
                value={confidence}
                onChange={(e) => setConfidence(e.target.value as Decision['confidence'])}
                className="field-control w-full md:w-1/3"
              >
                <option value="low">Low (Reversible experiment)</option>
                <option value="moderate">Moderate (Likely correct)</option>
                <option value="high">High (Strong evidence)</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="button-primary"
              >
                Record Decision
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="button-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-surface-200 before:to-transparent">
        {decisions?.map((d) => (
          <div key={d.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-surface-100 text-surface-500 group-[.is-active]:bg-primary-100 group-[.is-active]:text-primary-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
              <ScaleIcon size={20} />
            </div>

            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-surface-200 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <time className="text-xs font-medium uppercase text-primary-600 tracking-wider">
                  {new Date(d.createdAt).toLocaleDateString()}
                </time>
                <button onClick={() => handleDelete(d.id)} className="text-surface-400 hover:text-red-500 p-1 rounded">
                  <Trash2 size={16} />
                </button>
              </div>
              <h3 className="font-semibold text-surface-900 text-lg mb-1">{d.title}</h3>
              {d.reason && <p className="text-sm text-surface-600 mb-3">{d.reason}</p>}

              <div className="mt-4 pt-3 border-t border-surface-100 flex justify-between items-center text-sm">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                  d.confidence === 'high' ? 'bg-green-100 text-green-700' :
                  d.confidence === 'moderate' ? 'bg-blue-100 text-blue-700' :
                  'bg-orange-100 text-orange-700'
                }`}>
                  {d.confidence} Confidence
                </span>

                <DecisionLinks decisionId={d.id} />
              </div>
            </div>
          </div>
        ))}

        {decisions?.length === 0 && !isCreating && (
          <div className="py-12 text-center text-surface-500 w-full relative z-10 bg-surface-50">
            <p>No decisions recorded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ScaleIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18"/><path d="m3 7 9-4 9 4"/><path d="M3 7v10c0 1.1.9 2 2 2h4"/><path d="M21 7v10c0 1.1-.9 2-2 2h-4"/><path d="M12 17h-2"/><path d="M12 17h2"/>
    </svg>
  );
}

function DecisionLinks({ decisionId }: { decisionId: string }) {
  const links = useLiveQuery(async () => {
    const [hypotheses, evidence] = await Promise.all([
      db.hypothesisDecisionLinks.where('decisionId').equals(decisionId).toArray(),
      db.evidenceDecisionLinks.where('decisionId').equals(decisionId).toArray(),
    ]);
    return { hypotheses, evidence };
  }, [decisionId]);

  if (!links || links.hypotheses.length + links.evidence.length === 0) return null;

  return (
    <div className="flex items-center gap-1 text-surface-500" title={`${links.hypotheses.length} hypotheses and ${links.evidence.length} evidence signals linked`}>
      <Link size={14} />
      <span className="text-xs">{links.hypotheses.length + links.evidence.length}</span>
    </div>
  );
}
