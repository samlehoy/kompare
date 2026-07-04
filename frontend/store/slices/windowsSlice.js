import { createSlice } from '@reduxjs/toolkit';

const INITIAL_WINDOW = {
  id: 'init-readme',
  componentId: 'readme',
  zIndex: 100,
  isMinimized: false,
  isMaximized: false,
};

const initialState = {
  nextZIndex: 101,
  windows: [INITIAL_WINDOW],
  activeWindowId: 'init-readme',
};

const windowsSlice = createSlice({
  name: 'windows',
  initialState,
  reducers: {
    openWindow(state, action) {
      const { componentId } = action.payload;
      const existing = state.windows.find(w => w.componentId === componentId);
      const zIndex = state.nextZIndex++;
      if (existing) {
        state.activeWindowId = existing.id;
        existing.zIndex = zIndex;
        existing.isMinimized = false;
      } else {
        const id = Date.now().toString();
        state.activeWindowId = id;
        state.windows.push({ id, componentId, zIndex, isMinimized: false, isMaximized: false });
      }
    },

    closeWindow(state, action) {
      const id = action.payload;
      if (state.activeWindowId === id) state.activeWindowId = null;
      state.windows = state.windows.filter(w => w.id !== id);
    },

    focusWindow(state, action) {
      const { id } = action.payload;
      state.activeWindowId = id;
      const win = state.windows.find(w => w.id === id);
      if (win) {
        win.zIndex = state.nextZIndex++;
        win.isMinimized = false;
      }
    },

    toggleMinimize(state, action) {
      const { id } = action.payload;
      const win = state.windows.find(w => w.id === id);
      if (!win) return;
      const willMinimize = !win.isMinimized;
      state.activeWindowId = willMinimize ? null : id;
      win.isMinimized = willMinimize;
      if (!willMinimize) win.zIndex = state.nextZIndex++;
    },

    toggleMaximize(state, action) {
      const { id } = action.payload;
      state.activeWindowId = id;
      const win = state.windows.find(w => w.id === id);
      if (win) {
        win.isMaximized = !win.isMaximized;
        win.isMinimized = false;
        win.zIndex = state.nextZIndex++;
      }
    },
  },
});

export const {
  openWindow,
  closeWindow,
  focusWindow,
  toggleMinimize,
  toggleMaximize,
} = windowsSlice.actions;

export default windowsSlice.reducer;
