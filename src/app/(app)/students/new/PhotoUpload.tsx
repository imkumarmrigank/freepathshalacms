"use client";
import { useRef, useState } from "react";

/**
 * Photographs are downscaled in the browser before upload — a phone camera
 * shot is several megabytes, and a passport photo needs none of that.
 */
async function shrink(file: File, max = 900): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 400_000) return file;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.85));
}

export default function PhotoUpload({
  label, hint, value, onChange, size = 104,
}: {
  label: string;
  hint?: string;
  value: number | null;
  onChange: (id: number | null) => void;
  size?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File) => {
    setBusy(true); setError(null);
    try {
      const blob = await shrink(file);
      const body = new FormData();
      body.append("file", new File([blob], "photo.jpg", { type: blob.type || file.type }));
      const res = await fetch("/api/media/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      onChange(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload that photo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="field">
      <span>{label}</span>
      <div className="flex items-start gap-3">
        <div
          className="flex flex-none items-center justify-center overflow-hidden rounded-[10px] border border-dashed border-[var(--border-strong)] bg-[#fafaff]"
          style={{ width: size, height: size }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/media/${value}`} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center text-[11px] text-[var(--faint)]">No photo</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); }} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy}
              onClick={() => input.current?.click()}>
              {busy ? "Uploading…" : value ? "Replace photo" : "Upload Photo"}
            </button>
            {value && (
              <button type="button" className="btn btn-ghost btn-sm"
                onClick={() => onChange(null)}>Remove</button>
            )}
          </div>
          {hint && <p className="mt-1.5 text-[12px] text-[var(--faint)]">{hint}</p>}
          {error && <p className="mt-1.5 text-[12px] text-[var(--bad)]">{error}</p>}
        </div>
      </div>
    </div>
  );
}
