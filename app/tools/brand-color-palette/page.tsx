"use client"

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

const BrandColorPalettePage = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "processing" | "complete" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [seedColor, setSeedColor] = useState<string>("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setStatus("processing");
    setError(null);

    try {
      const response = await fetch("/api/tools/brand-color-palette/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ seedColor }),
      });

      if (!response.ok) {
        throw new Error("Failed to process request");
      }

      const data = await response.json();
      setResult(data);
      setStatus("complete");
    } catch (err) {
      setError("An error occurred while processing your request.");
      setStatus("error");
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-black text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">Brand Color Palette</h1>
      <p className="mb-6">Generate harmonious brand color palettes from a seed color or description with hex codes, accessibility scores, and CSS/Tailwind export.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="seedColor" className="block text-sm font-medium mb-2">Seed Color or Description</label>
          <input
            type="text"
            id="seedColor"
            value={seedColor}
            onChange={(e) => setSeedColor(e.target.value)}
            className="w-full p-2 bg-gray-800 text-white border border-gray-700 rounded"
            aria-label="Seed Color or Description"
            required
          />
        </div>
        <div>
          <p className="text-sm mb-2">Credits per use: 2</p>
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded"
            disabled={status === "processing"}
            aria-label="Submit to generate color palette"
          >
            {status === "processing" ? "Processing..." : "Generate Palette"}
          </button>
        </div>
      </form>
      {status === "complete" && result && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">Generated Palette</h2>
          {/* Render result here */}
        </div>
      )}
      {status === "error" && error && (
        <div className="mt-6 text-red-500">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default BrandColorPalettePage;