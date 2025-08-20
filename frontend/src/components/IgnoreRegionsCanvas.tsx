import React, { useEffect, useRef, useState } from "react";
import type { Region } from "../types";

/** Draw rectangles over an image; outputs normalized regions */
type Props = {
  imageUrl: string;          // used only to re-render when image changes
  regions: Region[];
  onChange: (regions: Region[]) => void;
};

export default function IgnoreRegionsCanvas({ imageUrl, regions, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<Region | null>(null);

  // Fit drawing buffer to CSS size & DPR, and redraw
  const fitToSize = () => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Set the backing store size
    c.width = Math.max(1, Math.round(rect.width * dpr));
    c.height = Math.max(1, Math.round(rect.height * dpr));

    // Scale so 1 unit in canvas space == 1 CSS pixel
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    draw();
  };

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    // Observe size changes of the canvas element
    const ro = new ResizeObserver(() => fitToSize());
    ro.observe(c);

    // Initial fit
    fitToSize();

    // Also refit on DPR/orientation changes
    const onResize = () => fitToSize();
    window.addEventListener("resize", onResize);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
    // re-run when image changes so the container size stabilizes
  }, [imageUrl]);

  useEffect(() => {
    draw();
  }, [regions, current]);

  const draw = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const w = c.clientWidth;   // CSS pixels
    const h = c.clientHeight;

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "#2f6df2";
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(47,109,242,0.2)";

    [...regions, ...(current ? [current] : [])].forEach((r) => {
      const x = r.x * w, y = r.y * h, rw = r.w * w, rh = r.h * h;
      ctx.fillRect(x, y, rw, rh);
      ctx.strokeRect(x, y, rw, rh);
    });
  };

  const getPos = (e: React.MouseEvent) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x, y, rect };
  };

  const onDown = (e: React.MouseEvent) => {
    const { x, y } = getPos(e);
    setDragStart({ x, y });
  };

  const onMove = (e: React.MouseEvent) => {
    if (!dragStart) return;
    const { x, y, rect } = getPos(e);
    const nx = Math.min(dragStart.x, x);
    const ny = Math.min(dragStart.y, y);
    const nw = Math.abs(x - dragStart.x);
    const nh = Math.abs(y - dragStart.y);

    // Normalize using CSS size, not backing store size
    const r: Region = {
      x: nx / rect.width,
      y: ny / rect.height,
      w: nw / rect.width,
      h: nh / rect.height,
    };
    setCurrent(r);
  };

  const onUp = () => {
    if (current) onChange([...regions, current]);
    setCurrent(null);
    setDragStart(null);
  };

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        cursor: "crosshair",
      }}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
    />
  );
}
