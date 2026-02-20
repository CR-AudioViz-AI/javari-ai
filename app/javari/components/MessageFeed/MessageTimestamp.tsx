"use client";
// app/javari/components/MessageFeed/MessageTimestamp.tsx
// 2026-02-20 — STEP 0 repair:
//   - Added suppressHydrationWarning to eliminate SSR/client mismatch
//   - new Date() on server and client differ — this is expected and safe to suppress
//   - Timestamp is display-only UI, not business logic

export default function MessageTimestamp() {
  const timestamp = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <span
      className="text-[11px] tracking-wide"
      suppressHydrationWarning
    >
      {timestamp}
    </span>
  );
}
