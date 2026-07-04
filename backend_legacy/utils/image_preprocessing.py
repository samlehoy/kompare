"""Resize / compress images before sending to Gemini.

Gemini accepts large images but smaller ones are faster and cheaper. We
re-encode to JPEG (smaller than PNG for photos) and cap the longest edge.
EXIF rotation is applied so portrait photos don't end up sideways.
"""

from __future__ import annotations

import io
from typing import Tuple

MAX_EDGE_PX = 1280
JPEG_QUALITY = 85


def prepare_image(raw_bytes: bytes) -> Tuple[bytes, dict]:
    """Resize + re-encode an uploaded image. Returns (jpeg_bytes, metadata).

    Raises ValueError if the input isn't a parseable image.
    """
    from PIL import Image, ImageOps  # lazy: only required when this is called

    try:
        img = Image.open(io.BytesIO(raw_bytes))
        img.load()  # force decode early so we surface bad-image errors here
    except Exception as exc:
        raise ValueError(f"Not a valid image: {exc}") from exc

    original_size = img.size
    original_format = img.format

    # Honor EXIF orientation, then drop it.
    img = ImageOps.exif_transpose(img)

    # Convert to RGB (drop alpha for JPEG; flatten paletted modes).
    if img.mode != "RGB":
        background = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode in ("RGBA", "LA"):
            background.paste(img, mask=img.split()[-1])
        else:
            background.paste(img.convert("RGB"))
        img = background

    # Cap longest edge.
    longest = max(img.size)
    if longest > MAX_EDGE_PX:
        scale = MAX_EDGE_PX / longest
        new_size = (int(img.size[0] * scale), int(img.size[1] * scale))
        img = img.resize(new_size, Image.LANCZOS)

    out = io.BytesIO()
    img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    jpeg_bytes = out.getvalue()

    return jpeg_bytes, {
        "original_size_px": original_size,
        "original_format": original_format,
        "processed_size_px": img.size,
        "processed_bytes": len(jpeg_bytes),
        "original_bytes": len(raw_bytes),
    }
