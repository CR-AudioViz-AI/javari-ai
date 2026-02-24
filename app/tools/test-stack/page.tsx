"use client"

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

const TestStackPage = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "processing" | "complete" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const handleSubmit = async () => {
    if (!user) return;

    setStatus("processing");
    setError(null);

    try {
      const response = await fetch("/api/tools/test-stack/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to process request");
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
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">Test Stack</h1>
      <p className="text-lg sm:text-xl lg:text-2xl mb-6 text-blue-600">
        Full-stack test module validating complete pipeline: UI page, API route, DB migration, GitHub commit
      </p>
      <p className="mb-4">Credits per use: 2</p>
      <button
        onClick={handleSubmit}
        className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
        aria-label="Submit Test Stack"
      >
        {status === "processing" ? "Processing..." : "Submit"}
      </button>
      {status === "complete" && <p className="mt-4 text-green-500">Process completed successfully!</p>}
      {status === "error" && <p className="mt-4 text-red-500">Error: {error}</p>}
    </div>
  );
};

export default TestStackPage;