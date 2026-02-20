"use client"

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

const PdfSummarizerPage = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "complete" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setStatus("processing");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/tools/pdf-summarizer/process", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to process PDF");
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
    <div className="min-h-screen bg-black text-white flex flex-col items-center p-4 sm:p-8">
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">PDF Summarizer</h1>
      <p className="mb-4 text-blue-600">Upload PDFs and get AI-generated summaries, key points extraction, chapter breakdowns, and Q&A capabilities.</p>
      <form onSubmit={handleSubmit} className="w-full max-w-md flex flex-col items-center">
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          aria-label="Upload PDF"
          className="mb-4 w-full text-white bg-blue-600 p-2 rounded"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white py-2 px-4 rounded"
          aria-label="Submit PDF for summarization"
        >
          Submit (4 credits)
        </button>
      </form>
      {status === "processing" && <div className="mt-4">Processing...</div>}
      {status === "complete" && <div className="mt-4 text-green-500">Processing complete!</div>}
      {status === "error" && <div className="mt-4 text-red-500">Error: {error}</div>}
    </div>
  );
};

export default PdfSummarizerPage;