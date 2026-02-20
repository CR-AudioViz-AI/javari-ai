"use client"

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

const VoiceTranscriberPage = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "processing" | "complete" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-black text-white">Loading...</div>;
  }

  if (!user) {
    router.push("/login");
    return <div className="flex justify-center items-center h-screen bg-black text-white">Redirecting to login...</div>;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("processing");
    setError(null);

    try {
      const formData = new FormData(event.target as HTMLFormElement);
      const response = await fetch("/api/tools/voice-transcriber/process", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to process the file.");
      }

      setStatus("complete");
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center p-4 sm:p-8">
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">Voice Transcriber</h1>
      <p className="mb-6 text-center max-w-md">
        Transcribe audio and video files to text with speaker identification, timestamps, and multi-language support.
      </p>
      <form onSubmit={handleSubmit} className="w-full max-w-lg flex flex-col gap-4">
        <label htmlFor="file" className="block text-sm font-medium">
          Upload File
        </label>
        <input
          type="file"
          id="file"
          name="file"
          aria-label="Upload audio or video file"
          className="block w-full text-sm text-white bg-black border border-blue-600 rounded-lg cursor-pointer focus:outline-none"
          required
        />
        <div className="text-sm text-blue-600">Credits per use: 3</div>
        <button
          type="submit"
          className="mt-4 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none"
          aria-label="Submit to transcribe"
          disabled={status === "processing"}
        >
          {status === "processing" ? "Processing..." : "Transcribe"}
        </button>
      </form>
      {status === "error" && error && (
        <div className="mt-4 text-red-600" role="alert">
          {error}
        </div>
      )}
      {status === "complete" && (
        <div className="mt-4 text-green-600" role="status">
          Transcription complete!
        </div>
      )}
    </div>
  );
};

export default VoiceTranscriberPage;