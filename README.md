# DUKU AI — Visual Change Detection MVP

A small full‑stack web app that detects and visualizes visual diffs between two screenshots.

- **Backend:** FastAPI (Python), Pillow, NumPy
- **Frontend:** React + Vite + TypeScript
- **Diffing approach:** pixel‑wise absolute difference (max over RGB channels) with a tunable threshold.
- **Bonus:** ignore regions (draw rectangles), recent history, optional API key auth.

---

## 0 Prerequisites

- **Python 3.10+** (check with `python --version`)
- **Node.js 18+** and **npm** (check with `node -v` and `npm -v`)

> If `python` runs Python 2.x on your system, use `python3` instead (macOS/Linux).
> On Windows, use `python` (from the Microsoft Store or python.org installer).

---

## 1 Backend — FastAPI

The backend exposes:
- `POST /comparison` — create a comparison (multipart form: `before` file, `after` file, `threshold` 0..255, `ignore_regions` JSON)
- `GET /comparison/{id}` — fetch a previous comparison
- `GET /comparison?limit=20` — list recent comparisons
- Static files: `/files/<id>/before.png|after.png|diff.png`

### Windows (PowerShell)

```powershell
cd backend
python -m venv .venv
. .\.venv\Scripts\Activate.ps1   # activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

If activation is blocked, allow local scripts **once** (admin PowerShell):
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

To deactivate later:
```powershell
deactivate
```

### Windows (Command Prompt / cmd.exe)

```cmd
cd backend
python -m venv .venv
.\.venv\Scripts\Activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

To deactivate later:
```cmd
deactivate
```

### macOS / Linux (bash/zsh)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

To deactivate later:
```bash
deactivate
```

### Optional API key auth

Set an environment variable **before** running Uvicorn, then provide header `x-api-key: your-key` from the client.

- PowerShell:
  ```powershell
  $env:DUKU_API_KEY = "your-key"
  uvicorn app:app --reload --port 8000
  ```
- cmd.exe:
  ```cmd
  set DUKU_API_KEY=your-key
  uvicorn app:app --reload --port 8000
  ```
- macOS/Linux:
  ```bash
  export DUKU_API_KEY="your-key"
  uvicorn app:app --reload --port 8000
  ```

### Quick API smoke test

- PowerShell:
  ```powershell
  iwr http://localhost:8000/health
  ```
- macOS/Linux:
  ```bash
  curl http://localhost:8000/health
  ```

---

## 2 Frontend — React (Vite + TypeScript)

By default, the UI talks to `http://localhost:8000`. If you run the backend elsewhere, create `frontend/.env`:
```
VITE_API_BASE=http://localhost:8000
```

### All platforms

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## 3 Using the app

1. Upload **Before** and **After** images.
2. Adjust the **Sensitivity threshold** (0–100 in the UI → mapped to 0–255 on the server).
   - Higher value = more strict (smaller changes will count as differences).
3. (Optional) Click **Ignore regions** and drag rectangles over areas to exclude.
4. Click **Compare**.
5. See the **diff score** (0–100%) and the **diff image** (red overlay).
6. Browse **Recent comparisons**; click any thumbnail to reload its result.

### Sample images

Try the 3 pairs under `sample_images/`:
- `before1.png` vs `after1.png` — moved button + text tweak
- `before2.png` vs `after2.png` — color change + new badge
- `before3.png` vs `after3.png` — subtle text change (try higher sensitivity)

---

## How it works (brief)

- If sizes differ, the **after** image is resized to match **before** (bilinear).
- Compute per-pixel absolute difference in RGB, then take the **max channel**.
- Threshold to a boolean change mask; **ignore regions** zero out parts of the mask.
- **Diff percentage** = changed_pixels / total_pixels × 100.
- Visual diff = semi‑transparent red overlay on the **before** image.

---

## API details

### `POST /comparison` (multipart form)

Fields:
- `before`: file (image)
- `after`: file (image)
- `threshold`: integer 0–255 (default 30)
- `ignore_regions`: JSON string of an array of rectangles with normalized coordinates, e.g.:
  ```json
  [
    {"x": 0.10, "y": 0.20, "w": 0.30, "h": 0.15}
  ]
  ```

Response:
```json
{
  "id": "abc123",
  "createdAt": "2025-08-20T12:34:56Z",
  "width": 1280,
  "height": 720,
  "threshold": 30,
  "diffPercentage": 1.2345,
  "ignoreRegions": [ ... ],
  "urls": { "before": "...", "after": "...", "diff": "..." }
}
```

### `GET /comparison/{id}`

Returns the saved metadata and URLs for the given comparison.

### `GET /comparison?limit=20`

Returns recent comparisons (most recent first).

---

## Assumptions & trade‑offs

- **Resizing:** After is resized to before (bilinear) for a pragmatic MVP.
- **Thresholding:** Max‑channel absolute difference → simple and predictable.
- **Diff viz:** Semi‑transparent red overlay.
- **Storage:** On disk at `backend/storage/<id>/`.
- **Auth:** Simple API key via `DUKU_API_KEY` env var.

## What to improve with more time

- Alignment (SSIM / feature matching) for small layout shifts.
- Noise handling (morphology, anti‑aliasing aware diffs, small‑area filtering).
- Performance (tiling/streaming for very large images; async I/O).
- UX (zoom/pan, slider/opacity controls, side‑by‑side wipe).
- Ignore tools (move/resize, polygons), presets per project.
- Persistence (SQLite/Postgres), projects/users, API tokens per user.
- Tests (unit + E2E with Playwright).

## Challenges

- Keeping the MVP **simple** yet useful (ignore regions, history).
- Dimension mismatch handled without over‑engineering alignment.

---

## Project layout

```
duku-visual-diff/
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   └── storage/                  # generated comparison outputs
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── api.ts
│       ├── main.tsx
│       ├── types.ts
│       └── components/
│           ├── History.tsx
│           ├── ImageUpload.tsx
│           └── IgnoreRegionsCanvas.tsx
└── sample_images/
    ├── before1.png  after1.png
    ├── before2.png  after2.png
    └── before3.png  after3.png
```
