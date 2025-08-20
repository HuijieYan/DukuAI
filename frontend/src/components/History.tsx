import React from "react";
import type { ComparisonResult } from "../types";

type Props = { items: ComparisonResult[]; onPick: (id: string) => void };

export default function History({ items, onPick }: Props) {
  if (!items.length) return <div className="muted">No history yet.</div>;
  return (
    <div className="history">
      {items.map((it) => {
        const diffUrl = it.urls?.diff;
        return (
          <div key={it.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            {diffUrl ? (
              <img className="thumb" src={diffUrl} alt="thumb" onClick={() => onPick(it.id)} />
            ) : (
              <div className="thumb" style={{ display: "grid", placeItems: "center" }} onClick={() => onPick(it.id)}>N/A</div>
            )}
            <div className="tag">#{it.id.slice(0, 6)} • {it.diffPercentage.toFixed(2)}%</div>
          </div>
        );
      })}
    </div>
  );
}
