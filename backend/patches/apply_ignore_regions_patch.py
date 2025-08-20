# Paste these functions into your backend/app.py (replace existing ones).

import numpy as np
from typing import List

def sanitize_regions(regions: List["Region"]) -> List["Region"]:
    """Clamp and fix incoming normalized regions to [0..1]; drop empties."""
    safe = []
    for r in regions:
        x = max(0.0, min(1.0, float(getattr(r, "x", 0.0))))
        y = max(0.0, min(1.0, float(getattr(r, "y", 0.0))))
        w = max(0.0, min(1.0, float(getattr(r, "w", 0.0))))
        h = max(0.0, min(1.0, float(getattr(r, "h", 0.0))))
        if w <= 0.0 or h <= 0.0:
            continue
        if x + w > 1.0: w = 1.0 - x
        if y + h > 1.0: h = 1.0 - y
        # recreate same type if it's a pydantic model
        try:
            safe.append(type(r)(x=x, y=y, w=w, h=h))
        except Exception:
            safe.append({"x": x, "y": y, "w": w, "h": h})
    return safe

def apply_ignore_regions(mask: np.ndarray, regions: List["Region"], pad_px: int = 2) -> None:
    """Set diff mask to False inside ignore rects. Pads by pad_px for edge robustness."""
    h, w = mask.shape
    for r in sanitize_regions(regions):
        x0 = max(0, int(r.x * w) - pad_px)
        y0 = max(0, int(r.y * h) - pad_px)
        x1 = min(w, int((r.x + r.w) * w) + pad_px)
        y1 = min(h, int((r.y + r.h) * h) + pad_px)
        if x1 > x0 and y1 > y0:
            mask[y0:y1, x0:x1] = False

# Ensure compute_diff(...) calls apply_ignore_regions(mask, regions)
