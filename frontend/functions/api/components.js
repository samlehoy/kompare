import { loadComponents } from './pc-builder-core.js';

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
  try {
    const { request } = context;
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const q = url.searchParams.get("q");
    const maxPriceStr = url.searchParams.get("max_price");
    
    let limit = parseInt(url.searchParams.get("limit") || "100", 10);
    if (isNaN(limit) || limit < 1) limit = 100;
    if (limit > 2000) limit = 2000;
    
    let offset = parseInt(url.searchParams.get("offset") || "0", 10);
    if (isNaN(offset) || offset < 0) offset = 0;

    let items = loadComponents();

    if (category) {
      items = items.filter(c => c.category === category);
    }

    if (q) {
      const ql = q.toLowerCase().trim();
      items = items.filter(c => (c.name || "").toLowerCase().includes(ql));
    }

    if (maxPriceStr !== null && maxPriceStr !== "") {
      const maxPrice = parseInt(maxPriceStr, 10);
      if (!isNaN(maxPrice) && maxPrice >= 0) {
        items = items.filter(c => (c.price_idr || 0) <= maxPrice);
      }
    }

    // Sorted by price ascending
    items.sort((a, b) => (a.price_idr || 0) - (b.price_idr || 0));

    const total = items.length;
    const page = items.slice(offset, offset + limit);

    return new Response(
      JSON.stringify({
        total,
        offset,
        limit,
        items: page
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
