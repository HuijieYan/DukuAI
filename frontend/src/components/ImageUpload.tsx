import React, { useRef } from "react";

type Props = { onChange: (before: File | null, after: File | null) => void };

export default function ImageUpload({ onChange }: Props) {
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  const handleChange = () => {
    const b = beforeRef.current?.files?.[0] ?? null;
    const a = afterRef.current?.files?.[0] ?? null;
    onChange(b, a);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <div>
        <label>Before</label>
        <input type="file" accept="image/*" ref={beforeRef} onChange={handleChange} />
      </div>
      <div>
        <label>After</label>
        <input type="file" accept="image/*" ref={afterRef} onChange={handleChange} />
      </div>
    </div>
  );
}
