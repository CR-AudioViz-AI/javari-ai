"use client";

export default function JavariOSFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      {/* Neon grid */}
      <div className="absolute inset-0 opacity-20 bg-[url('/grid.svg')] bg-repeat" />

      {/* Glow layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-black" />

      {/* Foreground */}
      <div className="relative w-full h-full">{children}</div>
    </div>
  );
}
