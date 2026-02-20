"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/components/AuthProvider"

type SubtitleGeneratorResponse = {
  subtitles: string
  format: "srt" | "vtt"
}

const SubtitleGeneratorPage: React.FC = () => {
  const user = useUser()
  const router = useRouter()
  const [status, setStatus] = useState<"idle" | "processing" | "complete" | "error">("idle")
  const [result, setResult] = useState<SubtitleGeneratorResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!user) {
    router.push("/login")
    return null
  }

  const handleGenerateSubtitles = async () => {
    setStatus("processing")
    setError(null)
    try {
      const response = await fetch("/api/credits/deduct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: 4, reason: "subtitle-generator" }),
      })

      if (!response.ok) {
        throw new Error("Failed to deduct credits")
      }

      const processResponse = await fetch("/api/tools/subtitle-generator/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!processResponse.ok) {
        throw new Error("Failed to generate subtitles")
      }

      const data: SubtitleGeneratorResponse = await processResponse.json()
      setResult(data)
      setStatus("complete")
    } catch (err) {
      setError(err.message)
      setStatus("error")
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 dark:bg-gray-900">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subtitle Generator</h1>
      <p className="mt-2 text-gray-700 dark:text-gray-300">
        Automatically generate accurate subtitles and captions for videos using AI speech recognition, with SRT and VTT export formats.
      </p>
      <div className="mt-4">
        <button
          onClick={handleGenerateSubtitles}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          aria-label="Generate Subtitles"
        >
          Generate Subtitles
        </button>
        <span className="ml-4 text-sm text-gray-500 dark:text-gray-400">Credits per use: 4</span>
      </div>
      <div className="mt-6">
        {status === "processing" && <div className="spinner" aria-label="Loading spinner"></div>}
        {status === "complete" && result && (
          <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Generated Subtitles</h2>
            <pre className="mt-2 text-sm text-gray-700 dark:text-gray-300">{result.subtitles}</pre>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Format: {result.format.toUpperCase()}</p>
          </div>
        )}
        {status === "error" && error && (
          <div className="mt-4 p-4 bg-red-100 dark:bg-red-800 rounded">
            <p className="text-sm text-red-700 dark:text-red-300">Error: {error}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default SubtitleGeneratorPage