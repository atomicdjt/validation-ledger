import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Download, Eye, EyeOff, KeyRound, Save, ShieldCheck, Upload } from 'lucide-react';
import { exportDatabase, importDatabase } from '../db/exportImport';
import { useStore } from '../store/useStore';

export function Settings() {
  const setActiveProject = useStore((state) => state.setActiveProject);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    setApiKey(localStorage.getItem('validation_ledger_gemini_key') || '');
  }, []);

  const handleSaveApiKey = () => {
    const value = apiKey.trim();
    if (value) localStorage.setItem('validation_ledger_gemini_key', value);
    else localStorage.removeItem('validation_ledger_gemini_key');
    setIsSaved(true);
    window.setTimeout(() => setIsSaved(false), 1800);
  };

  const handleExport = async () => {
    const data = await exportDatabase();
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `validation-ledger-backup-${new Date().toISOString().split('T')[0]}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!importText.trim()) return;
    if (!window.confirm('Restore this backup and replace all current local data? Export your current data first if you may need it.')) return;
    try {
      setIsImporting(true);
      setImportError('');
      setActiveProject(await importDatabase(importText));
      window.location.assign('/');
    } catch (caughtError) {
      setImportError(caughtError instanceof Error ? caughtError.message : 'Import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="page-shell max-w-4xl">
      <header>
        <h1 className="page-title">Settings</h1>
        <p className="page-description">Manage AI access and protect the local evidence stored in this browser.</p>
      </header>

      <section className="panel overflow-hidden">
        <div className="panel-header">
          <div className="flex items-center gap-2.5"><KeyRound size={19} className="text-primary-700" /><h2 className="font-semibold text-surface-950">AI Integration</h2></div>
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex gap-3 rounded-xl border border-primary-100 bg-primary-50 p-4 text-sm leading-6 text-primary-900">
            <ShieldCheck size={20} className="mt-0.5 shrink-0" />
            <p>Your Gemini key is stored in this browser's localStorage and is readable by scripts running on this origin. Use a restricted key for personal use only. Validation Ledger has no backend, account system, or cloud database.</p>
          </div>
          <label className="mt-5 block">
            <span className="field-label">Gemini API Key</span>
            <span className="flex flex-col gap-2 sm:flex-row">
              <span className="relative flex-1">
                <input type={showApiKey ? 'text' : 'password'} value={apiKey} onChange={(event) => setApiKey(event.target.value)} className="field-control pr-11" placeholder="AIzaSy…" autoComplete="off" />
                <button type="button" onClick={() => setShowApiKey((value) => !value)} className="icon-button absolute right-0.5 top-0.5" aria-label={showApiKey ? 'Hide API key' : 'Show API key'}>{showApiKey ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </span>
              <button type="button" onClick={handleSaveApiKey} className="button-primary">{isSaved ? <Check size={17} /> : <Save size={17} />}{isSaved ? 'Saved' : 'Save Key'}</button>
            </span>
          </label>
          <p className="mt-2 text-xs text-surface-500">Create a key in <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="font-semibold text-primary-700 hover:underline">Google AI Studio</a>. Browser-stored keys are appropriate only for personal, local use.</p>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="panel-header">
          <div className="flex items-center gap-2.5"><Download size={19} className="text-primary-700" /><h2 className="font-semibold text-surface-950">Data Backup</h2></div>
        </div>
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
          <div>
            <h3 className="font-semibold text-surface-900">Export a versioned backup</h3>
            <p className="mt-2 text-sm leading-6 text-surface-500">Download every project, source, evidence signal, hypothesis, decision, and relationship as JSON. Keep independent copies and periodically test restoration.</p>
            <button type="button" onClick={() => void handleExport()} className="button-secondary mt-4"><Download size={17} />Download Backup</button>
          </div>
          <div className="border-t border-surface-200 pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <h3 className="font-semibold text-surface-900">Restore from backup</h3>
            <div className="mt-3 flex gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs leading-5 text-orange-800">
              <AlertTriangle className="mt-0.5 shrink-0" size={17} /> Restore replaces local data only after complete schema, limits, duplicate-ID, and referential-integrity validation succeeds.
            </div>
            <textarea value={importText} onChange={(event) => setImportText(event.target.value)} className="field-control mt-3 min-h-28 resize-y font-mono text-xs" placeholder="Paste backup JSON here…" />
            {importError ? <p className="mt-2 text-sm text-red-600" role="alert">{importError}</p> : null}
            <button type="button" onClick={() => void handleImport()} disabled={!importText.trim() || isImporting} className="button-danger mt-3"><Upload size={17} />{isImporting ? 'Validating…' : 'Restore Backup'}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
