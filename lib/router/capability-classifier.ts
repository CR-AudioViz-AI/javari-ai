import { ModelCapability } from "./model-registry";
export function classifyCapability(input: string): ModelCapability {
  const length = input.length;
  const complexSignals = [
    "architecture",
    "design",
    "strategy",
    "multi-step",
    "legal",
    "contract",
    "financial",
    "optimize",
    "analyze",
  ];
  const lower = input.toLowerCase();
  const isComplex =
    length > 500 ||
    complexSignals.some((signal) => lower.includes(signal));
  if (isComplex) return "high";
  if (length > 200) return "standard";
  return "light";
}
