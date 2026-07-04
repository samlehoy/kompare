import { configureStore } from '@reduxjs/toolkit';
import windowsReducer from './slices/windowsSlice';
import builderReducer from './slices/builderSlice';
import auditReducer from './slices/auditSlice';

export function createStore() {
  return configureStore({
    reducer: {
      windows: windowsReducer,
      builder: builderReducer,
      audit: auditReducer,
    },
  });
}

export const store = createStore();
