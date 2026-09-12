"use client";
import { useRef, useState } from "react";

/**
 * A scanned or photographed document — an Aadhaar card, in practice.
 *
 * Separate from PhotoUpload because a document is not a portrait: it is often a
 * PDF, it is never cropped to a square, and what somebody wants from it is to
 * open it full size and read the number, not to see a thumbnail of it.
 *
 * An image is shrunk before upload the same way a photograph is — a phone
 * camera shot of a card is several megabytes and the 3 MB cap would reject it —
 * but at a larger size, because the digits have to stay readable.
 */
async function shrink(file: File, max = 1600): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 800_000) return file;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.9));
}

export default function DocUpload({
  label, hint, value, onChange,
}: {
  label: string;
  hint?: string;
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File) => {
    setBusy(true); setError(null);
    try {
      const blob = await shrink(file);
      const isPdf = (blob.type || file.type) === "application/pdf";
      const body = new FormData();
      body.append("file", new File([blob], isPdf ? "document.pdf" : "document.jpg",
        { type: blob.type || file.type }));
      const res = await fetch("/api/media/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      onChange(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload that file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="field">
      <span>{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <input ref={input} type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); }} />
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy}
          onClick={() => input.current?.click()}>
          {busy ? "Uploading…" : value ? "Replace" : "Upload"}
        </button>
        {value && (
          <>
            <a href={`/api/media/${value}`} target="_blank" rel="noreferrer"
              className="text-[13px] text-[var(--brand)] hover:underline">
              View uploaded card
            </a>
            <button type="button" className="btn btn-ghost btn-sm"
              onClick={() => onChange(null)}>Remove</button>
          </>
        )}
      </div>
      {hint && <p className="mt-1.5 text-[12px] text-[var(--faint)]">{hint}</p>}
      {error && <p className="mt-1.5 text-[12px] text-[var(--bad)]">{error}</p>}
    </div>
  );
}
