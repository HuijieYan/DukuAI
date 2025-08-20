import type { ComparisonResult, Region } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

function absolutizeUrls<T extends { urls?: Record<string, string> }>(obj: T): T {
  if (!obj?.urls) return obj;
  const abs = (p: string) => (p?.startsWith("http") ? p : `${API_BASE}${p}`);
  return { ...obj, urls: { before: abs(obj.urls.before), after: abs(obj.urls.after), diff: abs(obj.urls.diff) } };
}

export async function createComparison(
  before: File,
  after: File,
  sensitivity: number,
  regions: Region[]
): Promise<ComparisonResult> {
  const fd = new FormData();
  fd.append("before", before);
  fd.append("after", after);
  const cutoff = Math.round(((100 - sensitivity) / 100) * 255);
  fd.append("threshold", String(cutoff));
  if (regions.length) fd.append("ignore_regions", JSON.stringify(regions));
  const res = await fetch(`${API_BASE}/comparison`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`Comparison failed: ${await res.text()}`);
  const data = await res.json();
  return absolutizeUrls(data);
}

export async function recomputeComparison(id: string, sensitivity: number, regions: Region[]): Promise<ComparisonResult> {
  const fd = new FormData();
  const cutoff = Math.round(((100 - sensitivity) / 100) * 255);
  fd.append("threshold", String(cutoff));
  if (regions.length) fd.append("ignore_regions", JSON.stringify(regions));
  const res = await fetch(`${API_BASE}/comparison/${id}/recompute`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(await res.text());
  return absolutizeUrls(await res.json());
}

export async function getComparison(id: string): Promise<ComparisonResult> {
  const res = await fetch(`${API_BASE}/comparison/${id}`);
  if (!res.ok) throw new Error("Not found");
  return absolutizeUrls(await res.json());
}

export async function listComparisons(): Promise<ComparisonResult[]> {
  const res = await fetch(`${API_BASE}/comparison?limit=20`);
  if (!res.ok) return [];
  const j = await res.json();
  const items = (j.items ?? []) as any[];
  return items.map((m) => ({
    ...m,
    urls: {
      before: `${API_BASE}/files/${m.id}/before.png`,
      after:  `${API_BASE}/files/${m.id}/after.png`,
      diff:   `${API_BASE}/files/${m.id}/diff.png`,
    },
  }));
}
