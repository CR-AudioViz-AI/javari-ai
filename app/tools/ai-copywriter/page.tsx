"use client"

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

const AiCopywriterPage = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "processing" | "complete" | "error">("idle");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-black text-white">Loading...</div>;
  }

  if (!user) {
    router.push("/login");
    return <div className="flex justify-center items-center h-screen bg-black text-white">Redirecting to login...</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("processing");
    setError("");

    try {
      const response = await fetch("/api/tools/ai-copywriter/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input }),
      });

      if (!response.ok) {
        throw new Error("Failed to process request");
      }

      const data = await response.json();
      setOutput(data.output);
      setStatus("complete");
    } catch (err) {
      setError("An error occurred while processing your request.");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-6 md:p-8 lg:p-10">
      <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4">AI Copywriter</h1>
      <p className="mb-6">Generate compelling marketing copy, product descriptions, headlines, and CTAs using AI with tone and brand voice controls.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="input" className="block text-sm font-medium mb-2">Enter your text:</label>
          <textarea
            id="input"
            aria-label="Input text for AI processing"
            className="w-full p-2 bg-gray-800 text-white border border-gray-700 rounded"
            rows={5}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            required
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm">Credits per use: 2</span>
          <button
            type="submit"
            className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
            disabled={status === "processing"}
          >
            {status === "processing" ? "Processing..." : "Submit"}
          </button>
        </div>
      </form>
      {status === "complete" && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">Output:</h2>
          <p className="bg-gray-800 p-4 rounded">{output}</p>
        </div>
      )}
      {status === "error" && (
        <div className="mt-6 text-red-500">
          {error}
        </div>
      )}
    </div>
  );
};

export default AiCopywriterPage;