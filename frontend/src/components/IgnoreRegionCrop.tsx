import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactCrop, { Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import type { Region } from "../types";

type Props = {
  imageUrl: string;
  regions: Region[];                  // we use the first region (single selection)
  onChange: (regions: Region[]) => void;
  enabled?: boolean;
  resetSeed?: number;
};

function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }

export default function IgnoreRegionCrop({ imageUrl, regions, onChange, enabled = true, resetSeed = 0 }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const renderSize = useRef<{ w: number; h: number }>({ w: 1, h: 1 });

  const defaultCropPx = () => {
    const { w, h } = renderSize.current;
    return { unit: "px", x: Math.round(w * 0.1), y: Math.round(h * 0.1), width: Math.round(w * 0.3), height: Math.round(h * 0.2) } as Crop;
  };

  const [crop, setCrop] = useState<Crop>(() => defaultCropPx());

  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    renderSize.current = { w: Math.max(1, Math.round(rect.width)), h: Math.max(1, Math.round(rect.height)) };
    const r = regions[0];
    if (r) {
      setCrop({
        unit: "px",
        x: r.x * renderSize.current.w,
        y: r.y * renderSize.current.h,
        width: r.w * renderSize.current.w,
        height: r.h * renderSize.current.h,
      });
    } else {
      setCrop(defaultCropPx());
    }
  }, [imageUrl, regions.length]);

  useEffect(() => {
    setCrop(defaultCropPx());
  }, [resetSeed]);

  useEffect(() => {
    if (enabled && (!regions || regions.length === 0)) {
      setCrop(defaultCropPx());
    }
  }, [enabled]); // eslint-disable-line

  const onImageLoaded = (img: HTMLImageElement) => {
    imgRef.current = img;
    requestAnimationFrame(() => {
      const rect = img.getBoundingClientRect();
      renderSize.current = { w: Math.max(1, Math.round(rect.width)), h: Math.max(1, Math.round(rect.height)) };
      if (!regions || regions.length === 0) {
        setCrop(defaultCropPx());
      }
    });
  };

  const commit = (c: Crop) => {
    const img = imgRef.current;
    if (!img || !c?.width || !c?.height) {
      onChange([]);
      return;
    }
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    const { w: rw, h: rh } = renderSize.current;

    const scaleX = natW / rw;
    const scaleY = natH / rh;

    let pxX = Math.round((c.x ?? 0) * scaleX);
    let pxY = Math.round((c.y ?? 0) * scaleY);
    let pxW = Math.round((c.width ?? 0) * scaleX);
    let pxH = Math.round((c.height ?? 0) * scaleY);

    const PAD = 2; // small padding for robustness
    pxX = Math.max(0, pxX - PAD);
    pxY = Math.max(0, pxY - PAD);
    pxW = Math.min(natW - pxX, pxW + PAD * 2);
    pxH = Math.min(natH - pxY, pxH + PAD * 2);

    const r: Region = {
      x: clamp01(pxX / natW),
      y: clamp01(pxY / natH),
      w: clamp01(pxW / natW),
      h: clamp01(pxH / natH),
    };
    onChange([r]);
  };

  const rafRef = useRef<number | null>(null);
  const onChangeDebounced = (c: Crop) => {
    setCrop(c);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => commit(c));
  };

  if (!enabled) {
    return (
      <div>
        <img
          src={imageUrl}
          alt="before"
          ref={imgRef as any}
          onLoad={(e) => onImageLoaded(e.currentTarget)}
          style={{ display: "block", width: "100%", height: "auto" }}
        />
        <div className="muted" style={{ marginTop: 6 }}>Toggle “Ignore regions” to edit selection</div>
      </div>
    );
  }

  return (
    <div>
      <ReactCrop
        crop={crop}
        onChange={onChangeDebounced}
        onComplete={(c) => commit(c)}
        disabled={false}
        keepSelection
        ruleOfThirds={false}
      >
        <img
          src={imageUrl}
          alt="before"
          ref={imgRef as any}
          onLoad={(e) => onImageLoaded(e.currentTarget)}
          style={{ display: "block", width: "100%", height: "auto" }}
        />
      </ReactCrop>
    </div>
  );
}
