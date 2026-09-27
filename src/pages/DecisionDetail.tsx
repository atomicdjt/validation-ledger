import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { createEntityWithGovernance, updateEntityWithGovernance, updateDecisionWithGovernance } from '../services/governance';
import { createDecisionPackage } from '../services/decisionPackage';
import { generateId } from '../utils/id';
import { ArrowLeft, Download, Plus, AlertTriangle } from 'lucide-react';
import type { Assumption, Alternative, Risk, Review, Decision } from '../db/models';
import { deleteDecisionCascade } from '../db/operations';

export function DecisionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const decision = useLiveQuery(() => db.decisions.get(id!), [id]);
  const assumptions = useLiveQuery(() => db.assumptions.where('decisionId').equals(id!).toArray(), [id]);
  const alternatives = useLiveQuery(() => db.alternatives.where('decisionId').equals(id!).toArray(), [id]);
  const risks = useLiveQuery(() => db.risks.where('decisionId').equals(id!).toArray(), [id]);
  const reviews = useLiveQuery(() => db.reviews.where('decisionId').equals(id!).toArray(), [id]);
  
  const [newAssumption, setNewAssumption] = useState('');
  const [newAlternativeTitle, setNewAlternativeTitle] = useState('');
  const [newRiskDesc, setNewRiskDesc] = useState('');

  if (decision === undefined) return <div className="p-8 text-center">Loading...</div>;
  if (decision === null) return <div className="p-8 text-center">Decision not found.</div>;

  const handleExport = async () => {
    const pkg = await createDecisionPackage(decision.id);
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decision-package-${decision.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddAssumption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssumption.trim()) return;
    const a: Assumption = {
      id: generateId(),
      projectId: decision.projectId,
      decisionId: decision.id,
      statement: newAssumption.trim(),
      status: 'unresolved'
    };
    await createEntityWithGovernance('assumptions', 'assumption', a, 'user', 'Added assumption');
    setNewAssumption('');
  };

  const handleAddAlternative = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlternativeTitle.trim()) return;
    const alt: Alternative = {
      id: generateId(),
      projectId: decision.projectId,
      decisionId: decision.id,
      title: newAlternativeTitle.trim(),
      description: '',
      status: 'considered'
    };
    await createEntityWithGovernance('alternatives', 'alternative', alt, 'user', 'Added alternative');
    setNewAlternativeTitle('');
  };

  const handleAddRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRiskDesc.trim()) return;
    const r: Risk = {
      id: generateId(),
      projectId: decision.projectId,
      decisionId: decision.id,
      description: newRiskDesc.trim(),
      severity: 'medium',
      status: 'unassessed'
    };
    await createEntityWithGovernance('risks', 'risk', r, 'user', 'Added risk');
    setNewRiskDesc('');
  };

  const updateStatus = async (status: Decision['status']) => {
    await updateDecisionWithGovernance(decision.id, { status }, 'user', `Status changed to ${status}`);
  };

  return (
    <div className="page-shell max-w-5xl">
      <header className="mb-6">
        <Link to="/decisions" className="inline-flex items-center text-sm font-medium text-surface-500 hover:text-surface-900 mb-4">
          <ArrowLeft size={16} className="mr-1" /> Back to Decisions
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 mb-2">{decision.title}</h1>
            <div className="flex items-center gap-3 text-sm">
              <span className="bg-surface-100 px-2 py-1 rounded capitalize font-medium">{decision.status}</span>
              <span className="text-surface-500">{new Date(decision.createdAt).toLocaleDateString()}</span>
              {decision.integrityHash && (
                 <span className="font-mono text-xs text-surface-400 bg-surface-50 px-2 py-1 rounded" title="Tamper-evident hash">
                    {decision.integrityHash.substring(0,8)}...
                 </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExport} className="button-secondary">
              <Download size={16} className="mr-2" /> Export Package
            </button>
            <button onClick={async () => {
              if (confirm('Delete decision?')) {
                await deleteDecisionCascade(decision.id);
                navigate('/decisions');
              }
            }} className="button-secondary text-red-600 hover:bg-red-50 hover:border-red-200">
              Delete
            </button>
          </div>
        </div>
      </header>

      {decision.needsAttention && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-md text-amber-800 flex items-start gap-3">
          <AlertTriangle className="shrink-0 mt-0.5 text-amber-600" />
          <div>
            <h3 className="font-bold">Downstream Impact Warning</h3>
            <p className="text-sm">Underlying evidence linked to this decision has been superseded, contradicted, or invalidated. Please review the assumptions and evidence.</p>
            <button onClick={() => updateDecisionWithGovernance(decision.id, { needsAttention: false }, 'user', 'Acknowledged downstream impact')} className="mt-2 text-sm underline hover:text-amber-900">
              Acknowledge and dismiss
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <section className="panel p-5">
            <h2 className="text-lg font-semibold mb-3">Rationale</h2>
            <p className="text-surface-700 whitespace-pre-wrap">{decision.reason || 'No reasoning provided.'}</p>
          </section>

          <section className="panel p-5">
            <h2 className="text-lg font-semibold mb-3">Assumptions</h2>
            <ul className="space-y-2 mb-4">
              {assumptions?.map(a => (
                <li key={a.id} className="flex items-center justify-between p-3 bg-surface-50 rounded border border-surface-200">
                  <span className="text-sm font-medium">{a.statement}</span>
                  <select 
                    value={a.status} 
                    onChange={e => updateEntityWithGovernance<Assumption>('assumptions', 'assumption', a.id, { status: e.target.value as any }, 'user', 'Updated assumption status')}
                    className="text-xs p-1 rounded border-surface-200"
                  >
                    <option value="unresolved">Unresolved</option>
                    <option value="validated">Validated</option>
                    <option value="invalidated">Invalidated</option>
                  </select>
                </li>
              ))}
              {assumptions?.length === 0 && <li className="text-sm text-surface-500">No explicit assumptions.</li>}
            </ul>
            <form onSubmit={handleAddAssumption} className="flex gap-2">
              <input type="text" value={newAssumption} onChange={e => setNewAssumption(e.target.value)} placeholder="New assumption..." className="field-control flex-1 text-sm" />
              <button type="submit" className="button-secondary p-2"><Plus size={16} /></button>
            </form>
          </section>

          <section className="panel p-5">
            <h2 className="text-lg font-semibold mb-3">Alternatives Considered</h2>
            <ul className="space-y-2 mb-4">
              {alternatives?.map(a => (
                <li key={a.id} className="flex items-center justify-between p-3 bg-surface-50 rounded border border-surface-200">
                  <span className="text-sm font-medium">{a.title}</span>
                  <select 
                    value={a.status} 
                    onChange={e => updateEntityWithGovernance<Alternative>('alternatives', 'alternative', a.id, { status: e.target.value as any }, 'user', 'Updated alternative status')}
                    className="text-xs p-1 rounded border-surface-200"
                  >
                    <option value="considered">Considered</option>
                    <option value="rejected">Rejected</option>
                    <option value="selected">Selected</option>
                  </select>
                </li>
              ))}
              {alternatives?.length === 0 && <li className="text-sm text-surface-500">No alternatives recorded.</li>}
            </ul>
            <form onSubmit={handleAddAlternative} className="flex gap-2">
              <input type="text" value={newAlternativeTitle} onChange={e => setNewAlternativeTitle(e.target.value)} placeholder="Alternative..." className="field-control flex-1 text-sm" />
              <button type="submit" className="button-secondary p-2"><Plus size={16} /></button>
            </form>
          </section>

          <section className="panel p-5">
            <h2 className="text-lg font-semibold mb-3">Risks</h2>
            <ul className="space-y-2 mb-4">
              {risks?.map(r => (
                <li key={r.id} className="flex flex-col gap-2 p-3 bg-surface-50 rounded border border-surface-200">
                  <span className="text-sm font-medium">{r.description}</span>
                  <div className="flex justify-between items-center">
                    <select 
                      value={r.severity} 
                      onChange={e => updateEntityWithGovernance<Risk>('risks', 'risk', r.id, { severity: e.target.value as any }, 'user', 'Updated risk severity')}
                      className="text-xs p-1 rounded border-surface-200"
                    >
                      <option value="low">Low Severity</option>
                      <option value="medium">Medium Severity</option>
                      <option value="high">High Severity</option>
                    </select>
                    <select 
                      value={r.status} 
                      onChange={e => updateEntityWithGovernance<Risk>('risks', 'risk', r.id, { status: e.target.value as any }, 'user', 'Updated risk status')}
                      className="text-xs p-1 rounded border-surface-200"
                    >
                      <option value="unassessed">Unassessed</option>
                      <option value="mitigated">Mitigated</option>
                      <option value="accepted">Accepted</option>
                    </select>
                  </div>
                </li>
              ))}
              {risks?.length === 0 && <li className="text-sm text-surface-500">No risks identified.</li>}
            </ul>
            <form onSubmit={handleAddRisk} className="flex gap-2">
              <input type="text" value={newRiskDesc} onChange={e => setNewRiskDesc(e.target.value)} placeholder="Describe a risk..." className="field-control flex-1 text-sm" />
              <button type="submit" className="button-secondary p-2"><Plus size={16} /></button>
            </form>
          </section>
        </div>

        <div className="space-y-6">
          <section className="panel p-5">
            <h2 className="text-sm font-semibold uppercase text-surface-500 mb-4">Governance State</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Decision Status</label>
                <select value={decision.status} onChange={e => updateStatus(e.target.value as any)} className="field-control w-full text-sm">
                  <option value="proposed">Proposed</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="reverted">Reverted</option>
                  <option value="validated">Validated</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Confidence</label>
                <select value={decision.confidence} onChange={e => updateDecisionWithGovernance(decision.id, { confidence: e.target.value as any }, 'user', 'Updated confidence')} className="field-control w-full text-sm">
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-sm font-semibold uppercase text-surface-500 mb-4">Review Workflow</h2>
            {reviews?.length === 0 ? (
               <p className="text-sm text-surface-500 mb-3">No reviews requested.</p>
            ) : (
               <ul className="space-y-3 mb-4">
                 {reviews?.map(r => (
                   <li key={r.id} className="text-sm bg-surface-50 p-2 rounded border border-surface-200">
                     <div className="font-medium">{r.reviewer}</div>
                     <div className="text-xs text-surface-500">{new Date(r.date).toLocaleDateString()} &middot; {r.status}</div>
                   </li>
                 ))}
               </ul>
            )}
            <button onClick={() => {
              const reviewer = prompt('Reviewer name:');
              if (reviewer) {
                createEntityWithGovernance('reviews', 'review', { id: generateId(), projectId: decision.projectId, decisionId: decision.id, reviewer, status: 'requested', comments: '', date: Date.now() }, 'user', 'Requested review');
              }
            }} className="button-secondary w-full text-sm justify-center">
              Request Review
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
