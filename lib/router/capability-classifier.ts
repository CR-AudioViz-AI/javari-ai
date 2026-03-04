import type { ModelCapability } from "./model-registry";
export function classifyCapability(input: string): ModelCapability {
  const wordCount = input.trim().split(/\s+/).length;
  const highKeywords =
    /architecture|design|roadmap|legal|compliance|contract|analysis|analyze|strategy|system|framework|infrastructure|multi-agent|execution plan/i;
  const standardKeywords =
    /code|refactor|function|api|database|schema|optimize|improve|build|implement/i;
  if (highKeywords.test(input)) {
    return "high";
  }
  if (standardKeywords.test(input)) {
    return "standard";
  }
  if (wordCount > 60) {
    return "standard";
  }
  return "light";
}
