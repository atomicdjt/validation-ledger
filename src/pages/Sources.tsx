import { FormEvent, MouseEvent, useDeferredValue, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays, FileText, Plus, Search, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import type { Source } from '../db/models';
import { useStore } from '../store/useStore';
import { generateId } from '../utils/id';
import { deleteSourceCascade } from '../db/operations';
import { analytics } from '../services/analytics';

export function Sources() {
  const activeProjectId = useStore((state) => state.activeProjectId);
  const sources = useLiveQuery(
    () => (activeProjectId ? db.sources.where('projectId').equals(activeProjectId).reverse().sortBy('date') : []),
    [activeProjectId],
    [],
  );
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [participantId, setParticipantId] = useState('');
  const [type, setType] = useState<Source['type']>('interview');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionLock = useRef(false);

  const visibleSources = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    if (!normalizedQuery) return sources;
    return sources.filter((source) =>
      source.participantId.toLowerCase().includes(normalizedQuery)
      || source.type.replace('_', ' ').includes(normalizedQuery)
      || source.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery)),
    );
  }, [deferredQuery, sources]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeProjectId) return;
    const form = event.currentTarget as HTMLFormElement;
    if (form.dataset.submitting === 'true' || isSubmitting || submissionLock.current) return;

    form.dataset.submitting = 'true';
    submissionLock.current = true;
    setIsSubmitting(true);
    let succeeded = false;
    try {
      const newSource: Source = {
        id: generateId(),
        projectId: activeProjectId,
        participantId: participantId.trim() || 'Anonymous',
        segmentId: null,
        date: new Date(`${date}T12:00:00`).getTime(),
        type,
        rawText: '',
        metadata: {},
        tags: [],
      };
      await db.sources.add(newSource);
      analytics.track('source_created', { source_type: newSource.type });
      succeeded = true;
      navigate(`/sources/${newSource.id}`);
    } finally {
      if (!succeeded) {
        form.dataset.submitting = 'false';
        submissionLock.current = false;
      }
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (event: MouseEvent, id: string) => {
    event.stopPropagation();
    if (!window.confirm('Delete this source and all of its linked evidence? This cannot be undone.')) return;
    await deleteSourceCascade(id);
  };

  if (!activeProjectId) return <div className="py-12 text-center text-surface-500">Please select a project first.</div>;

  return (
    <div className="page-shell">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Sources</h1>
          <p className="page-description">Interviews, emails, surveys, and customer observations—with provenance intact.</p>
        </div>
        <button type="button" onClick={() => { if (!isCreating) submissionLock.current = false; setIsCreating((value) => !value); }} className={isCreating ? 'button-secondary' : 'button-primary'}>
          {isCreating ? <X size={18} /> : <Plus size={18} />}
          {isCreating ? 'Cancel' : 'Add Source'}
        </button>
      </header>

      {isCreating ? (
        <section className="panel p-5 sm:p-6">
          <h2 className="text-lg font-bold text-surface-950">New source</h2>
          <p className="mt-1 text-sm text-surface-500">Start with a stable identifier. You can add the transcript and evidence next.</p>
          <form onSubmit={handleCreate} className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_180px_auto] lg:items-end">
            <label>
              <span className="field-label">Participant / Identifier</span>
              <input value={participantId} onChange={(event) => setParticipantId(event.target.value)} className="field-control" placeholder="e.g. CTO at Acme or Interview 01" autoFocus />
            </label>
            <label>
              <span className="field-label">Source type</span>
              <select value={type} onChange={(event) => setType(event.target.value as Source['type'])} className="field-control">
                <option value="interview">Interview</option>
                <option value="email">Email</option>
                <option value="survey">Survey</option>
                <option value="sales_call">Sales Call</option>
                <option value="support">Support</option>
                <option value="observation">Observation</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              <span className="field-label">Date</span>
              <input type="date" required value={date} onChange={(event) => setDate(event.target.value)} className="field-control" />
            </label>
            <button type="submit" disabled={isSubmitting} className="button-primary w-full sm:w-auto">Create & Continue</button>
          </form>
        </section>
      ) : null}

      <section className="panel overflow-hidden">
        <div className="panel-header">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="field-control pl-9" placeholder="Search participants, types, or tags…" aria-label="Search sources" />
          </div>
          <span className="hidden text-xs font-medium text-surface-400 sm:block">{visibleSources.length} of {sources.length}</span>
        </div>

        {visibleSources.length > 0 ? (
          <ul className="divide-y divide-surface-200">
            {visibleSources.map((source) => (
              <li key={source.id} className="group flex items-center gap-2 px-4 py-1 transition-colors hover:bg-surface-50 sm:px-5">
                <button type="button" onClick={() => navigate(`/sources/${source.id}`)} className="flex min-w-0 flex-1 items-center py-3 text-left">
                  <span className="flex min-w-0 items-center gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                      <FileText size={19} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-surface-900">{source.participantId}</span>
                      <span className="mt-1 flex items-center gap-2 text-xs capitalize text-surface-500">
                        {source.type.replace('_', ' ')} <span aria-hidden="true">·</span> <CalendarDays size={13} /> {new Date(source.date).toLocaleDateString()}
                      </span>
                    </span>
                  </span>
                </button>
                <button type="button" onClick={(event) => void handleDelete(event, source.id)} className="icon-button opacity-100 hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" aria-label={`Delete ${source.participantId}`}>
                  <Trash2 size={17} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-6 py-14 text-center">
            <FileText className="mx-auto text-surface-300" size={36} />
            <p className="mt-3 font-semibold text-surface-800">{query ? 'No matching sources' : 'Your evidence trail starts here'}</p>
            <p className="mt-1 text-sm text-surface-500">{query ? 'Try a different participant, type, or tag.' : 'Import your first interview, survey response, or support ticket to start building an auditable record of what customers actually said.'}</p>
          </div>
        )}
      </section>
    </div>
  );
}
