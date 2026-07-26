# Unified AI Provider Settings

## Objective

Kompare uses one frontend behavior in local development, Cloudflare preview,
and production. Settings and AI provider profiles remain available everywhere;
branch or build environment no longer changes feature visibility.

## Product Behavior

- The Settings desktop icon is always visible.
- AI-assisted mode always shows the AI Profile selector.
- Users can select `gemini_free` or `local_qwen` in every environment.
- Gemini BYOK, LM Studio URL, and custom Qdrant URL/API key stored in browser
  local storage are forwarded as ephemeral request headers.
- Deterministic compatibility validation remains authoritative and remains the
  fallback when an AI provider fails.

## Environment Handling

Environment checks must not control Settings visibility, AI Profile visibility,
profile selection, or browser provider override headers.

The existing `NODE_ENV` check in `frontend/lib/api.js` remains only for API base
selection when `NEXT_PUBLIC_API_BASE_URL` is absent:

```js
configuredBase || (process.env.NODE_ENV === 'production' ? productionFallback : '')
```

This preserves the production Worker fallback without introducing separate
development and production feature contracts.

## Frontend Changes

### Desktop shell

Remove the production filter from `DESKTOP_ICONS` in
`frontend/components/shell/DesktopShell.jsx`. Settings becomes a normal desktop
application in every build.

### Build wizard

Remove `isProductionEnvironment()` and all related branches from
`frontend/components/builder/BuildWizard.jsx`.

- Render the AI Profile selector whenever AI-assisted mode is selected.
- Submit the profile selected by the user without replacing it with
  `gemini_free` in production.

### API client

Remove `allowBrowserProviderOverrides` from `frontend/lib/api.js`. When present
in local storage, always forward:

- `X-Gemini-Api-Key`
- `X-LMStudio-Base-Url`
- `X-Qdrant-Url`
- `X-Qdrant-Api-Key`

Do not change API base URL selection or error handling.

## Security Decision

This release intentionally enables all existing provider overrides without
adding backend hardening. The accepted risks must be recorded in
`docs/PROJECT_STATUS.md`:

- User-controlled LM Studio and Qdrant URLs can make the Worker fetch arbitrary
  destinations (SSRF risk).
- A custom Qdrant URL without a custom Qdrant key can currently be combined
  with the server Qdrant secret, risking credential disclosure.
- Provider credentials stored in local storage are exposed if the frontend has
  an XSS vulnerability.
- Public provider overrides require future URL validation, protocol/host
  restrictions, request limits, credential-pairing rules, secret-safe logging,
  and abuse/rate controls.

These risks are accepted temporarily to keep Gemini BYOK and Local Qwen/LM
Studio available. Security hardening is a named post-MVP backlog item rather
than hidden or implied technical debt.

## Tests

Update unit tests to assert one consistent contract regardless of `NODE_ENV`:

- Settings remains available in production builds.
- AI Profile remains visible in AI-assisted mode in production.
- The selected profile is submitted unchanged in production.
- Browser Gemini, LM Studio, and Qdrant overrides are forwarded in production.
- Production API fallback still targets the deployed Worker when no public API
  base is configured.

Run the full frontend unit suite and production static build. Existing local
changes to RetroWindow controls remain separate and must not be overwritten.

## Documentation Updates

Update `docs/PROJECT_STATUS.md` to replace the previous production contract
that said Settings, provider selection, and browser overrides were hidden.
Record the new unified provider contract and security-hardening backlog without
claiming that the risks have been fixed.

## Non-Goals

- No backend URL validation, allowlist, authentication, or rate limiting.
- No changes to Worker provider routing.
- No new AI providers.
- No branch-specific or Cloudflare environment-specific feature flags.
- No changes to deterministic compatibility authority or fallback behavior.
