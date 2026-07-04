"""Token-aware context pruning helpers shared across prompt builders.

Each Gemini prompt has its own preamble + schema, so the variable cost is the
catalog snippet we inject. This module owns the rules for:
- which product fields are kept (no rating noise, no scrape timestamps)
- how long descriptions are truncated (sentence-aware, not mid-word)
- a rough token estimator so callers can budget without paying for the SDK's
  token counter on every call

We use the rule of thumb: 1 token ≈ 4 characters of English/Indonesian text.
That's an overestimate for English and slightly under for Indonesian, both fine
for soft budgeting. Use `genai.count_tokens()` only when an exact figure matters.
"""

from __future__ import annotations

import re
from typing import Iterable

# Rough English/Indonesian heuristic. Real tokenizers vary by 10-30% but this is
# good enough for "is my prompt about to blow past the limit" decisions.
CHARS_PER_TOKEN = 4

# Keys we strip from any product dict before sending to Gemini. They add noise
# without informing recommendations.
PRODUCT_NOISE_KEYS = frozenset({
    "rating", "stock_status", "scraped_at", "created_at", "locale", "source",
    "tier", "image_path", "image_url", "subcategory",
})


def estimate_tokens(text: str) -> int:
    """Rough token count. Cheap, no SDK call."""
    if not text:
        return 0
    return max(1, len(text) // CHARS_PER_TOKEN)


def truncate_to_chars(text: str, max_chars: int) -> str:
    """Hard truncate to max_chars, but cut on a word boundary when possible."""
    if not text or len(text) <= max_chars:
        return text or ""
    cut = text[:max_chars]
    last_space = cut.rfind(" ")
    if last_space > max_chars - 50:  # only honor word boundary if it's near the end
        cut = cut[:last_space]
    return cut.rstrip(",.;:") + "…"


def summarize_description(text: str, *, max_sentences: int = 2, max_chars: int = 400) -> str:
    """Keep the first N sentences, then hard-cap by chars.

    Catalog descriptions are often comma-separated spec dumps with no real
    sentence punctuation — in that case we just char-cap.
    """
    if not text:
        return ""
    text = text.strip()
    sentences = re.split(r"(?<=[.!?])\s+", text)
    if len(sentences) > 1:
        text = " ".join(sentences[:max_sentences])
    return truncate_to_chars(text, max_chars)


def condense_product(product: dict, *, desc_chars: int = 300) -> dict:
    """Extract the comparison-relevant fields and trim the description.

    Keep `id`, `name`, `brand`, `category`, `price_idr`, `specs`, `description`.
    Drop noise keys. The result is what every Gemini prompt should embed.
    """
    return {
        "id": product.get("sku") or product.get("id"),
        "name": product.get("name"),
        "brand": product.get("brand"),
        "category": product.get("category"),
        "price_idr": product.get("price_idr"),
        "specs": product.get("specs") or {},
        "description": summarize_description(
            product.get("description") or "", max_chars=desc_chars,
        ),
    }


def condense_products(products: Iterable[dict], *, desc_chars: int = 300) -> list[dict]:
    return [condense_product(p, desc_chars=desc_chars) for p in products]


def condense_component(component: dict) -> dict:
    """Lighter shape for PC parts — no description, just identity + price + specs."""
    return {
        "sku": component.get("sku"),
        "name": component.get("name"),
        "brand": component.get("brand"),
        "category": component.get("category"),
        "price_idr": component.get("price_idr"),
        "specs": component.get("specs") or {},
    }
