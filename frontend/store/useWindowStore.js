import { create } from 'zustand';

let nextZIndex = 100;

export const useWindowStore = create((set) => ({
  // The desktop starts empty; each route opens the window it is responsible
  // for. Seeding README here meant /builder opened the wizard on top of it.
  windows: [],
  activeWindowId: null,

  openWindow: (componentId) => set((state) => {
    const existing = state.windows.find(w => w.componentId === componentId);
    if (existing) {
      return {
        activeWindowId: existing.id,
        windows: state.windows.map(w =>
          w.id === existing.id ? { ...w, zIndex: ++nextZIndex, isMinimized: false } : w
        )
      };
    }
    const newId = Date.now().toString();
    return {
      activeWindowId: newId,
      windows: [...state.windows, { id: newId, componentId, zIndex: ++nextZIndex, isMinimized: false, isMaximized: false }]
    };
  }),

  closeWindow: (id) => set((state) => ({
    activeWindowId: state.activeWindowId === id ? null : state.activeWindowId,
    windows: state.windows.filter(w => w.id !== id)
  })),

  focusWindow: (id) => set((state) => ({
    activeWindowId: id,
    windows: state.windows.map(w =>
      w.id === id ? { ...w, zIndex: ++nextZIndex, isMinimized: false } : w
    )
  })),

  toggleMinimize: (id) => set((state) => {
    const win = state.windows.find(w => w.id === id);
    if (!win) return state;
    const willMinimize = !win.isMinimized;
    return {
      activeWindowId: willMinimize ? null : id,
      windows: state.windows.map(w =>
        w.id === id ? { ...w, isMinimized: willMinimize, zIndex: willMinimize ? w.zIndex : ++nextZIndex } : w
      )
    };
  }),

  toggleMaximize: (id) => set((state) => ({
    activeWindowId: id,
    windows: state.windows.map(w =>
      w.id === id ? { ...w, isMaximized: !w.isMaximized, isMinimized: false, zIndex: ++nextZIndex } : w
    )
  }))
}));
