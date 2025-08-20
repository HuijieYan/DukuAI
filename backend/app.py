# duku-visual-diff backend (FastAPI) — with absolute URLs and /recompute
import io
import os
import json
import uuid
from datetime import datetime
from typing import List, Optional, Dict
import math

import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Header, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from PIL import Image

STORAGE_ROOT = os.path.join(os.path.dirname(__file__), "storage")
os.makedirs(STORAGE_ROOT, exist_ok=True)

API_KEY_ENV = "DUKU_API_KEY"

app = FastAPI(title="Duku AI - Visual Change Detection MVP", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173","http://127.0.0.1:5173","http://localhost:3000","http://127.0.0.1:3000","*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/files", StaticFiles(directory=STORAGE_ROOT), name="files")

class Region(BaseModel):
    x: float
    y: float
    w: float
    h: float

class ComparisonOut(BaseModel):
    id: str
    createdAt: str
    width: int
    height: int
    threshold: int
    diffPercentage: float
    ignoreRegions: List[Region]
    urls: Dict[str, str]

def _auth_check(x_api_key: Optional[str]):
    needed = os.getenv(API_KEY_ENV)
    if not needed:
        return
    if not x_api_key or x_api_key != needed:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")

def load_image_from_upload(file: UploadFile) -> Image.Image:
    content = file.file.read()
    try:
        img = Image.open(io.BytesIO(content)).convert("RGBA")
    except Exception:
        raise HTTPException(status_code=400, detail=f"Unsupported image format: {file.filename}")
    return img

def resize_to_match(a: Image.Image, b: Image.Image) -> Image.Image:
    if a.size == b.size:
        return b
    return b.resize(a.size, Image.BILINEAR)

def apply_ignore_regions(mask: np.ndarray, regions: List[Region]) -> None:
    h, w = mask.shape
    PAD = 2  # pixels of safety to cover anti-aliased edges

    for r in regions:
        # Convert normalized -> pixel box with floor/ceil, then pad
        x0 = math.floor(r.x * w) - PAD
        y0 = math.floor(r.y * h) - PAD
        x1 = math.ceil((r.x + r.w) * w) + PAD
        y1 = math.ceil((r.y + r.h) * h) + PAD

        # clamp to mask bounds
        x0 = max(0, x0); y0 = max(0, y0)
        x1 = min(w, x1); y1 = min(h, y1)

        if x1 > x0 and y1 > y0:
            mask[y0:y1, x0:x1] = False

def make_diff_image(before: Image.Image, mask: np.ndarray) -> Image.Image:
    base = before.convert("RGBA")
    overlay = Image.new("RGBA", base.size, (255, 0, 0, 0))
    alpha = 120
    arr = np.array(overlay); arr[mask] = [255, 0, 0, alpha]
    overlay = Image.fromarray(arr, mode="RGBA")
    return Image.alpha_composite(base, overlay)

def compute_diff(before: Image.Image, after: Image.Image, threshold: int, regions: List[Region]):
    after_aligned = resize_to_match(before, after)
    b_arr = np.array(before.convert("RGB"), dtype=np.int16)
    a_arr = np.array(after_aligned.convert("RGB"), dtype=np.int16)
    diff = np.abs(b_arr - a_arr)
    diff_gray = diff.max(axis=2)
    mask = diff_gray > threshold
    apply_ignore_regions(mask, regions)
    changed = int(mask.sum()); total = mask.size
    pct = (changed / total) * 100.0
    return {"mask": mask, "diff_pct": float(round(pct, 4)), "size": before.size}

def save_result(result_id: str, before: Image.Image, after: Image.Image, diff_img: Image.Image, meta):
    d = os.path.join(STORAGE_ROOT, result_id); os.makedirs(d, exist_ok=True)
    before.save(os.path.join(d, "before.png"))
    after.save(os.path.join(d, "after.png"))
    diff_img.save(os.path.join(d, "diff.png"))
    with open(os.path.join(d, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    return {
        "before": f"/files/{result_id}/before.png",
        "after": f"/files/{result_id}/after.png",
        "diff": f"/files/{result_id}/diff.png",
        "meta": f"/files/{result_id}/meta.json",
    }

def _abs(request: Request, path: str) -> str:
    base = str(request.base_url).rstrip("/")
    return f"{base}{path}"

@app.post("/comparison", response_model=ComparisonOut)
async def create_comparison(
    request: Request,
    before: UploadFile = File(...),
    after: UploadFile = File(...),
    threshold: int = Form(30, ge=0, le=255),
    ignore_regions: Optional[str] = Form(None),
    x_api_key: Optional[str] = Header(None, convert_underscores=False)
):
    _auth_check(x_api_key)
    regions: List[Region] = []
    if ignore_regions:
        try:
            regions = [Region(**r) for r in json.loads(ignore_regions)]
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid ignore_regions: {e}")
    b_img = load_image_from_upload(before)
    a_img = load_image_from_upload(after)
    info = compute_diff(b_img, a_img, threshold, regions)
    diff_img = make_diff_image(b_img, info["mask"])
    result_id = uuid.uuid4().hex
    meta = {
        "id": result_id,
        "createdAt": datetime.utcnow().isoformat() + "Z",
        "width": info["size"][0],
        "height": info["size"][1],
        "threshold": threshold,
        "diffPercentage": info["diff_pct"],
        "ignoreRegions": [r.model_dump() for r in regions],
    }
    urls = save_result(result_id, b_img, a_img, diff_img, meta)
    urls_abs = {k: _abs(request, v) for k, v in urls.items() if k != "meta"}
    return JSONResponse({**meta, "urls": urls_abs})

@app.get("/comparison/{result_id}", response_model=ComparisonOut)
def get_comparison(result_id: str, request: Request):
    d = os.path.join(STORAGE_ROOT, result_id)
    meta_path = os.path.join(d, "meta.json")
    if not os.path.exists(meta_path):
        raise HTTPException(status_code=404, detail="Comparison not found")
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    urls = {
        "before": _abs(request, f"/files/{result_id}/before.png"),
        "after":  _abs(request, f"/files/{result_id}/after.png"),
        "diff":   _abs(request, f"/files/{result_id}/diff.png"),
    }
    return JSONResponse({**meta, "urls": urls})

@app.get("/comparison")
def list_comparisons(request: Request, limit: int = Query(20, ge=1, le=100)):
    items = []
    for rid in os.listdir(STORAGE_ROOT):
        meta_path = os.path.join(STORAGE_ROOT, rid, "meta.json")
        if os.path.isfile(meta_path):
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                meta["urls"] = {
                    "before": _abs(request, f"/files/{rid}/before.png"),
                    "after":  _abs(request, f"/files/{rid}/after.png"),
                    "diff":   _abs(request, f"/files/{rid}/diff.png"),
                }
                items.append(meta)
            except Exception:
                continue
    items.sort(key=lambda m: m.get("createdAt", ""), reverse=True)
    return {"items": items[:limit]}

@app.post("/comparison/{result_id}/recompute", response_model=ComparisonOut)
def recompute(
    result_id: str,
    request: Request,
    threshold: int = Form(30, ge=0, le=255),
    ignore_regions: Optional[str] = Form(None),
    x_api_key: Optional[str] = Header(None, convert_underscores=False),
):
    _auth_check(x_api_key)
    d = os.path.join(STORAGE_ROOT, result_id)
    b_path = os.path.join(d, "before.png"); a_path = os.path.join(d, "after.png")
    if not (os.path.exists(b_path) and os.path.exists(a_path)):
        raise HTTPException(status_code=404, detail="Source images not found")
    regions: List[Region] = []
    if ignore_regions:
        try:
            regions = [Region(**r) for r in json.loads(ignore_regions)]
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid ignore_regions: {e}")
    b_img = Image.open(b_path).convert("RGBA")
    a_img = Image.open(a_path).convert("RGBA")
    info = compute_diff(b_img, a_img, threshold, regions)
    diff_img = make_diff_image(b_img, info["mask"])
    new_id = uuid.uuid4().hex
    meta = {
        "id": new_id,
        "createdAt": datetime.utcnow().isoformat() + "Z",
        "width": info["size"][0],
        "height": info["size"][1],
        "threshold": threshold,
        "diffPercentage": info["diff_pct"],
        "ignoreRegions": [r.model_dump() for r in regions],
    }
    urls = save_result(new_id, b_img, a_img, diff_img, meta)
    urls_abs = {k: _abs(request, v) for k, v in urls.items() if k != "meta"}
    return JSONResponse({**meta, "urls": urls_abs})

@app.get("/health")
def health():
  return {"ok": True}
