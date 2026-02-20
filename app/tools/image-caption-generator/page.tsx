"use client"

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

const ImageCaptionGeneratorPage = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "processing" | "complete" | "error">("idle");
  const [image, setImage] = useState<File | null>(null);
  const [caption, setCaption] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image) return;

    setStatus("processing");
    setError("");

    try {
      const formData = new FormData();
      formData.append("image", image);

      const response = await fetch("/api/tools/image-caption-generator/process", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to generate caption");
      }

      const data = await response.json();
      setCaption(data.caption);
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
    <div className="min-h-screen bg-black text-white flex flex-col items-center py-8">
      <h1 className="text-2xl font-bold mb-4">Image Caption Generator</h1>
      <p className="mb-6">Generate descriptive alt text and captions for images using AI.</p>
      <form onSubmit={handleSubmit} className="w-full max-w-md flex flex-col items-center">
        <label htmlFor="image-upload" className="mb-2">Upload an image:</label>
        <input
          type="file"
          id="image-upload"
          aria-label="Upload image"
          accept="image/*"
          onChange={(e) => setImage(e.target.files ? e.target.files[0] : null)}
          className="mb-4"
        />
        <p className="mb-4">Credits per use: 2</p>
        <button
          type="submit"
          className="bg-blue-600 text-white py-2 px-4 rounded mb-4"
          disabled={status === "processing"}
        >
          {status === "processing" ? "Processing..." : "Generate Caption"}
        </button>
      </form>
      {status === "complete" && <p className="mt-4">Caption: {caption}</p>}
      {status === "error" && <p className="mt-4 text-red-500">{error}</p>}
    </div>
  );
};

export default ImageCaptionGeneratorPage;