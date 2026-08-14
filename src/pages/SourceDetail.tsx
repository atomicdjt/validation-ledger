import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Bot,
  CalendarDays,
  Check,
  FileText,
  LoaderCircle,
  Plus,
  Save,
  Scale,
  Trash2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../db/db';
import type { EvidenceSignal, Hypothesis } from '../db/models';
import { generateId } from '../utils/id';
import { acceptedSuggestionsToEvidence, prepareEvidenceSuggestions, verifyExcerptProvenance, type StagedEvidenceSuggestion } from '../services/evidenceIntegrity';
import { deleteEvidenceCascade } from '../db/operations';
import { updateAllHypothesisScores } from '../services/scoring';

type MobileTab = 'source' | 'evidence';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface EvidenceEditorProps {
  item: EvidenceSignal;
  hypotheses: Hypothesis[];
  onUpdate: (evidenceId: string, updates: Partial<EvidenceSignal>) => Promise<void>;
  onDelete: (evidenceId: string) => Promise<void>;
}

function EvidenceEditor({ item, hypotheses, onUpdate, onDelete }: EvidenceEditorProps) {
  const relationships: Array<{ value: NonNullable<EvidenceSignal['relationship']>; label: string }> = [
    { value: 'contradicts', label: 'Contradicts' },
    { value: 'neutral', label: 'Neutral' },
    { value: 'supports', label: 'Supports' },
  ];

  return (
    <article className="rounded-xl border border-surface-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-surface-400">Evidence signal</p>
          <p className="mt-1 text-sm font-semibold text-surface-900">Edit classification and provenance</p>
        </div>
        <button type="button" onClick={() => void onDelete(item.id)} className="icon-button -mr-2 -mt-2 hover:bg-red-50 hover:text-red-600" aria-label="Delete evidence signal">
          <Trash2 size={17} />
        </button>
      </div>

      <div className="space-y-4">
        <label>
          <span className="field-label">Classification</span>
          <select value={item.classification} onChange={(event) => void onUpdate(item.id, { classification: event.target.value as EvidenceSignal['classification'] })} className="field-control">
            <option value="pain">Pain Point</option>
            <option value="workaround">Workaround</option>
            <option value="current_solution">Current Solution</option>
            <option value="feature_request">Feature Request</option>
            <option value="willingness_to_pay">Willingness to Pay</option>
            <option value="objection">Objection</option>
            <option value="positive_reaction">Positive Reaction</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label>
          <span className="field-label">Observation Summary</span>
          <textarea value={item.statement} onChange={(event) => void onUpdate(item.id, { statement: event.target.value })} className="field-control min-h-24 resize-y" placeholder="Summarize the observation without adding interpretation…" />
        </label>

        <label>
          <span className="field-label flex items-center justify-between">Provenance Quote <span className={`rounded-full px-2 py-0.5 text-[10px] ${item.provenanceState === 'exact' ? 'bg-emerald-100 text-emerald-800' : item.provenanceState === 'normalized' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>{item.provenanceState ?? 'unverified'}</span></span>
          <textarea value={item.exactExcerpt} onChange={(event) => void onUpdate(item.id, { exactExcerpt: event.target.value })} className="field-control min-h-24 resize-y bg-surface-50" placeholder="Paste the exact words from the source…" />
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-surface-200 bg-surface-50 px-3 py-3">
          <input type="checkbox" checked={item.isDirect} disabled={item.provenanceState === 'unverified'} onChange={(event) => void onUpdate(item.id, { isDirect: event.target.checked })} className="mt-0.5 size-4 accent-primary-700" />
          <span>
            <span className="block text-sm font-semibold text-surface-800">Direct evidence</span>
            <span className="block text-xs leading-5 text-surface-500">This signal is stated directly rather than inferred.</span>
          </span>
        </label>

        <label>
          <span className="field-label">Link to Hypothesis</span>
          <select value={item.hypothesisId || ''} onChange={(event) => void onUpdate(item.id, { hypothesisId: event.target.value || null })} className="field-control">
            <option value="">No linked hypothesis</option>
            {hypotheses.map((hypothesis) => (
              <option key={hypothesis.id} value={hypothesis.id}>{hypothesis.statement}</option>
            ))}
          </select>
        </label>

        {item.hypothesisId ? (
          <fieldset>
            <legend className="field-label">Relationship</legend>
            <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-surface-300 bg-white">
              {relationships.map((relationship, index) => {
                const selected = item.relationship === relationship.value;
                const selectedTone = relationship.value === 'contradicts'
                  ? 'bg-red-50 text-red-700'
                  : relationship.value === 'supports'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-surface-100 text-surface-800';
                return (
                  <button
                    key={relationship.value}
                    type="button"
                    onClick={() => void onUpdate(item.id, { relationship: relationship.value })}
                    className={`min-h-11 px-2 text-xs font-semibold transition-colors sm:text-sm ${index > 0 ? 'border-l border-surface-300' : ''} ${selected ? selectedTone : 'text-surface-500 hover:bg-surface-50'}`}
                    aria-pressed={selected}
                  >
                    {relationship.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        <label>
          <span className="field-label">Research Notes</span>
          <textarea value={item.notes} onChange={(event) => void onUpdate(item.id, { notes: event.target.value })} className="field-control min-h-20 resize-y" placeholder="Optional context, caveats, or follow-up…" />
        </label>
      </div>
    </article>
  );
}

export function SourceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const source = useLiveQuery(() => (id ? db.sources.get(id) : undefined), [id], null);
  const evidence = useLiveQuery(() => (id ? db.evidenceSignals.where('sourceId').equals(id).toArray() : []), [id], []);
  const hypotheses = useLiveQuery(
    () => (source?.projectId ? db.hypotheses.where('projectId').equals(source.projectId).toArray() : []),
    [source?.projectId],
    [],
  );

  const [rawText, setRawText] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [mobileTab, setMobileTab] = useState<MobileTab>('source');
  const [suggestions, setSuggestions] = useState<StagedEvidenceSuggestion[]>([]);

  useEffect(() => {
    if (source) setRawText(source.rawText || '');
  }, [source]);

  const handleSave = async () => {
    if (!id || !source) return false;
    try {
      setSaveState('saving');
      setError('');
      await db.sources.update(id, { rawText });
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1800);
      return true;
    } catch (caughtError) {
      setSaveState('error');
      setError(caughtError instanceof Error ? caughtError.message : 'Could not save this source.');
      return false;
    }
  };

  const handleAddManualEvidence = async () => {
    if (!source) return;
    const newEvidence: EvidenceSignal = {
      id: generateId(),
      projectId: source.projectId,
      sourceId: source.id,
      segmentId: source.segmentId,
      hypothesisId: null,
      relationship: 'neutral',
      classification: 'pain',
      statement: 'New observation',
      exactExcerpt: '',
      isDirect: true,
      confidence: 5,
      notes: '',
      createdAt: Date.now(),
      provenanceState: 'unverified',
    };
    await db.evidenceSignals.add(newEvidence);
    setMobileTab('evidence');
  };

  const handleAnalyze = async () => {
    if (!source || !rawText.trim()) return;
    try {
      setIsAnalyzing(true);
      setError('');
      if (!(await handleSave())) return;
      const { extractEvidence } = await import('../services/ai');
      const extracted = await extractEvidence(rawText, hypotheses);
      const staged = prepareEvidenceSuggestions(extracted, rawText, hypotheses, source.projectId);
      if (staged.length === 0) {
        setError('No actionable evidence was found. Try adding a manual observation or expanding the source notes.');
      } else {
        setSuggestions(staged);
        setMobileTab('evidence');
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Analysis failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateEvidence = async (evidenceId: string, updates: Partial<EvidenceSignal>) => {
    try {
      setError('');
      const next = { ...updates };
      if (typeof updates.exactExcerpt === 'string') {
        const provenance = verifyExcerptProvenance(rawText, updates.exactExcerpt);
        next.provenanceState = provenance.state;
        if (provenance.state === 'unverified') next.isDirect = false;
      }
      if (updates.hypothesisId === null) next.relationship = 'neutral';
      await db.evidenceSignals.update(evidenceId, next);
      await updateAllHypothesisScores(source.projectId);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not update this evidence signal.');
    }
  };

  const deleteEvidence = async (evidenceId: string) => {
    if (window.confirm('Delete this evidence signal? This cannot be undone.')) {
      try {
        await deleteEvidenceCascade(evidenceId);
        await updateAllHypothesisScores(source.projectId);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Could not delete this evidence signal.');
      }
    }
  };

  const updateSuggestion = (tempId: string, updates: Partial<StagedEvidenceSuggestion>) => {
    setSuggestions((current) => current.map((suggestion) => {
      if (suggestion.tempId !== tempId) return suggestion;
      const next = { ...suggestion, ...updates };
      if (typeof updates.exactExcerpt === 'string') {
        next.provenance = verifyExcerptProvenance(rawText, updates.exactExcerpt);
        if (next.provenance.state === 'unverified') next.isDirect = false;
      }
      if (updates.hypothesisId === null) next.relationship = 'neutral';
      return next;
    }));
  };

  const acceptSelectedSuggestions = async () => {
    const accepted = acceptedSuggestionsToEvidence(suggestions, source);
    if (accepted.length === 0) {
      setError('Select at least one reviewed suggestion to accept.');
      return;
    }
    try {
      setError('');
      await db.transaction('rw', db.evidenceSignals, async () => db.evidenceSignals.bulkAdd(accepted));
      setSuggestions([]);
      await updateAllHypothesisScores(source.projectId);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not accept the reviewed suggestions.');
    }
  };

  if (source === null) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center text-surface-500" role="status">
        <LoaderCircle className="mr-2 animate-spin" size={20} /> Loading source…
      </div>
    );
  }

  if (!source) {
    return (
      <div className="page-shell">
        <div className="panel mx-auto max-w-lg px-6 py-12 text-center">
          <FileText className="mx-auto text-surface-300" size={38} />
          <h1 className="mt-4 text-xl font-bold text-surface-950">Source not found</h1>
          <p className="mt-2 text-sm leading-6 text-surface-500">This source may have been deleted, or the link may be incomplete.</p>
          <button type="button" onClick={() => navigate('/sources')} className="button-primary mt-6">
            <ArrowLeft size={17} /> Return to Sources
          </button>
        </div>
      </div>
    );
  }

  const saveLabel = saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Retry Save' : 'Save Notes';

  return (
    <div className="page-shell">
      <button type="button" onClick={() => navigate('/sources')} className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800">
        <ArrowLeft size={17} /> Sources
      </button>

      <h1 className="page-title -mt-2">Source Detail</h1>

      <section className="panel p-4 sm:p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-800">
              {source.participantId.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold tracking-tight text-surface-950 sm:text-2xl">{source.participantId}</h2>
              <p className="mt-1 flex items-center gap-2 text-sm capitalize text-surface-500">
                <CalendarDays size={15} /> {source.type.replace('_', ' ')} · {new Date(source.date).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button type="button" onClick={() => void handleSave()} disabled={saveState === 'saving'} className="button-secondary px-3 sm:px-4">
              {saveState === 'saved' ? <Check size={17} /> : saveState === 'saving' ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}
              {saveLabel}
            </button>
            <button type="button" onClick={() => void handleAnalyze()} disabled={isAnalyzing || !rawText.trim()} className="button-primary px-3 sm:px-4">
              {isAnalyzing ? <LoaderCircle size={17} className="animate-spin" /> : <Bot size={17} />}
              {isAnalyzing ? 'Analyzing…' : 'Analyze with AI'}
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-surface-500">AI is optional. Selecting Analyze sends this source text to Google Gemini. Suggestions remain untrusted and are not stored until you review and accept them.</p>
        {error ? <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p> : null}
      </section>

      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-surface-200 bg-white lg:hidden" role="tablist" aria-label="Source detail sections">
        <button type="button" role="tab" aria-selected={mobileTab === 'source'} onClick={() => setMobileTab('source')} className={`flex min-h-12 items-center justify-center gap-2 text-sm font-semibold ${mobileTab === 'source' ? 'border-b-2 border-primary-700 text-primary-700' : 'text-surface-500'}`}>
          <FileText size={17} /> Source Material
        </button>
        <button type="button" role="tab" aria-selected={mobileTab === 'evidence'} onClick={() => setMobileTab('evidence')} className={`flex min-h-12 items-center justify-center gap-2 text-sm font-semibold ${mobileTab === 'evidence' ? 'border-b-2 border-primary-700 text-primary-700' : 'text-surface-500'}`}>
          <Scale size={17} /> Evidence ({evidence.length})
        </button>
      </div>

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-2">
        <section className={`panel min-w-0 overflow-hidden ${mobileTab === 'evidence' ? 'hidden lg:block' : ''}`}>
          <div className="panel-header">
            <div className="flex items-center gap-2.5">
              <FileText size={19} className="text-primary-700" />
              <h2 className="font-semibold text-surface-950">Source Material</h2>
            </div>
          </div>
          <label className="block p-4 sm:p-5">
            <span className="field-label">Transcript or notes</span>
            <textarea value={rawText} onChange={(event) => setRawText(event.target.value)} className="field-control min-h-[420px] resize-y leading-7 lg:min-h-[560px]" placeholder="Paste interview transcript, raw notes, or email content here…" />
          </label>
        </section>

        <section className={`panel min-w-0 overflow-hidden ${mobileTab === 'source' ? 'hidden lg:block' : ''}`}>
          <div className="panel-header">
            <div>
              <h2 className="font-semibold text-surface-950">Extracted Evidence</h2>
              <p className="mt-0.5 text-xs text-surface-500">Every signal should retain its exact source.</p>
            </div>
            <button type="button" onClick={() => void handleAddManualEvidence()} className="button-secondary px-3">
              <Plus size={16} /> Add Manual
            </button>
          </div>
          <div className="space-y-4 bg-surface-50/70 p-4 sm:p-5">
            {suggestions.length > 0 ? (
              <section className="rounded-xl border-2 border-primary-200 bg-white p-4 shadow-sm" aria-labelledby="ai-review-title">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-primary-800"><ShieldCheck size={18} /><h3 id="ai-review-title" className="font-bold">AI Evidence Review</h3></div>
                    <p className="mt-1 text-xs leading-5 text-surface-500">Verify each claim and quote. Nothing below is evidence until accepted.</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="button-secondary px-3" onClick={() => setSuggestions([])}><X size={16} /> Reject all</button>
                    <button type="button" className="button-primary px-3" onClick={() => void acceptSelectedSuggestions()}><Check size={16} /> Accept selected</button>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {suggestions.map((suggestion) => (
                    <article key={suggestion.tempId} className="rounded-lg border border-surface-200 bg-surface-50 p-3">
                      <div className="flex items-start gap-3">
                        <input aria-label="Select suggestion" type="checkbox" checked={suggestion.selected} onChange={(event) => updateSuggestion(suggestion.tempId, { selected: event.target.checked })} className="mt-1 size-4 accent-primary-700" />
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold uppercase tracking-wide text-surface-500">{suggestion.classification.replace(/_/g, ' ')}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${suggestion.provenance.state === 'exact' ? 'bg-emerald-100 text-emerald-800' : suggestion.provenance.state === 'normalized' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>{suggestion.provenance.state} provenance</span></div>
                          <textarea aria-label="Suggested observation" value={suggestion.statement} onChange={(event) => updateSuggestion(suggestion.tempId, { statement: event.target.value })} className="field-control min-h-20 resize-y" />
                          <textarea aria-label="Suggested provenance quote" value={suggestion.exactExcerpt} onChange={(event) => updateSuggestion(suggestion.tempId, { exactExcerpt: event.target.value })} className="field-control min-h-20 resize-y bg-white" />
                          <div className="grid gap-2 sm:grid-cols-2">
                            <select aria-label="Suggested hypothesis" value={suggestion.hypothesisId ?? ''} onChange={(event) => updateSuggestion(suggestion.tempId, { hypothesisId: event.target.value || null })} className="field-control"><option value="">No linked hypothesis</option>{hypotheses.map((hypothesis) => <option key={hypothesis.id} value={hypothesis.id}>{hypothesis.statement}</option>)}</select>
                            <select aria-label="Suggested relationship" disabled={!suggestion.hypothesisId} value={suggestion.relationship} onChange={(event) => updateSuggestion(suggestion.tempId, { relationship: event.target.value as EvidenceSignal['relationship'] })} className="field-control"><option value="neutral">Neutral</option><option value="supports">Supports</option><option value="contradicts">Contradicts</option></select>
                          </div>
                          {suggestion.warnings.length > 0 ? <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs leading-5 text-amber-800">{suggestion.warnings.join(' ')}</p> : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
            {evidence.map((item) => (
              <EvidenceEditor key={item.id} item={item} hypotheses={hypotheses} onUpdate={updateEvidence} onDelete={deleteEvidence} />
            ))}
            {evidence.length === 0 ? (
              <div className="rounded-xl border border-dashed border-surface-300 bg-white px-6 py-12 text-center">
                <Scale className="mx-auto text-surface-300" size={34} />
                <p className="mt-3 font-semibold text-surface-800">No evidence extracted yet</p>
                <p className="mt-1 text-sm leading-6 text-surface-500">Analyze the source or add a manual observation while the context is fresh.</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
