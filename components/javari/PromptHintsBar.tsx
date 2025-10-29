"use client"

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

const PROMPT_HINTS = [
  "Try: 'Create a social media strategy for my business'",
  "Ask: 'Write a Python script to analyze CSV data'",
  "Command: 'Design a logo concept for a tech startup'",
  "Request: 'Explain quantum computing like I'm 5'",
  "Say: 'Generate 10 blog post ideas about AI'",
  "Type: 'Debug this JavaScript code for me'",
  "Prompt: 'Create a workout plan for beginners'",
  "Query: 'Translate this document to Spanish'",
  "Ask: 'Build a landing page with HTML/CSS'",
  "Try: 'Summarize the key points from this article'",
  "Request: 'Generate SEO keywords for my website'",
  "Say: 'Create a meal plan for the week'",
]

export function PromptHintsBar() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % PROMPT_HINTS.length)
    }, 4000) // Change every 4 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-purple-900/20 via-blue-900/20 to-cyan-900/20 backdrop-blur-sm border-t border-white/10 py-2 z-40">
      <div className="container mx-auto px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-cyan-400">
          <Sparkles className="h-4 w-4 animate-pulse" />
          <span className="text-xs font-medium">Tip:</span>
        </div>
        
        <div className="flex-1 mx-4 overflow-hidden">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="text-sm text-white/70 text-center"
          >
            {PROMPT_HINTS[currentIndex]}
          </motion.div>
        </div>

        <a
          href="/javari/prompts"
          className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap underline"
        >
          View All Prompts →
        </a>
      </div>
    </div>
  )
}
