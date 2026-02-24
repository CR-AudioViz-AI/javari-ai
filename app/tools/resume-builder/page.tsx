"use client"

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

const ResumeBuilderPage = () => {
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
      const response = await fetch("/api/tools/resume-builder/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ /* form data */ }),
      });

      if (!response.ok) {
        throw new Error("Failed to process resume");
      }

      setStatus("complete");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-black text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-6 md:p-8 lg:p-10">
      <h1 className="text-3xl font-bold mb-4">Resume Builder</h1>
      <p className="mb-6">Build ATS-optimized resumes with AI content suggestions, multiple professional templates, and PDF/DOCX export.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="resumeInput" className="block mb-2">Resume Details</label>
          <textarea id="resumeInput" aria-label="Resume Details" className="w-full p-2 bg-gray-800 text-white border border-gray-700 rounded" rows={5}></textarea>
        </div>
        <div className="text-blue-600">Credits per use: 5</div>
        <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded" disabled={status === "processing"}>
          {status === "processing" ? "Processing..." : "Build Resume"}
        </button>
      </form>
      {status === "error" && <div className="mt-4 text-red-600">{error}</div>}
      {status === "complete" && <div className="mt-4 text-green-600">Resume built successfully!</div>}
    </div>
  );
};

export default ResumeBuilderPage;