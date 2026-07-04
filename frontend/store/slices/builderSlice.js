import { createSlice } from '@reduxjs/toolkit';
import {
  LOCAL_ALLOCATION_PRESET_METADATA,
  suggestedAllocationProfile,
  cleanAllocationValue,
} from '@/lib/allocation';

const initialState = {
  budget: '',
  useCase: 'gaming',
  cpuBrand: '',
  gpuVendor: '',
  budgetStrategy: 'balanced',
  performancePriority: 'gaming',
  recommendationMode: 'fast',
  aiProfile: 'local_qwen',
  allocationPresetMetadata: LOCAL_ALLOCATION_PRESET_METADATA,
  allocationPresetSource: 'local',
  advancedAllocationEnabled: false,
  allocationOverrides: suggestedAllocationProfile('gaming', 'balanced', 'gaming'),
  allocationMode: 'suggested',
  pendingSuggestedAllocation: null,
  allocationError: '',
  selectedOptionalAddons: {
    hdd: false,
    monitor: false,
    ups: false,
  },
  build: null,
  submittedOptionalAddons: [],
  error: '',
  loadingMode: '',
  swapTarget: null,
  referencedSlot: '',
};

const builderSlice = createSlice({
  name: 'builder',
  initialState,
  reducers: {
    updateForm(state, action) {
      Object.assign(state, action.payload);
    },

    recalcAllocation(state, action) {
      const { useCase, budgetStrategy, performancePriority, metadata } = action.payload;
      const nextAllocation = suggestedAllocationProfile(useCase, budgetStrategy, performancePriority, metadata);
      if (state.allocationMode === 'custom') {
        state.pendingSuggestedAllocation = nextAllocation;
      } else {
        state.allocationOverrides = nextAllocation;
        state.pendingSuggestedAllocation = null;
      }
      state.allocationError = '';
    },

    setAllocationPresetMetadata(state, action) {
      const normalized = action.payload;
      state.allocationPresetMetadata = normalized.metadata;
      state.allocationPresetSource = normalized.source;
      if (state.allocationMode !== 'custom') {
        const { useCase, budgetStrategy, performancePriority } = state;
        state.allocationOverrides = suggestedAllocationProfile(
          useCase, budgetStrategy, performancePriority, normalized.metadata
        );
      }
    },

    setAdvancedAllocationEnabled(state, action) {
      state.advancedAllocationEnabled = action.payload;
      state.allocationOverrides = suggestedAllocationProfile(
        state.useCase, state.budgetStrategy, state.performancePriority, state.allocationPresetMetadata
      );
      state.allocationMode = 'suggested';
      state.pendingSuggestedAllocation = null;
      state.allocationError = '';
    },

    updateAllocationSlot(state, action) {
      const { slot, value } = action.payload;
      state.allocationOverrides[slot] = cleanAllocationValue(value);
      state.allocationMode = 'custom';
      state.pendingSuggestedAllocation = null;
      state.allocationError = '';
    },

    resetAllocation(state) {
      state.allocationOverrides = suggestedAllocationProfile(
        state.useCase, state.budgetStrategy, state.performancePriority, state.allocationPresetMetadata
      );
      state.allocationMode = 'suggested';
      state.pendingSuggestedAllocation = null;
      state.allocationError = '';
    },

    applyPendingSuggestedAllocation(state) {
      if (!state.pendingSuggestedAllocation) return;
      state.allocationOverrides = state.pendingSuggestedAllocation;
      state.allocationMode = 'suggested';
      state.pendingSuggestedAllocation = null;
      state.allocationError = '';
    },

    toggleOptionalAddon(state, action) {
      const { addon, checked } = action.payload;
      state.selectedOptionalAddons[addon] = checked;
    },

    setBuild(state, action) {
      state.build = action.payload;
      state.error = '';
      state.swapTarget = null;
      state.referencedSlot = '';
    },

    clearBuild(state) {
      state.build = null;
      state.submittedOptionalAddons = [];
      state.referencedSlot = '';
    },

    setError(state, action) {
      state.error = action.payload;
    },

    setLoadingMode(state, action) {
      state.loadingMode = action.payload;
    },

    setSubmittedOptionalAddons(state, action) {
      state.submittedOptionalAddons = action.payload;
    },

    setSwapTarget(state, action) {
      state.swapTarget = action.payload;
    },

    clearSwapTarget(state) {
      state.swapTarget = null;
    },

    setReferencedSlot(state, action) {
      state.referencedSlot = action.payload;
    },
  },
});

export const {
  updateForm,
  recalcAllocation,
  setAllocationPresetMetadata,
  setAdvancedAllocationEnabled,
  updateAllocationSlot,
  resetAllocation,
  applyPendingSuggestedAllocation,
  toggleOptionalAddon,
  setBuild,
  clearBuild,
  setError,
  setLoadingMode,
  setSubmittedOptionalAddons,
  setSwapTarget,
  clearSwapTarget,
  setReferencedSlot,
} = builderSlice.actions;

export default builderSlice.reducer;
