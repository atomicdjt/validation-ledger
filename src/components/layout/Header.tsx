import { useLiveQuery } from 'dexie-react-hooks';
import { BookCheck, ChevronDown, Menu, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/db';
import { useStore } from '../../store/useStore';

export function Header() {
  const activeProjectId = useStore((state) => state.activeProjectId);
  const openMobileSidebar = useStore((state) => state.openMobileSidebar);
  const activeProject = useLiveQuery(
    () => (activeProjectId ? db.projects.get(activeProjectId) : undefined),
    [activeProjectId],
  );
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-18 items-center justify-between border-b border-white/10 bg-[#07162c] px-4 text-white sm:px-6 lg:border-surface-200 lg:bg-white/95 lg:px-8 lg:text-surface-900 lg:backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" className="icon-button text-slate-200 hover:bg-white/10 hover:text-white lg:hidden" onClick={openMobileSidebar} aria-label="Open navigation">
          <Menu size={22} />
        </button>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/8 lg:hidden" aria-hidden="true">
          <BookCheck size={18} />
        </span>
        <button type="button" onClick={() => navigate('/projects')} className="min-w-0 rounded-lg text-left">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 lg:text-[11px] lg:text-surface-400">Project</span>
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-sm font-semibold text-white sm:text-[15px] lg:text-surface-900">
            {activeProject?.name || 'Select a project'}
            <ChevronDown size={15} className="text-slate-400 lg:text-surface-400" />
          </span>
        </button>
      </div>

      {activeProjectId ? (
        <button type="button" onClick={() => navigate('/sources')} className="button-primary hidden px-3 sm:px-4 lg:inline-flex">
          <Plus size={17} />
          <span>Add Evidence</span>
        </button>
      ) : null}
    </header>
  );
}
