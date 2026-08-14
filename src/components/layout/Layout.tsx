import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useStore } from '../../store/useStore';

export function Layout() {
  const activeProjectId = useStore((state) => state.activeProjectId);
  const closeMobileSidebar = useStore((state) => state.closeMobileSidebar);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    closeMobileSidebar();
    window.scrollTo(0, 0);
    if (!activeProjectId && location.pathname !== '/projects' && location.pathname !== '/settings') {
      navigate('/projects', { replace: true });
    }
  }, [activeProjectId, closeMobileSidebar, location.pathname, navigate]);

  return (
    <div className="flex min-h-screen w-full bg-surface-50 text-surface-900">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-64">
        <Header />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
