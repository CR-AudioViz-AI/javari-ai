"use client";

export default function MessageTimestamp() {
  const date = new Date();
  const timestamp = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return <span className="text-[11px] tracking-wide">{timestamp}</span>;
}
