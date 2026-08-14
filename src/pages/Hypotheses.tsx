import { FormEvent, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertCircle, CheckCircle2, Edit2, Lightbulb, Plus, Trash2, X, XCircle } from 'lucide-react';
import { db } from '../db/db';
import type { Hypothesis } from '../db/models';
import { useStore } from '../store/useStore';
import { generateId } from '../utils/id';

export function Hypotheses() {
  const activeProjectId = useStore((state) => state.activeProjectId);
  const hypotheses = useLiveQuery(
    () => (activeProjectId ? db.hypotheses.where('projectId').equals(activeProjectId).toArray() : []),
    [activeProjectId],
    [],
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statement, setStatement] = useState('');
  const [category, setCategory] = useState('');
  const [importance, setImportance] = useState<Hypothesis['importance']>('medium');

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setStatement('');
    setCategory('');
    setImportance('medium');
  };

  const openCreate = () => {
    resetForm();
    setIsEditing(true);
  };

  const openEdit = (hypothesis: Hypothesis) => {
    setEditingId(hypothesis.id);
    setStatement(hypothesis.statement);
    setCategory(hypothesis.category);
    setImportance(hypothesis.importance);
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!statement.trim() || !activeProjectId) return;
    if (editingId) {
      await db.hypotheses.update(editingId, {
        statement: statement.trim(),
        category: category.trim() || 'General',
        importance,
        lastReviewed: Date.now(),
      });
    } else {
      await db.hypotheses.add({
        id: generateId(),
        projectId: activeProjectId,
        statement: statement.trim(),
        category: category.trim() || 'General',
        importance,
        status: 'unvalidated',
        confidenceScore: 0,
        createdAt: Date.now(),
      });
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this hypothesis? Evidence will remain but be unlinked, and decision links will be removed.')) return;
    await db.transaction('rw', db.hypotheses, db.evidenceSignals, db.hypothesisDecisionLinks, async () => {
      await db.evidenceSignals.where('hypothesisId').equals(id).modify({ hypothesisId: null, relationship: undefined });
      await db.hypothesisDecisionLinks.where('hypothesisId').equals(id).delete();
      await db.hypotheses.delete(id);
    });
  };

  if (!activeProjectId) return <div className="py-12 text-center text-surface-500">Please select a project first.</div>;

  const statusIcon = (status: Hypothesis['status']) => {
    if (status === 'validated') return <CheckCircle2 className="text-emerald-600" size={17} />;
    if (status === 'invalidated') return <XCircle className="text-red-600" size={17} />;
    return <AlertCircle className={status === 'validating' ? 'text-primary-600' : 'text-surface-400'} size={17} />;
  };

  return (
    <div className="page-shell">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Hypotheses</h1>
          <p className="page-description">Track the assumptions that must survive contact with real customer evidence.</p>
        </div>
        <button type="button" onClick={isEditing ? resetForm : openCreate} className={isEditing ? 'button-secondary' : 'button-primary'}>
          {isEditing ? <X size={18} /> : <Plus size={18} />}
          {isEditing ? 'Cancel' : 'Add Hypothesis'}
        </button>
      </header>

      {isEditing ? (
        <section className="panel p-5 sm:p-6">
          <h2 className="text-lg font-bold text-surface-950">{editingId ? 'Edit hypothesis' : 'New hypothesis'}</h2>
          <form onSubmit={handleSubmit} className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto] lg:items-end">
            <label>
              <span className="field-label">Hypothesis statement</span>
              <textarea required value={statement} onChange={(event) => setStatement(event.target.value)} className="field-control min-h-24 resize-y" placeholder="What must be true for this product to work?" autoFocus />
            </label>
            <label>
              <span className="field-label">Category</span>
              <input value={category} onChange={(event) => setCategory(event.target.value)} className="field-control" placeholder="Pricing, audience, behavior…" />
            </label>
            <label>
              <span className="field-label">Importance</span>
              <select value={importance} onChange={(event) => setImportance(event.target.value as Hypothesis['importance'])} className="field-control">
                <option value="low">Low · Nice to have</option>
                <option value="medium">Medium · Important</option>
                <option value="high">High · Core value</option>
                <option value="critical">Critical · Make or break</option>
              </select>
            </label>
            <button type="submit" className="button-primary">{editingId ? 'Save Changes' : 'Add Hypothesis'}</button>
          </form>
        </section>
      ) : null}

      <section className="panel overflow-hidden">
        {hypotheses.length > 0 ? (
          <div className="divide-y divide-surface-200">
            {hypotheses.map((hypothesis) => (
              <article key={hypothesis.id} className="group flex items-start gap-4 px-4 py-5 transition-colors hover:bg-surface-50 sm:px-5">
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                  <Lightbulb size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.08em]">
                    <span className="rounded-md bg-surface-100 px-2 py-1 text-surface-600">{hypothesis.category}</span>
                    <span className="rounded-md bg-primary-50 px-2 py-1 text-primary-700">{hypothesis.importance}</span>
                  </div>
                  <h2 className="mt-3 text-base font-semibold leading-6 text-surface-950">{hypothesis.statement}</h2>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-surface-500">
                    <span className="flex items-center gap-1.5 capitalize">{statusIcon(hypothesis.status)} {hypothesis.status}</span>
                    <span className="font-semibold text-surface-600">Confidence {hypothesis.confidenceScore}/100</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <button type="button" onClick={() => openEdit(hypothesis)} className="icon-button hover:bg-primary-50 hover:text-primary-700" aria-label={`Edit ${hypothesis.statement}`}><Edit2 size={17} /></button>
                  <button type="button" onClick={() => void handleDelete(hypothesis.id)} className="icon-button hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${hypothesis.statement}`}><Trash2 size={17} /></button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="px-6 py-14 text-center">
            <Lightbulb className="mx-auto text-surface-300" size={36} />
            <p className="mt-3 font-semibold text-surface-800">No hypotheses yet</p>
            <p className="mt-1 text-sm text-surface-500">Record the assumptions that could change what you build.</p>
          </div>
        )}
      </section>
    </div>
  );
}
