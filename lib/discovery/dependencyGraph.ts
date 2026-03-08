// lib/discovery/dependencyGraph.ts
// Purpose: Dependency graph builder — parses package manifests (package.json,
//          requirements.txt, go.mod, Cargo.toml, pom.xml, composer.json, Gemfile)
//          and builds a structured dependency graph with risk analysis.
// Date: 2026-03-07

// ── Types ──────────────────────────────────────────────────────────────────

export interface Dependency {
  name        : string;
  version     : string;
  specifier   : string;   // raw version string from manifest
  ecosystem   : string;   // "npm" | "pip" | "go" | "cargo" | "maven" | "composer" | "rubygems"
  type        : "production" | "development" | "peer" | "optional";
  isOutdated? : boolean;
  riskFlags   : string[];
}

export interface DependencyGraph {
  ecosystem    : string;
  totalDeps    : number;
  production   : Dependency[];
  development  : Dependency[];
  peer         : Dependency[];
  optional     : Dependency[];
  riskSummary  : {
    unpinnedDeps    : string[];
    wildcardVersions: string[];
    noLockfile      : boolean;
    criticalPackages: string[];  // known security-sensitive packages
  };
  rawManifest  : Record<string, unknown>;
}

export type DependencyGraphMap = Record<string, DependencyGraph>; // file path → graph

// ── Known security-sensitive packages ─────────────────────────────────────

const CRITICAL_PACKAGES = new Set([
  "jsonwebtoken", "jwt", "bcrypt", "bcryptjs", "argon2", "crypto",
  "node-forge", "elliptic", "xml2js", "serialize-javascript",
  "lodash", "underscore", "moment", "axios", "node-fetch",
  "express", "fastify", "koa", "hapi", "helmet",
  "multer", "formidable", "busboy",
  "dotenv", "envalid",
  "stripe", "paypal-rest-sdk", "braintree",
  "aws-sdk", "@aws-sdk", "firebase-admin",
  "pg", "mysql", "mysql2", "mongoose", "mongodb",
  "redis", "ioredis", "memcached",
  "shelljs", "execa", "child_process",
]);

// ── Parse helpers ──────────────────────────────────────────────────────────

function parseNPM(content: string, filePath: string): DependencyGraph {
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(content); } catch { raw = {}; }

  const pkg = raw as {
    dependencies?    : Record<string, string>;
    devDependencies? : Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
  };

  function toDep(name: string, specifier: string, type: Dependency["type"]): Dependency {
    const unpinned     = specifier.startsWith("^") || specifier.startsWith("~");
    const wildcard     = specifier === "*" || specifier === "latest" || specifier === "";
    const isCritical   = CRITICAL_PACKAGES.has(name) || [...CRITICAL_PACKAGES].some(c => name.startsWith(c));
    const riskFlags: string[] = [];
    if (unpinned)   riskFlags.push("unpinned");
    if (wildcard)   riskFlags.push("wildcard_version");
    if (isCritical) riskFlags.push("security_sensitive");
    return { name, version: specifier, specifier, ecosystem: "npm", type, riskFlags };
  }

  const production  = Object.entries(pkg.dependencies ?? {}).map(([n, v]) => toDep(n, v, "production"));
  const development = Object.entries(pkg.devDependencies ?? {}).map(([n, v]) => toDep(n, v, "development"));
  const peer        = Object.entries(pkg.peerDependencies ?? {}).map(([n, v]) => toDep(n, v, "peer"));
  const optional    = Object.entries(pkg.optionalDependencies ?? {}).map(([n, v]) => toDep(n, v, "optional"));
  const all         = [...production, ...development, ...peer, ...optional];

  return {
    ecosystem  : "npm",
    totalDeps  : all.length,
    production, development, peer, optional,
    riskSummary: {
      unpinnedDeps    : all.filter(d => d.riskFlags.includes("unpinned")).map(d => d.name),
      wildcardVersions: all.filter(d => d.riskFlags.includes("wildcard_version")).map(d => d.name),
      noLockfile      : !filePath.includes("lock"),
      criticalPackages: all.filter(d => d.riskFlags.includes("security_sensitive")).map(d => d.name),
    },
    rawManifest: raw,
  };
}

function parsePython(content: string): DependencyGraph {
  const lines = content.split("\n").filter(l => l.trim() && !l.startsWith("#"));
  const production: Dependency[] = lines.map(line => {
    const [name, ...rest] = line.trim().split(/[>=<!~]/);
    const specifier = line.trim();
    const riskFlags: string[] = [];
    if (!line.includes("==")) riskFlags.push("unpinned");
    if (CRITICAL_PACKAGES.has(name.trim().toLowerCase())) riskFlags.push("security_sensitive");
    return { name: name.trim(), version: rest.join("") || "*", specifier, ecosystem: "pip", type: "production", riskFlags };
  });

  return {
    ecosystem: "pip", totalDeps: production.length,
    production, development: [], peer: [], optional: [],
    riskSummary: {
      unpinnedDeps    : production.filter(d => d.riskFlags.includes("unpinned")).map(d => d.name),
      wildcardVersions: production.filter(d => d.version === "*").map(d => d.name),
      noLockfile      : true,
      criticalPackages: production.filter(d => d.riskFlags.includes("security_sensitive")).map(d => d.name),
    },
    rawManifest: { requirements: lines },
  };
}

function parseGoMod(content: string): DependencyGraph {
  const requireBlock = content.match(/require\s*\(([\s\S]*?)\)/)?.[1] ?? "";
  const lines = [
    ...requireBlock.split("\n"),
    ...content.split("\n").filter(l => l.startsWith("require ")),
  ].filter(l => l.trim() && !l.trim().startsWith("//"));

  const production: Dependency[] = lines.map(line => {
    const parts = line.trim().replace(/^require\s+/, "").split(/\s+/);
    const [name, version] = parts;
    if (!name) return null;
    const riskFlags: string[] = version?.includes("v0") ? ["pre_release"] : [];
    return { name, version: version ?? "*", specifier: line.trim(), ecosystem: "go", type: "production", riskFlags };
  }).filter((d): d is Dependency => d !== null);

  return {
    ecosystem: "go", totalDeps: production.length,
    production, development: [], peer: [], optional: [],
    riskSummary: {
      unpinnedDeps: [], wildcardVersions: [], noLockfile: false,
      criticalPackages: [],
    },
    rawManifest: { go_mod: content.slice(0, 2000) },
  };
}

function parseCargoToml(content: string): DependencyGraph {
  const lines = content.split("\n");
  const production: Dependency[] = [];
  let inDeps = false;
  for (const line of lines) {
    if (line.trim() === "[dependencies]") { inDeps = true; continue; }
    if (line.startsWith("[") && line !== "[dependencies]") { inDeps = false; continue; }
    if (inDeps && line.includes("=")) {
      const [name, rest] = line.split("=").map(s => s.trim());
      const version = rest?.replace(/['"{}]/g, "").trim() ?? "*";
      production.push({ name, version, specifier: line.trim(), ecosystem: "cargo", type: "production", riskFlags: [] });
    }
  }
  return {
    ecosystem: "cargo", totalDeps: production.length,
    production, development: [], peer: [], optional: [],
    riskSummary: { unpinnedDeps: [], wildcardVersions: [], noLockfile: false, criticalPackages: [] },
    rawManifest: { cargo_toml: content.slice(0, 2000) },
  };
}

function parsePomXML(content: string): DependencyGraph {
  const depMatches = [...content.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)];
  const production: Dependency[] = depMatches.map(match => {
    const block   = match[1];
    const groupId    = block.match(/<groupId>(.*?)<\/groupId>/)?.[1] ?? "";
    const artifactId = block.match(/<artifactId>(.*?)<\/artifactId>/)?.[1] ?? "";
    const version    = block.match(/<version>(.*?)<\/version>/)?.[1] ?? "*";
    const scope      = block.match(/<scope>(.*?)<\/scope>/)?.[1] ?? "compile";
    const name = `${groupId}:${artifactId}`;
    const type: Dependency["type"] = scope === "test" ? "development" : "production";
    const riskFlags = version.includes("SNAPSHOT") ? ["snapshot_version"] : [];
    return { name, version, specifier: `${name}:${version}`, ecosystem: "maven", type, riskFlags };
  });
  return {
    ecosystem: "maven", totalDeps: production.length,
    production: production.filter(d => d.type === "production"),
    development: production.filter(d => d.type === "development"),
    peer: [], optional: [],
    riskSummary: {
      unpinnedDeps: production.filter(d => d.version === "*").map(d => d.name),
      wildcardVersions: production.filter(d => d.riskFlags.includes("snapshot_version")).map(d => d.name),
      noLockfile: false,
      criticalPackages: [],
    },
    rawManifest: {},
  };
}

function parseComposerJSON(content: string): DependencyGraph {
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(content); } catch { raw = {}; }
  const pkg = raw as { require?: Record<string, string>; "require-dev"?: Record<string, string> };
  const production  = Object.entries(pkg.require ?? {}).map(([n, v]) =>
    ({ name: n, version: v, specifier: v, ecosystem: "composer", type: "production" as const, riskFlags: [] }));
  const development = Object.entries(pkg["require-dev"] ?? {}).map(([n, v]) =>
    ({ name: n, version: v, specifier: v, ecosystem: "composer", type: "development" as const, riskFlags: [] }));
  return {
    ecosystem: "composer", totalDeps: production.length + development.length,
    production, development, peer: [], optional: [],
    riskSummary: { unpinnedDeps: [], wildcardVersions: [], noLockfile: false, criticalPackages: [] },
    rawManifest: raw,
  };
}

// ── Main builder ───────────────────────────────────────────────────────────

export function buildDependencyGraph(keyFiles: Record<string, string>): DependencyGraphMap {
  const graph: DependencyGraphMap = {};

  for (const [path, content] of Object.entries(keyFiles)) {
    const file = path.split("/").pop() ?? path;
    try {
      if (file === "package.json")        { graph[path] = parseNPM(content, path); }
      else if (file === "requirements.txt") { graph[path] = parsePython(content); }
      else if (file === "go.mod")           { graph[path] = parseGoMod(content); }
      else if (file === "Cargo.toml")       { graph[path] = parseCargoToml(content); }
      else if (file === "pom.xml")          { graph[path] = parsePomXML(content); }
      else if (file === "composer.json")    { graph[path] = parseComposerJSON(content); }
    } catch { /* malformed manifest — skip */ }
  }

  return graph;
}
