import React, { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KImage, Rect } from "react-konva";
import useImage from "use-image";
import type { Region } from "../types";

type Props = {
  imageUrl: string;
  regions: Region[];              // normalized [0..1]
  onChange: (regions: Region[]) => void;
  enabled?: boolean;              // when false, interactions disabled
};

function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }

export default function IgnoreRegionsKonva({ imageUrl, regions, onChange, enabled = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [imgEl] = useImage(imageUrl, "anonymous");
  const [drawing, setDrawing] = useState<Region | null>(null);

  // Resize stage to container while preserving image aspect ratio
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !imgEl) return;
      const cw = containerRef.current.clientWidth || 1;
      const aspect = imgEl.height / imgEl.width || 1;
      const nw = cw;
      const nh = Math.round(cw * aspect);
      setStageSize((prev) => (prev.w === nw && prev.h === nh) && prev || { w: nw, h: nh });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [imgEl]);

  const toNorm = (x: number, y: number) => ({
    x: clamp01(x / Math.max(1, stageSize.w)),
    y: clamp01(y / Math.max(1, stageSize.h)),
  });
  const toPx = (r: Region) => ({
    x: r.x * stageSize.w, y: r.y * stageSize.h,
    w: r.w * stageSize.w, h: r.h * stageSize.h,
  });

  // Draw new rectangle
  const handleMouseDown = (e: any) => {
    if (!enabled) return;
    const targetName = e.target?.name?.();
    if (targetName === "region") return;
    const pos = e.target.getStage().getPointerPosition();
    if (!pos) return;
    const p = toNorm(pos.x, pos.y);
    setDrawing({ x: p.x, y: p.y, w: 0, h: 0 });
  };
  const handleMouseMove = (e: any) => {
    if (!enabled || !drawing) return;
    const pos = e.target.getStage().getPointerPosition();
    if (!pos) return;
    const p = toNorm(pos.x, pos.y);
    const nx = Math.min(drawing.x, p.x);
    const ny = Math.min(drawing.y, p.y);
    const nw = Math.abs(p.x - drawing.x);
    const nh = Math.abs(p.y - drawing.y);
    setDrawing({ x: nx, y: ny, w: nw, h: nh });
  };
  const handleMouseUp = () => {
    if (!enabled) return;
    if (drawing && drawing.w > 0.001 && drawing.h > 0.001) {
      onChange([...regions, drawing]);
    }
    setDrawing(null);
  };

  const updateRegion = (idx: number, next: Region) => {
    const safe: Region = {
      x: clamp01(next.x),
      y: clamp01(next.y),
      w: clamp01(next.w),
      h: clamp01(next.h),
    };
    const copy = regions.slice();
    copy[idx] = safe;
    onChange(copy);
  };

  const removeRegion = (idx: number) => {
    const copy = regions.slice();
    copy.splice(idx, 1);
    onChange(copy);
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <Stage
        width={stageSize.w}
        height={stageSize.h}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ borderRadius: 12, border: "1px solid #2a355e", background: "#0e1530" }}
      >
        <Layer>
          {imgEl && (
            <KImage image={imgEl} x={0} y={0} width={stageSize.w} height={stageSize.h} listening={false} />
          )}

          {regions.map((r, i) => {
            const p = toPx(r);
            return (
              <Rect
                key={i}
                name="region"
                x={p.x}
                y={p.y}
                width={Math.max(1, p.w)}
                height={Math.max(1, p.h)}
                stroke="#2f6df2"
                strokeWidth={2}
                fill="rgba(47,109,242,0.2)"
                draggable={enabled}
                onDblClick={() => removeRegion(i)}
                onDragEnd={(e) => {
                  const nx = clamp01(e.target.x() / stageSize.w);
                  const ny = clamp01(e.target.y() / stageSize.h);
                  updateRegion(i, { ...r, x: nx, y: ny });
                }}
              />
            );
          })}

          {drawing && (
            <Rect
              x={drawing.x * stageSize.w}
              y={drawing.y * stageSize.h}
              width={Math.max(1, drawing.w * stageSize.w)}
              height={Math.max(1, drawing.h * stageSize.h)}
              stroke="#2f6df2"
              strokeWidth={2}
              dash={[6, 6]}
              fill="rgba(47,109,242,0.15)"
              listening={false}
            />
          )}
        </Layer>
      </Stage>

      {enabled && (
        <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 8 }}>
          <span className="tag">Tip: drag to move, double‑click to delete</span>
        </div>
      )}
    </div>
  );
}
