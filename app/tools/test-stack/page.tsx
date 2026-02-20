"use client"

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

const TestStackPage = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "processing" | "complete" | "error">("idle");
  const [inputValue, setInputValue] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("processing");
    setError(null);

    try {
      const response = await fetch("/api/tools/test-stack/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: inputValue }),
      });

      if (!response.ok) {
        throw new Error("Failed to process request");
      }

      const data = await response.json();
      setResult(data.result);
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
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-4">Test Stack</h1>
      <p className="mb-4">A full-stack test module combining UI, API processing, and database logging for validation.</p>
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <div className="mb-4">
          <label htmlFor="input" className="block text-sm font-medium mb-2">Enter Input</label>
          <input
            id="input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full p-2 border border-blue-600 bg-black text-white rounded"
            aria-label="Input for test stack"
          />
        </div>
        <div className="mb-4">
          <p>Credits per use: 1</p>
        </div>
        <button
          type="submit"
          className="w-full p-2 bg-blue-600 text-white rounded"
          disabled={status === "processing"}
          aria-label="Submit test stack form"
        >
          {status === "processing" ? "Processing..." : "Submit"}
        </button>
      </form>
      {status === "complete" && result && (
        <div className="mt-4 p-4 border border-blue-600 rounded">
          <h2 className="text-xl font-bold">Result</h2>
          <p>{result}</p>
        </div>
      )}
      {status === "error" && error && (
        <div className="mt-4 p-4 border border-red-600 rounded text-red-600">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default TestStackPage;