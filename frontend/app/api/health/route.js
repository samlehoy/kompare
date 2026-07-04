export const runtime = 'edge';

import { loadComponents } from '../pc-builder-core.js';

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  try {
    const count = loadComponents().length;
    return new Response(
      JSON.stringify({
        status: "ok",
        version: "0.1.0",
        components_loaded: count
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
