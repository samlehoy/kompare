import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  file: null,
  partsList: '',
  goal: 'General Gaming',
  result: null,
  error: '',
  loading: false,
};

const auditSlice = createSlice({
  name: 'audit',
  initialState,
  reducers: {
    updateForm(state, action) {
      Object.assign(state, action.payload);
    },

    setResult(state, action) {
      state.result = action.payload;
      state.error = '';
    },

    clearResult(state) {
      state.result = null;
    },

    setError(state, action) {
      state.error = action.payload;
      state.result = null;
    },

    setLoading(state, action) {
      state.loading = action.payload;
    },
  },
});

export const {
  updateForm,
  setResult,
  clearResult,
  setError,
  setLoading,
} = auditSlice.actions;

export default auditSlice.reducer;
