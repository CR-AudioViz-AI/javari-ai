// lib/intelligence/callGraphBuilder.ts
// Purpose: Call graph builder — traces function/method definitions and their
//          call sites across the entire codebase using structural text analysis.
//          Identifies uncalled functions, circular-ish hotspots, and orphaned exports.
// Date: 2026-03-07

// ── Types ──────────────────────────────────────────────────────────────────

export interface FunctionDef {
  name        : string;
  file        : string;
  line        : number;
  isExported  : boolean;
  isAsync     : boolean;
  kind        : "function" | "arrow" | "method" | "class";
}

export interface CallSite {
  callee  : string;   // function name being called
  caller  : string;   // file or "unknown"
  line    : number;
}

export interface CallGraphResult {
  functions   : FunctionDef[];
  callSites   : CallSite[];
  uncalled    : FunctionDef[];   // exported but never called outside def file
  hotspots    : Array<{ name: string; callCount: number; files: string[] }>;
  totalFiles  : number;
}

// ── Function definition extractors ────────────────────────────────────────

// Patterns to detect function definitions
const DEF_PATTERNS: Array<{
  re: RegExp;
  kind: FunctionDef["kind"];
}> = [
  // export async function foo(
  // export function foo(
  // async function foo(
  // function foo(
  {
    re   : /(?:^|\n)[ \t]*(export\s+)?(default\s+)?(async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[<(]/gm,
    kind : "function",
  },
  // export const foo = async (
  // export const foo = (
  // const foo = async (
  {
    re   : /(?:^|\n)[ \t]*(export\s+)?(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][A-Za-z0-9_$]*)\s*=>/gm,
    kind : "arrow",
  },
  // export class Foo {
  {
    re   : /(?:^|\n)[ \t]*(export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm,
    kind : "class",
  },
  // async methodName(  /  methodName(  (inside class body)
  {
    re   : /(?:^|\n)[ \t]*(?:static\s+)?(?:async\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*\([^)]*\)\s*(?::\s*\S+\s*)?\{/gm,
    kind : "method",
  },
];

function extractFunctions(content: string, file: string): FunctionDef[] {
  const defs: FunctionDef[] = [];
  const lines = content.split("\n");

  function lineOf(index: number): number {
    return content.slice(0, index).split("\n").length;
  }

  for (const { re, kind } of DEF_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const fullMatch = m[0];
      const isExported = fullMatch.includes("export");

      // Extract the function name from the right group depending on pattern
      let name = "";
      if (kind === "function") {
        // group 4
        name = m[4] ?? "";
      } else if (kind === "arrow") {
        name = m[2] ?? "";
      } else if (kind === "class") {
        name = m[2] ?? "";
      } else {
        name = m[1] ?? "";
      }

      if (!name || name.length < 2) continue;
      // Skip common keywords that match accidentally
      if (["if", "for", "while", "switch", "catch", "return", "const", "let", "var"].includes(name)) continue;

      const line = lineOf(m.index);
      const isAsync = fullMatch.includes("async");

      defs.push({ name, file, line, isExported, isAsync, kind });
    }
  }

  return defs;
}

// ── Call site extractor ────────────────────────────────────────────────────

function extractCallSites(content: string, file: string, knownNames: Set<string>): CallSite[] {
  const calls: CallSite[] = [];

  // Match: functionName( or functionName<Type>(  — but not definitions
  const CALL_RE = /\b([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:<[^>]*>)?\s*\(/g;
  const lines = content.split("\n");

  let m: RegExpExecArray | null;
  CALL_RE.lastIndex = 0;
  while ((m = CALL_RE.exec(content)) !== null) {
    const name = m[1];
    if (!knownNames.has(name)) continue;
    // Skip language keywords
    if (["if", "for", "while", "switch", "catch", "function", "class", "return", "new", "typeof", "instanceof", "await", "async", "import", "export"].includes(name)) continue;
    const line = content.slice(0, m.index).split("\n").length;
    calls.push({ callee: name, caller: file, line });
  }

  return calls;
}

// ── Main builder ───────────────────────────────────────────────────────────

export function buildCallGraph(files: Record<string, string>): CallGraphResult {
  const allDefs: FunctionDef[] = [];
  const allCalls: CallSite[]   = [];

  // Pass 1: extract all function definitions
  for (const [file, content] of Object.entries(files)) {
    const defs = extractFunctions(content, file);
    allDefs.push(...defs);
  }

  const knownNames = new Set(allDefs.map(d => d.name));

  // Pass 2: extract call sites
  for (const [file, content] of Object.entries(files)) {
    const calls = extractCallSites(content, file, knownNames);
    allCalls.push(...calls);
  }

  // Build call count map
  const callCounts: Record<string, Set<string>> = {};
  for (const call of allCalls) {
    if (!callCounts[call.callee]) callCounts[call.callee] = new Set();
    callCounts[call.callee].add(call.caller);
  }

  // Uncalled: exported functions with zero call sites in other files
  const uncalled = allDefs.filter(def => {
    if (!def.isExported) return false;
    if (def.kind === "class") return false; // classes often instantiated via new
    const callers = callCounts[def.name];
    if (!callers) return true;
    // Only count calls from OTHER files
    const externalCallers = [...callers].filter(c => c !== def.file);
    return externalCallers.length === 0;
  });

  // Hotspots: functions called from many files
  const hotspots = Object.entries(callCounts)
    .filter(([, callers]) => callers.size >= 3)
    .map(([name, callers]) => ({
      name,
      callCount: callers.size,
      files    : [...callers].slice(0, 5),
    }))
    .sort((a, b) => b.callCount - a.callCount)
    .slice(0, 20);

  return {
    functions : allDefs.slice(0, 500),   // cap for response size
    callSites : allCalls.slice(0, 1000),
    uncalled  : uncalled.slice(0, 50),
    hotspots,
    totalFiles: Object.keys(files).length,
  };
}
