"use client"

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

const SocialCaptionGeneratorPage = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "processing" | "complete" | "error">("idle");
  const [caption, setCaption] = useState("");
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
      const response = await fetch("/api/tools/social-caption-generator/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ caption }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate caption");
      }

      const data = await response.json();
      setCaption(data.caption);
      setStatus("complete");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-black text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-6 md:p-8 lg:p-10">
      <h1 className="text-2xl font-bold mb-4">Social Caption Generator</h1>
      <p className="mb-6">Create platform-optimized social media captions with hashtags, emojis, and tone controls for Instagram, TikTok, LinkedIn, X.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="caption" className="block mb-2">Enter your caption</label>
          <textarea
            id="caption"
            aria-label="Enter your caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full p-2 bg-black border border-blue-600 rounded-md text-white"
            rows={4}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Credits per use: 1</span>
          <button
            type="submit"
            className="bg-blue-600 text-white py-2 px-4 rounded-md"
            disabled={status === "processing"}
          >
            {status === "processing" ? "Processing..." : "Generate Caption"}
          </button>
        </div>
      </form>
      {status === "complete" && <div className="mt-4 p-4 bg-blue-600 rounded-md">Caption generated successfully!</div>}
      {status === "error" && <div className="mt-4 p-4 bg-red-600 rounded-md">Error: {error}</div>}
    </div>
  );
};

export default SocialCaptionGeneratorPage;