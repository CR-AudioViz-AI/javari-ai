"use client";

import { motion } from "framer-motion";

export default function ModelRouterPanel() {
  const fake = {
    model: "claude-3-sonnet",
    latency: "302 ms",
    price: "$0.00084",
    reason: "High reasoning stability required",
    confidence: 0.87,
  };

  return (
    <motion.div
      className="p-4 border-b border-white/10 text-white"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-sm font-semibold text-purple-300 mb-2">
        Model Router
      </div>

      <div className="text-xs opacity-80">Active Model</div>
      <div className="text-base font-medium mb-2">{fake.model}</div>

      <div className="grid grid-cols-2 gap-2 text-xs opacity-80">
        <div>Latency: {fake.latency}</div>
        <div>Cost: {fake.price}</div>
      </div>

      <div className="mt-2 text-xs opacity-80">Routing Decision</div>
      <div className="text-sm mb-2">{fake.reason}</div>

      <div className="text-xs opacity-80">Confidence</div>
      <div className="text-sm">{Math.round(fake.confidence * 100)}%</div>
    </motion.div>
  );
}
