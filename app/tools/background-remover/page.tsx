"use client"

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

const BackgroundRemoverPage = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "processing" | "complete" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("processing");
    setError(null);

    try {
      const response = await fetch("/api/tools/background-remover/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ /* your data here */ }),
      });

      if (!response.ok) {
        throw new Error("Failed to process image");
      }

      setStatus("complete");
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-black text-white">Loading...</div>;
  }

  return (
    <div className="bg-black text-white min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-4">Background Remover</h1>
      <p className="mb-6">Remove image backgrounds instantly with AI. Supports batch processing, transparent PNG export, and custom background replacement.</p>
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <div className="mb-4">
          <label htmlFor="imageUpload" className="block text-sm font-medium mb-2">Upload Image</label>
          <input type="file" id="imageUpload" aria-label="Upload Image" className="block w-full text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 hover:file:bg-blue-700" />
        </div>
        <div className="mb-4">
          <p>Credits per use: 2</p>
        </div>
        <button type="submit" className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded text-white font-semibold" aria-label="Process Image">
          {status === "processing" ? "Processing..." : "Remove Background"}
        </button>
      </form>
      {status === "error" && <p className="mt-4 text-red-500">{error}</p>}
    </div>
  );
};

export default BackgroundRemoverPage;