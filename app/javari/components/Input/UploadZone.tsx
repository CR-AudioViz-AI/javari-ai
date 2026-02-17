"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export default function UploadZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [hover, setHover] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setHover(false);
    const files = Array.from(e.dataTransfer.files);
    onFiles(files);
  };

  return (
    <motion.div
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-xl p-4 text-center mt-3 cursor-pointer 
        ${hover ? "border-purple-400 bg-purple-600/10" : "border-white/10 bg-black/40"}`}
    >
      <p className="text-sm text-white/70">
        Drag & drop files here — any size, any type
      </p>
    </motion.div>
  );
}
