const configuredBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
const productionFallback = 'https://kompare-backend-api.muttaqien0111.workers.dev';
const apiBase = configuredBase || (process.env.NODE_ENV === 'production' ? productionFallback : '');
let BASE = apiBase ? apiBase.replace(/\/+$/, '') : '/api';
if (BASE && BASE.startsWith('http') && !BASE.endsWith('/api')) {
  BASE = `${BASE}/api`;
}

function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${BASE}${normalizedPath}`;
}

export class ApiError extends Error {
  constructor(message, { status, detail } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

function isFormDataBody(body) {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

async function parseErrorResponse(response) {
  let detail = null;
  let message = `${response.status} ${response.statusText || 'Request failed'}`;
  let text = '';

  try {
    text = await response.text();
  } catch {
    return new ApiError(message, { status: response.status, detail });
  }

  if (!text) return new ApiError(message, { status: response.status, detail });

  try {
    const body = JSON.parse(text);
    detail = body?.detail ?? body;
    if (typeof detail === 'string') {
      message = detail;
    } else if (detail?.message) {
      message = detail.message;
    }
  } catch {
    message = text;
  }

  return new ApiError(message, { status: response.status, detail });
}

export async function request(path, options = {}) {
  const { headers, body, ...rest } = options;
  const hasBody = body !== undefined;
  const isFormData = isFormDataBody(body);
  
  const userKey = typeof window !== 'undefined' && typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
    ? localStorage.getItem('kompare_user_gemini_key')
    : null;
  const userLMStudioUrl = typeof window !== 'undefined' && typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
    ? localStorage.getItem('kompare_user_lmstudio_url')
    : null;
  const userQdrantUrl = typeof window !== 'undefined' && typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
    ? localStorage.getItem('kompare_user_qdrant_url')
    : null;
  const userQdrantKey = typeof window !== 'undefined' && typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
    ? localStorage.getItem('kompare_user_qdrant_key')
    : null;

  const extraHeaders = {};
  if (userKey) extraHeaders['X-Gemini-Api-Key'] = userKey;
  if (userLMStudioUrl) extraHeaders['X-LMStudio-Base-Url'] = userLMStudioUrl;
  if (userQdrantUrl) extraHeaders['X-Qdrant-Url'] = userQdrantUrl;
  if (userQdrantKey) extraHeaders['X-Qdrant-Api-Key'] = userQdrantKey;

  const requestHeaders = hasBody && !isFormData
    ? { 'Content-Type': 'application/json', ...(headers || {}) }
    : headers;

  const finalHeaders = (Object.keys(extraHeaders).length > 0 || requestHeaders)
    ? { ...requestHeaders, ...extraHeaders }
    : undefined;

  const init = { ...rest };
  if (hasBody) init.body = body;
  if (finalHeaders !== undefined) init.headers = finalHeaders;

  const response = await fetch(apiUrl(path), init);
  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function buildRecommendationPayload({
  aiProfile,
  budgetIdr,
  useCase,
  cpuBrand,
  gpuVendor,
  includeOptionalAddons = false,
  selectedOptionalAddons,
  budgetStrategy,
  performancePriority,
  allocationOverrides,
} = {}) {
  const payload = {
    budget_idr: budgetIdr,
    use_case: useCase,
    cpu_brand: cpuBrand || null,
    gpu_vendor: gpuVendor || null,
    include_optional_addons: !!includeOptionalAddons,
  };
  if (Array.isArray(selectedOptionalAddons)) {
    payload.selected_optional_addons = selectedOptionalAddons;
  }
  if (budgetStrategy) payload.budget_strategy = budgetStrategy;
  if (performancePriority) payload.performance_priority = performancePriority;
  if (allocationOverrides) payload.allocation_overrides = allocationOverrides;
  if (aiProfile) payload.ai_profile = aiProfile;
  return payload;
}

export const api = {
  health: () => request('/health'),

  listUseCases: () => request('/build/use-cases'),

  listAllocationPresets: () => request('/build/allocation-presets'),

  listBudgetTiers: () => request('/build/budget-tiers'),

  recommendBuild: (params) =>
    request('/build/recommend', {
      method: 'POST',
      body: JSON.stringify(buildRecommendationPayload(params)),
    }),

  recommendAiBuild: (params) =>
    request('/build/ai-recommend', {
      method: 'POST',
      body: JSON.stringify(buildRecommendationPayload(params)),
    }),

  recommendUpgrade: ({ budgetIdr, useCase, existingComponents } = {}) =>
    request('/build/upgrade', {
      method: 'POST',
      body: JSON.stringify({
        budget_idr: budgetIdr,
        use_case: useCase,
        existing_components: existingComponents || {},
      }),
    }),

  auditBuild: ({ image, goal, partsList } = {}) => {
    const body = new FormData();
    if (image) body.append('image', image);
    if (goal) body.append('goal', goal);
    if (partsList) body.append('parts_list', partsList);
    return request('/build/audit', {
      method: 'POST',
      body,
    });
  },

  askBuildAdvisor: ({ mode, question, context, history } = {}) =>
    request('/build/advisor', {
      method: 'POST',
      body: JSON.stringify({
        mode,
        question,
        context,
        history: history || [],
      }),
    }),

  listSwapCandidates: ({ budgetIdr, useCase, slot, currentBuild, q, maxPrice, limit = 50, offset = 0 } = {}) =>
    request('/build/swap-candidates', {
      method: 'POST',
      body: JSON.stringify({
        budget_idr: budgetIdr,
        use_case: useCase,
        slot,
        current_build: currentBuild,
        q: q || null,
        max_price: maxPrice ?? null,
        limit,
        offset,
      }),
    }),

  swapComponent: ({ budgetIdr, useCase, slot, newComponentId, currentBuild } = {}) =>
    request('/build/swap', {
      method: 'POST',
      body: JSON.stringify({
        budget_idr: budgetIdr,
        use_case: useCase,
        slot,
        new_component_id: newComponentId,
        current_build: currentBuild,
      }),
    }),
};
