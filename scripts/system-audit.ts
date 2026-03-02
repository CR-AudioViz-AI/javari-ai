// scripts/system-audit.ts
// Registry Lifecycle Audit — CI Safe Version
// Scans ONLY app/ and lib/
// 2026-03-02

import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const PROJECT_ROOT = process.cwd();
const ALLOWED_DIRS = ["app", "lib"];

type Severity = "critical" | "warning";

interface Issue {
  file: string;
  line: number;
  severity: Severity;
  type: "missing-init" | "early-access" | "forbidden-access";
  message: string;
}

const EXECUTION_BOUNDARIES = [
  "lib/javari/multi-ai/router.ts",
  "lib/javari/multi-ai/council.ts",
  "app/api/chat/route.ts",
  "app/api/router/route.ts",
];

const FORBIDDEN_REGISTRY_ACCESS = [
  "lib/javari/multi-ai/routing-context.ts",
];

const REGISTRY_CALL_PATTERNS = [
  "getModel(",
  "selectModelByTask(",
  "getFallbackModel(",
  "buildCapabilityChain(",
  "buildDefaultChain(",
];

function scanDirectory(dir: string, files: string[] = []): string[] {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);

    if (stat.isDirectory()) {
      if (
        entry === "node_modules" ||
        entry.startsWith(".") ||
        entry === "dist" ||
        entry === "build"
      ) {
        continue;
      }
      scanDirectory(full, files);
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(full);
    }
  }

  return files;
}

function collectFiles(): string[] {
  let files: string[] = [];

  for (const dir of ALLOWED_DIRS) {
    const full = join(PROJECT_ROOT, dir);
    try {
      if (statSync(full).isDirectory()) {
        files.push(...scanDirectory(full));
      }
    } catch {
      console.warn(`Directory not found: ${dir}`);
    }
  }

  return files;
}

function analyzeFile(filePath: string): Issue[] {
  const issues: Issue[] = [];
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const rel = relative(PROJECT_ROOT, filePath);

  const isExecutionBoundary = EXECUTION_BOUNDARIES.some((b) =>
    rel.endsWith(b)
  );

  const isForbidden = FORBIDDEN_REGISTRY_ACCESS.some((f) =>
    rel.endsWith(f)
  );

  let initLine = -1;

  lines.forEach((line, idx) => {
    if (line.includes("await initRegistry(")) {
      initLine = idx + 1;
    }
  });

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    if (
      line.trim().startsWith("//") ||
      line.trim().startsWith("import")
    ) {
      return;
    }

    for (const pattern of REGISTRY_CALL_PATTERNS) {
      if (line.includes(pattern)) {
        if (isForbidden) {
          issues.push({
            file: rel,
            line: lineNum,
            severity: "critical",
            type: "forbidden-access",
            message: "routing-context must not access registry",
          });
        }

        if (isExecutionBoundary) {
          if (initLine === -1) {
            issues.push({
              file: rel,
              line: lineNum,
              severity: "critical",
              type: "missing-init",
              message: "Registry used without initRegistry()",
            });
          } else if (lineNum < initLine) {
            issues.push({
              file: rel,
              line: lineNum,
              severity: "critical",
              type: "early-access",
              message: "Registry accessed before initRegistry()",
            });
          }
        }
      }
    }
  });

  return issues;
}

function main() {
  console.log("🔍 Running Registry Lifecycle Audit\n");

  const files = collectFiles();
  console.log(`Scanning ${files.length} TypeScript files...\n`);

  let allIssues: Issue[] = [];

  for (const file of files) {
    allIssues.push(...analyzeFile(file));
  }

  const critical = allIssues.filter((i) => i.severity === "critical");

  if (allIssues.length === 0) {
    console.log("✅ No registry lifecycle issues found.");
    process.exit(0);
  }

  console.log("🔒 ROUTING INTEGRITY ISSUES\n");

  for (const issue of allIssues) {
    console.log(
      `${issue.file}:${issue.line} — ${issue.type} — ${issue.message}`
    );
  }

  console.log("\n⚠️ PRODUCTION RISK");
  console.log(`Critical Issues: ${critical.length}`);

  if (critical.length > 0) {
    console.log("❌ Deployment blocked due to critical registry issues.");
    process.exit(1);
  }

  process.exit(0);
}

main();
