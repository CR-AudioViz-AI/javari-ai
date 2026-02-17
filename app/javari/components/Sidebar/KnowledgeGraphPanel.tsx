"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface Node {
  id: string;
  label: string;
}

export default function KnowledgeGraphPanel() {
  const [nodes] = useState<Node[]>([
    { id: "1", label: "Topic" },
    { id: "2", label: "Related Concept" },
    { id: "3", label: "Sub-Idea" },
  ]);

  return (
    <motion.div
      className="p-4 border-b border-white/10 text-white"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-sm font-semibold text-purple-300 mb-3">
        Knowledge Graph
      </div>

      <div className="relative h-40 bg-black/40 border border-white/10 rounded-xl overflow-hidden backdrop-blur">
        {nodes.map((node, idx) => (
          <motion.div
            key={node.id}
            className="absolute px-2 py-1 rounded-lg text-xs bg-purple-600/20 border border-purple-400/20 backdrop-blur"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: 1,
              scale: 1,
              x: 20 + idx * 60,
              y: 20 + idx * 30,
            }}
            transition={{ duration: 0.5 }}
          >
            {node.label}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
