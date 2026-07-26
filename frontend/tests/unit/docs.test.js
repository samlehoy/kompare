/**
 * Keeps docs/ honest.
 *
 * The core docs are the project's source of truth, but prose cannot verify
 * itself: paths get renamed, tools get moved, endpoints get added. Everything
 * here is a claim docs/ makes that can be checked mechanically against the
 * repository, so a stale claim fails the build instead of quietly misleading
 * the next reader.
 *
 * Deliberately NOT checked: anything whose value changes on the commit that
 * records it (release SHAs, deployment ids) or on every legitimate change
 * (test counts). Those are written as unnumbered statements instead — see
 * docs/PROJECT_STATUS.md.
 */
import { describe, expect, test } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

// Vitest runs from frontend/; the docs being checked live one level up.
const REPO = resolve(process.cwd(), '..');
const DOCS = join(REPO, 'docs');
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'out', '.wrangler', '.dev-logs']);

/**
 * Paths docs mention on purpose even though they are absent. Every entry needs
 * a reason: if you cannot write one, the mention is a bug, not an exception.
 */
const INTENTIONALLY_ABSENT = new Map([
  ['catalog.json', 'removed legacy catalog, named so nobody reintroduces it'],
  ['data/catalog.json', 'removed legacy catalog, named so nobody reintroduces it'],
  ['sample_products.json', 'removed legacy sample catalog'],
  ['data/sample_products.json', 'removed legacy sample catalog'],
  ['data/vector_index/', 'generated locally, gitignored — must never be committed'],
  ['data/vector_index/manifest.json', 'generated locally, gitignored'],
  ['data/vector_index/metadata.jsonl', 'generated locally, gitignored'],
  ['data/vector_index/embeddings.npy', 'generated locally, gitignored'],
  ['data/vector_index/embedding_cache.jsonl', 'generated locally, gitignored'],
  ['clean-data.mjs', 'never committed; its output is baked into components.json — see PROJECT_STATUS backlog'],
  ['frontend/out/', 'static export produced by the build, gitignored'],
  ['.dev-logs/', 'dev.ps1 writes logs here at runtime, gitignored'],
  ['kompare/', 'repository root shown as the top of the file-structure tree'],
  ['Next.js', 'framework name, not a file — the .js suffix makes it look like one'],
]);

/** Endpoints docs describe as planned rather than built. */
const PLANNED_ENDPOINTS = new Set(['/api/build/ai-upgrade']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(relative(REPO, full).replace(/\\/g, '/'));
  }
  return out;
}

const FILES = walk(REPO);
const BASENAMES = new Set(FILES.map((f) => basename(f)));
const DIRS = new Set(FILES.flatMap((f) => {
  const parts = f.split('/');
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'));
}));

const DOC_FILES = readdirSync(DOCS)
  .filter((f) => f.endsWith('.md'))
  .map((f) => ({ name: `docs/${f}`, text: readFileSync(join(DOCS, f), 'utf8') }));

const PATH_LIKE = /^[\w./-]+\.(js|jsx|mjs|py|json|csv|md|toml|css|jsonl|ps1)$/;
const DIR_LIKE = /^[\w./-]+\/$/;

function codeSpans(text) {
  return [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim());
}

/**
 * Directory trees and shell snippets live in fenced blocks, where filenames are
 * bare words rather than code spans. Splitting on whitespace and box-drawing
 * characters is enough to recover them.
 */
function fencedTokens(text) {
  return [...text.matchAll(/```[\w]*\n([\s\S]*?)```/g)]
    .flatMap((m) => m[1].split(/[\s│├└─┌┐┘┬┴┼|,'"()]+/))
    .filter(Boolean);
}

function resolves(token) {
  if (DIR_LIKE.test(token)) {
    const d = token.replace(/\/$/, '');
    return DIRS.has(d) || [...DIRS].some((x) => x.endsWith(`/${d}`));
  }
  if (token.includes('/')) {
    return FILES.includes(token) || FILES.some((f) => f.endsWith(`/${token}`));
  }
  return BASENAMES.has(token);
}

describe('docs/ describes the repository as it actually is', () => {
  test('every file and directory docs names exists', () => {
    const broken = [];
    for (const doc of DOC_FILES) {
      for (const token of [...codeSpans(doc.text), ...fencedTokens(doc.text)]) {
        if (!PATH_LIKE.test(token) && !DIR_LIKE.test(token)) continue;
        if (INTENTIONALLY_ABSENT.has(token)) continue;
        if (!resolves(token)) broken.push(`${doc.name}: \`${token}\``);
      }
    }
    expect(broken, `docs name paths that do not exist:\n${broken.join('\n')}`).toEqual([]);
  });

  test('every python -m command docs give points at a real module', () => {
    const broken = [];
    for (const doc of DOC_FILES) {
      for (const [, mod] of doc.text.matchAll(/python -m ([\w.]+)/g)) {
        // Dotted names are repo packages; bare ones (pytest) are installed tools.
        if (!mod.includes('.')) continue;
        const asFile = `${mod.replace(/\./g, '/')}.py`;
        if (!FILES.includes(asFile)) broken.push(`${doc.name}: python -m ${mod} → ${asFile}`);
      }
    }
    expect(broken, `docs give commands that cannot run:\n${broken.join('\n')}`).toEqual([]);
  });

  test('every link between docs resolves', () => {
    const broken = [];
    for (const doc of DOC_FILES) {
      for (const [, target] of doc.text.matchAll(/\]\(([^)]+)\)/g)) {
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        const clean = target.split('#')[0];
        if (!clean) continue;
        const full = resolve(DOCS, clean).replace(/\\/g, '/');
        const rel = relative(REPO, full).replace(/\\/g, '/');
        if (!FILES.includes(rel) && !DIRS.has(rel)) broken.push(`${doc.name}: ](${target})`);
      }
    }
    expect(broken, `docs link to files that do not exist:\n${broken.join('\n')}`).toEqual([]);
  });

  test('every /api endpoint docs mention is routed by the Worker', () => {
    const router = readFileSync(join(REPO, 'backend_worker/index.js'), 'utf8');
    const routed = new Set([...router.matchAll(/"(\/api\/[\w/-]+)"/g)].map((m) => m[1]));
    const undocumented = [];
    for (const doc of DOC_FILES) {
      for (const [, path] of doc.text.matchAll(/(\/api\/[\w/-]+)/g)) {
        if (PLANNED_ENDPOINTS.has(path) || routed.has(path)) continue;
        undocumented.push(`${doc.name}: ${path}`);
      }
    }
    expect(undocumented, `docs mention endpoints the Worker does not route:\n${undocumented.join('\n')}`).toEqual([]);
  });
});
