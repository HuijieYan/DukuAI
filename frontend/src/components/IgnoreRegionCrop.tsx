import React, { useEffect, useRef, useState } from "react";
import ReactCrop, { Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import type { Region } from "../types";

type Props = {
  imageUrl: string;
  regions: Region[];                  // we use the first region (single selection)
  onChange: (regions: Region[]) => void;
  enabled?: boolean;
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export default function IgnoreRegionCrop({ imageUrl, regions, onChange, enabled = true }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>(() => {
    const r = regions[0];
    return r
      ? { unit: "%", x: r.x * 100, y: r.y * 100, width: r.w * 100, height: r.h * 100 }
      : { unit: "%", x: 10, y: 10, width: 30, height: 20 };
  });

  // When image changes, sync crop from regions if present
  useEffect(() => {
    const r = regions[0];
    if (r) {
      setCrop({ unit: "%", x: r.x * 100, y: r.y * 100, width: r.w * 100, height: r.h * 100 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  const onImageLoaded = (img: HTMLImageElement) => {
    imgRef.current = img;
  };

  // Convert % crop -> natural pixel crop -> normalized [0..1] and pad by 1px
  const commit = (c: Crop) => {
    const img = imgRef.current;
    if (!img || !c?.width || !c?.height) {
      onChange([]);
      return;
    }

    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;

    // % -> px in natural space
    let pxX = Math.round(((c.x ?? 0) / 100) * natW);
    let pxY = Math.round(((c.y ?? 0) / 100) * natH);
    let pxW = Math.round(((c.width ?? 0) / 100) * natW);
    let pxH = Math.round(((c.height ?? 0) / 100) * natH);

    // small padding to cover antialiasing around text/edges
    const PAD = 1;
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

  return (
    <div>
      <ReactCrop
        crop={crop}
        onChange={(c) => setCrop(c)}          // live UI update
        onComplete={(c) => commit(c)}         // commit only when the user stops dragging
        disabled={!enabled}
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

      {!enabled && (
        <div className="muted" style={{ marginTop: 6 }}>
          Toggle “Ignore regions” to edit selection
        </div>
      )}
    </div>
  );
}
