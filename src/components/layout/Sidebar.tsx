import { NavLink, useNavigate } from 'react-router-dom';
import {
  BookCheck,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Lightbulb,
  MessageSquareText,
  Scale,
  Settings,
  X,
} from 'lucide-react';
import { useStore } from '../../store/useStore';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Sources', path: '/sources', icon: MessageSquareText },
  { name: 'Hypotheses', path: '/hypotheses', icon: Lightbulb },
  { name: 'Decisions', path: '/decisions', icon: Scale },
  { name: 'Report', path: '/report', icon: FileText },
];

export function Sidebar() {
  const activeProjectId = useStore((state) => state.activeProjectId);
  const isMobileSidebarOpen = useStore((state) => state.isMobileSidebarOpen);
  const closeMobileSidebar = useStore((state) => state.closeMobileSidebar);
  const navigate = useNavigate();

  const itemClasses = ({ isActive }: { isActive: boolean }) =>
    `group flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-primary-600/25 text-white ring-1 ring-inset ring-primary-400/20'
        : 'text-slate-300 hover:bg-white/7 hover:text-white'
    }`;

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        aria-hidden={!isMobileSidebarOpen}
        tabIndex={isMobileSidebarOpen ? 0 : -1}
        onClick={closeMobileSidebar}
        className={`fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px] transition-opacity lg:hidden ${
          isMobileSidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        aria-label="Primary navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/10 bg-[#07162c] text-white shadow-2xl transition-transform duration-200 lg:visible lg:translate-x-0 lg:shadow-none ${
          isMobileSidebarOpen ? 'visible translate-x-0' : 'invisible -translate-x-full'
        }`}
      >
        <div className="flex h-18 items-center justify-between border-b border-white/10 px-5">
          <button
            type="button"
            onClick={() => navigate(activeProjectId ? '/' : '/projects')}
            className="flex items-center gap-3 rounded-lg text-left"
            aria-label="Validation Ledger home"
          >
            <span className="flex size-9 items-center justify-center rounded-lg border border-white/20 bg-white/8">
              <BookCheck size={21} strokeWidth={1.9} />
            </span>
            <span className="text-base font-bold tracking-[-0.02em]">Validation Ledger</span>
          </button>
          <button type="button" onClick={closeMobileSidebar} className="icon-button text-slate-300 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Close navigation">
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-5">
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="mb-4 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/7 hover:text-white"
          >
            <FolderKanban size={19} strokeWidth={1.8} />
            Projects
          </button>

          {activeProjectId ? (
            navItems.map((item) => (
              <NavLink key={item.path} to={item.path} className={itemClasses}>
                <item.icon size={19} strokeWidth={1.8} />
                {item.name}
              </NavLink>
            ))
          ) : (
            <p className="px-3 py-5 text-sm leading-6 text-slate-400">Select or create a project to start recording evidence.</p>
          )}
        </nav>

        <div className="border-t border-white/10 p-3">
          <NavLink to="/settings" className={itemClasses}>
            <Settings size={19} strokeWidth={1.8} />
            Settings
          </NavLink>
          <p className="px-3 pt-4 text-[11px] text-slate-500">Local-first · stored in this browser</p>
        </div>
      </aside>
    </>
  );
}
