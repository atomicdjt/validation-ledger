import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  activeProjectId: string | null;
  setActiveProject: (id: string | null) => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  isMobileSidebarOpen: boolean;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      activeProjectId: null,
      setActiveProject: (id) => set({ activeProjectId: id }),
      isSidebarOpen: true,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      isMobileSidebarOpen: false,
      openMobileSidebar: () => set({ isMobileSidebarOpen: true }),
      closeMobileSidebar: () => set({ isMobileSidebarOpen: false }),
    }),
    {
      name: 'validation-ledger-storage',
      partialize: (state) => ({ activeProjectId: state.activeProjectId }),
    },
  ),
);
