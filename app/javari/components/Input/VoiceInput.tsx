"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";

export default function VoiceInput({ onTranscript }: { onTranscript: (t: string) => void }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startListening = () => {
    if (!("webkitSpeechRecognition" in window)) {
      alert("Speech Recognition not supported in this browser.");
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      onTranscript(transcript);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  return (
    <div className="flex items-center justify-center mt-2">
      <motion.button
        onClick={listening ? stopListening : startListening}
        animate={{ scale: listening ? 1.15 : 1 }}
        transition={{ repeat: listening ? Infinity : 0, duration: 1.2, ease: "easeInOut" }}
        className={`rounded-full w-12 h-12 flex items-center justify-center border 
          ${listening ? "border-red-400 shadow-red-500/40" : "border-purple-400 shadow-purple-500/30"} 
          bg-black/60 backdrop-blur-lg`}
      >
        🎤
      </motion.button>
    </div>
  );
}
