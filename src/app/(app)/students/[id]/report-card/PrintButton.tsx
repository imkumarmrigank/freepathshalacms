"use client";

export default function PrintButton() {
  return (
    <button type="button" className="btn btn-primary no-print" onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}
