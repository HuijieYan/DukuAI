import React, { useEffect, useState } from "react";
import { createComparison, getComparison, listComparisons, recomputeComparison } from "./api";
import type { ComparisonResult, Region } from "./types";
import ImageUpload from "./components/ImageUpload";
import IgnoreRegionCrop from "./components/IgnoreRegionCrop";
import History from "./components/History";

export default function App() {
  const [before, setBefore] = useState<File | null>(null);
  const [after, setAfter] = useState<File | null>(null);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [sensitivity, setSensitivity] = useState<number>(30);
  const [regions, setRegions] = useState<Region[]>([]);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<ComparisonResult[]>([]);
  const [editing, setEditing] = useState<boolean>(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const items = await listComparisons();
      setRecent(items);
    })();
  }, []);

  const canCompare = ((!!before && !!after) || !!loadedId) && !busy;

  const onChoose = (b: File | null, a: File | null) => {
    setBefore(b);
    setAfter(a);
    setResult(null);
    setRegions([]);
    setEditing(false);
    setLoadedId(null);
    setBeforeUrl(b ? URL.createObjectURL(b) : null);
    setAfterUrl(a ? URL.createObjectURL(a) : null);
  };

  async function urlToFile(url: string, filename: string): Promise<File> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}`);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || "image/png" });
  }

  const doCompare = async () => {
    setBusy(true);
    try {
      let res: ComparisonResult;
      if (before && after) {
        res = await createComparison(before, after, sensitivity, regions);
      } else if (loadedId) {
        try {
          res = await recomputeComparison(loadedId, sensitivity, regions);
        } catch {
          if (!beforeUrl || !afterUrl) throw new Error("Missing image URLs");
          const bf = await urlToFile(beforeUrl, `before-${loadedId}.png`);
          const af = await urlToFile(afterUrl, `after-${loadedId}.png`);
          res = await createComparison(bf, af, sensitivity, regions);
        }
      } else {
        return;
      }
      setResult(res);
      setRecent((prev) => [res, ...prev.filter((x) => x.id !== res.id)].slice(0, 12));
      setLoadedId(res.id);
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const loadFromId = async (id: string) => {
    try {
      const r = await getComparison(id);
      setLoadedId(id);
      setResult(r);
      setBeforeUrl(r.urls.before);
      setAfterUrl(r.urls.after);
      setRegions(r.ignoreRegions || []);
      setSensitivity(100 - Math.round((r.threshold / 255) * 100));
      setBefore(null);
      setAfter(null);
      setEditing(true);
    } catch {
      alert("Could not load comparison");
    }
  };

  const pixelCutoff = Math.round(((100 - sensitivity) / 100) * 255);

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Duku AI – Visual Change Detection MVP</h1>
        <div className="tag mono">Sensitivity: {sensitivity} (cutoff={pixelCutoff})</div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row">
          <div className="col" style={{ flex: "1 1 100%" }}>
            <label>Upload images</label>
            <ImageUpload onChange={onChoose} />
            <div style={{ marginTop: 12 }}>
              <label>Sensitivity</label>
              <input
                type="range"
                min={0}
                max={100}
                value={sensitivity}
                onChange={(e) => setSensitivity(parseInt(e.target.value))}
              />
              <div className="muted">Higher = more sensitive (smaller changes count as differences)</div>
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn" disabled={!canCompare} onClick={doCompare}>
                {busy ? "Comparing..." : "Compare"}
              </button>
              <button className="btn" onClick={() => setEditing((v) => !v)} disabled={!beforeUrl}>
                {editing ? "Done Drawing" : "Ignore regions"}
              </button>
              <button className="btn" onClick={() => setRegions([])} disabled={!regions.length}>
                Clear regions
              </button>
            </div>
          </div>
        </div>

        <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start", marginTop: 16 }}>
          <div className="col" style={{ flex: "1 1 0", minWidth: 0 }}>
            <div className="muted">Before</div>
            {beforeUrl ? (
              <IgnoreRegionCrop imageUrl={beforeUrl} regions={regions} onChange={setRegions} enabled={editing} />
            ) : (
              <div className="muted">No image</div>
            )}
          </div>

          <div className="col" style={{ flex: "1 1 0", minWidth: 0 }}>
            <div className="muted">After</div>
            {afterUrl ? (
              <img src={afterUrl} alt="after" style={{ display: "block", width: "100%", height: "auto" }} />
            ) : (
              <div className="muted">No image</div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginTop: 0 }}>Result</h3>
        {!result ? (
          <div className="muted">Run a comparison to see the diff.</div>
        ) : (
          <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
            <div className="col" style={{ flex: "0 0 260px" }}>
              <div className="muted">Diff score</div>
              <div className="mono" style={{ fontSize: 28 }}>{result.diffPercentage.toFixed(4)}%</div>
              <div className="muted">ID: <span className="mono">{result.id}</span></div>
            </div>
            <div className="col" style={{ flex: "1 1 0" }}>
              <div className="muted">Diff visualization</div>
              <img src={result.urls.diff} alt="diff" style={{ display: "block", width: "100%", height: "auto" }} />
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Recent comparisons</h3>
        <History items={recent} onPick={loadFromId} />
      </div>
    </div>
  );
}
