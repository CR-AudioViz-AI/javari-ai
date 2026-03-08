// lib/discovery/stackDetector.ts
// Purpose: Stack detection engine — identifies languages, frameworks, databases,
//          and infrastructure from file system signals. Pure analysis, no I/O.
// Date: 2026-03-07

// ── Types ──────────────────────────────────────────────────────────────────

export interface StackSignal {
  file        : string;
  signal      : string;
  confidence  : "high" | "medium" | "low";
  category    : "language" | "framework" | "database" | "infra" | "runtime";
}

export interface DetectedStack {
  languages  : string[];
  frameworks : string[];
  databases  : string[];
  runtimes   : string[];
  infra      : string[];
  signals    : StackSignal[];
  confidence : Record<string, number>; // 0–100
}

// ── Signal maps — file path → what it means ───────────────────────────────

const LANGUAGE_SIGNALS: Array<{ pattern: RegExp; language: string; confidence: StackSignal["confidence"] }> = [
  { pattern: /package\.json$/i,         language: "JavaScript/TypeScript", confidence: "high" },
  { pattern: /tsconfig\.json$/i,        language: "TypeScript",            confidence: "high" },
  { pattern: /\.(ts|tsx)$/i,            language: "TypeScript",            confidence: "high" },
  { pattern: /\.(js|jsx|mjs|cjs)$/i,   language: "JavaScript",            confidence: "high" },
  { pattern: /requirements\.txt$/i,     language: "Python",                confidence: "high" },
  { pattern: /setup\.py$/i,             language: "Python",                confidence: "high" },
  { pattern: /pyproject\.toml$/i,       language: "Python",                confidence: "high" },
  { pattern: /Pipfile$/i,               language: "Python",                confidence: "high" },
  { pattern: /\.py$/i,                  language: "Python",                confidence: "medium" },
  { pattern: /go\.mod$/i,               language: "Go",                    confidence: "high" },
  { pattern: /go\.sum$/i,               language: "Go",                    confidence: "high" },
  { pattern: /\.go$/i,                  language: "Go",                    confidence: "medium" },
  { pattern: /pom\.xml$/i,              language: "Java",                  confidence: "high" },
  { pattern: /build\.gradle(\.kts)?$/i, language: "Kotlin/Java",           confidence: "high" },
  { pattern: /\.java$/i,                language: "Java",                  confidence: "medium" },
  { pattern: /\.kt$/i,                  language: "Kotlin",                confidence: "medium" },
  { pattern: /Cargo\.toml$/i,           language: "Rust",                  confidence: "high" },
  { pattern: /\.rs$/i,                  language: "Rust",                  confidence: "medium" },
  { pattern: /composer\.json$/i,        language: "PHP",                   confidence: "high" },
  { pattern: /\.php$/i,                 language: "PHP",                   confidence: "medium" },
  { pattern: /Gemfile$/i,               language: "Ruby",                  confidence: "high" },
  { pattern: /\.rb$/i,                  language: "Ruby",                  confidence: "medium" },
  { pattern: /mix\.exs$/i,              language: "Elixir",                confidence: "high" },
  { pattern: /\.ex$|\.exs$/i,           language: "Elixir",                confidence: "medium" },
  { pattern: /\.cs$/i,                  language: "C#",                    confidence: "medium" },
  { pattern: /\.csproj$/i,              language: "C#",                    confidence: "high" },
  { pattern: /\.swift$/i,               language: "Swift",                 confidence: "medium" },
  { pattern: /\.sol$/i,                 language: "Solidity",              confidence: "medium" },
];

const FRAMEWORK_SIGNALS: Array<{ pattern: RegExp; framework: string; confidence: StackSignal["confidence"] }> = [
  { pattern: /next\.config\.(js|ts|mjs)$/i,  framework: "Next.js",       confidence: "high" },
  { pattern: /nuxt\.config\.(js|ts)$/i,       framework: "Nuxt.js",       confidence: "high" },
  { pattern: /remix\.config\.(js|ts)$/i,      framework: "Remix",         confidence: "high" },
  { pattern: /astro\.config\.(mjs|ts)$/i,     framework: "Astro",         confidence: "high" },
  { pattern: /svelte\.config\.(js|ts)$/i,     framework: "SvelteKit",     confidence: "high" },
  { pattern: /vite\.config\.(js|ts)$/i,       framework: "Vite",          confidence: "high" },
  { pattern: /angular\.json$/i,               framework: "Angular",       confidence: "high" },
  { pattern: /gatsby-config\.(js|ts)$/i,      framework: "Gatsby",        confidence: "high" },
  { pattern: /\.fastapi|main\.py$/i,          framework: "FastAPI",        confidence: "low" },
  { pattern: /django.*settings\.py$/i,        framework: "Django",         confidence: "high" },
  { pattern: /manage\.py$/i,                  framework: "Django",         confidence: "medium" },
  { pattern: /flask_app\.|app\.py$/i,         framework: "Flask",          confidence: "medium" },
  { pattern: /laravel\/|artisan$/i,           framework: "Laravel",        confidence: "high" },
  { pattern: /rails\//i,                      framework: "Ruby on Rails",  confidence: "high" },
  { pattern: /spring.*application/i,          framework: "Spring Boot",    confidence: "medium" },
  { pattern: /hardhat\.config\.(js|ts)$/i,   framework: "Hardhat",        confidence: "high" },
  { pattern: /foundry\.toml$/i,              framework: "Foundry",        confidence: "high" },
  { pattern: /tailwind\.config\.(js|ts)$/i,  framework: "Tailwind CSS",   confidence: "high" },
  { pattern: /\.storybook\//i,               framework: "Storybook",      confidence: "high" },
];

const DATABASE_SIGNALS: Array<{ pattern: RegExp; db: string; confidence: StackSignal["confidence"] }> = [
  { pattern: /supabase/i,                    db: "Supabase (PostgreSQL)",  confidence: "high" },
  { pattern: /prisma\/schema\.prisma$/i,     db: "Prisma ORM",             confidence: "high" },
  { pattern: /drizzle\.config/i,             db: "Drizzle ORM",            confidence: "high" },
  { pattern: /\.prisma$/i,                   db: "Prisma ORM",             confidence: "high" },
  { pattern: /mongoose|mongodb/i,            db: "MongoDB",                confidence: "medium" },
  { pattern: /redis/i,                       db: "Redis",                  confidence: "medium" },
  { pattern: /planetscale/i,                 db: "PlanetScale (MySQL)",    confidence: "high" },
  { pattern: /cockroachdb/i,                 db: "CockroachDB",            confidence: "high" },
  { pattern: /sqlite|\.db$/i,               db: "SQLite",                 confidence: "medium" },
  { pattern: /typeorm/i,                     db: "TypeORM",                confidence: "high" },
  { pattern: /knex/i,                        db: "Knex.js",                confidence: "high" },
  { pattern: /sequelize/i,                   db: "Sequelize",              confidence: "high" },
  { pattern: /migrations\//i,               db: "SQL Migrations",         confidence: "medium" },
];

const INFRA_SIGNALS: Array<{ pattern: RegExp; infra: string; confidence: StackSignal["confidence"] }> = [
  { pattern: /vercel\.json$/i,               infra: "Vercel",              confidence: "high" },
  { pattern: /\.vercel\//i,                  infra: "Vercel",              confidence: "high" },
  { pattern: /Dockerfile$/i,                 infra: "Docker",              confidence: "high" },
  { pattern: /docker-compose\.(yml|yaml)$/i, infra: "Docker Compose",      confidence: "high" },
  { pattern: /\.dockerignore$/i,             infra: "Docker",              confidence: "medium" },
  { pattern: /kubernetes|k8s\//i,            infra: "Kubernetes",          confidence: "high" },
  { pattern: /helm\//i,                      infra: "Helm (Kubernetes)",   confidence: "high" },
  { pattern: /terraform\.(tf|tfvars)$/i,     infra: "Terraform",           confidence: "high" },
  { pattern: /\.github\/workflows\//i,       infra: "GitHub Actions",      confidence: "high" },
  { pattern: /\.gitlab-ci\.yml$/i,           infra: "GitLab CI",           confidence: "high" },
  { pattern: /netlify\.toml$/i,              infra: "Netlify",             confidence: "high" },
  { pattern: /fly\.toml$/i,                  infra: "Fly.io",              confidence: "high" },
  { pattern: /railway\.json|\.railway/i,     infra: "Railway",             confidence: "high" },
  { pattern: /serverless\.yml$/i,            infra: "Serverless Framework",confidence: "high" },
  { pattern: /cloudformation/i,             infra: "AWS CloudFormation",  confidence: "high" },
  { pattern: /cdk\.json$/i,                  infra: "AWS CDK",             confidence: "high" },
  { pattern: /pulumi\./i,                    infra: "Pulumi",              confidence: "high" },
  { pattern: /wrangler\.toml$/i,             infra: "Cloudflare Workers",  confidence: "high" },
  { pattern: /\.env(\.|$)/i,                 infra: "Env Configuration",   confidence: "low" },
  { pattern: /\.env\.example$/i,             infra: "Env Configuration",   confidence: "medium" },
];

const RUNTIME_SIGNALS: Array<{ pattern: RegExp; runtime: string; confidence: StackSignal["confidence"] }> = [
  { pattern: /\.nvmrc$|\.node-version$/i,    runtime: "Node.js",           confidence: "high" },
  { pattern: /bun\.lockb$/i,                 runtime: "Bun",               confidence: "high" },
  { pattern: /pnpm-lock\.yaml$/i,            runtime: "pnpm",              confidence: "high" },
  { pattern: /yarn\.lock$/i,                 runtime: "Yarn",              confidence: "high" },
  { pattern: /package-lock\.json$/i,         runtime: "npm",               confidence: "high" },
  { pattern: /deno\.json(c)?$/i,             runtime: "Deno",              confidence: "high" },
  { pattern: /\.python-version$/i,           runtime: "Python (pyenv)",    confidence: "high" },
  { pattern: /\.ruby-version$/i,             runtime: "Ruby (rbenv)",      confidence: "high" },
];

// ── Main detector ──────────────────────────────────────────────────────────

export function detectStack(filePaths: string[]): DetectedStack {
  const signals: StackSignal[] = [];
  const languageCounts: Record<string, number> = {};
  const frameworkCounts: Record<string, number> = {};
  const dbCounts: Record<string, number> = {};
  const runtimeCounts: Record<string, number> = {};
  const infraCounts: Record<string, number> = {};

  for (const file of filePaths) {
    const normalized = file.replace(/\\/g, "/");

    for (const { pattern, language, confidence } of LANGUAGE_SIGNALS) {
      if (pattern.test(normalized)) {
        signals.push({ file: normalized, signal: language, confidence, category: "language" });
        const weight = confidence === "high" ? 3 : confidence === "medium" ? 2 : 1;
        languageCounts[language] = (languageCounts[language] ?? 0) + weight;
      }
    }
    for (const { pattern, framework, confidence } of FRAMEWORK_SIGNALS) {
      if (pattern.test(normalized)) {
        signals.push({ file: normalized, signal: framework, confidence, category: "framework" });
        const weight = confidence === "high" ? 3 : confidence === "medium" ? 2 : 1;
        frameworkCounts[framework] = (frameworkCounts[framework] ?? 0) + weight;
      }
    }
    for (const { pattern, db, confidence } of DATABASE_SIGNALS) {
      if (pattern.test(normalized)) {
        signals.push({ file: normalized, signal: db, confidence, category: "database" });
        dbCounts[db] = (dbCounts[db] ?? 0) + 1;
      }
    }
    for (const { pattern, infra, confidence } of INFRA_SIGNALS) {
      if (pattern.test(normalized)) {
        signals.push({ file: normalized, signal: infra, confidence, category: "infra" });
        infraCounts[infra] = (infraCounts[infra] ?? 0) + 1;
      }
    }
    for (const { pattern, runtime, confidence } of RUNTIME_SIGNALS) {
      if (pattern.test(normalized)) {
        signals.push({ file: normalized, signal: runtime, confidence, category: "runtime" });
        runtimeCounts[runtime] = (runtimeCounts[runtime] ?? 0) + 1;
      }
    }
  }

  // Deduplicate and sort by weight
  const rank = (counts: Record<string, number>) =>
    [...new Set(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k]) => k))];

  // Build confidence scores (0–100) based on signal count relative to max
  const maxScore = Math.max(1, ...Object.values({ ...languageCounts, ...frameworkCounts }));
  const confidence: Record<string, number> = {};
  for (const [k, v] of Object.entries({ ...languageCounts, ...frameworkCounts, ...dbCounts, ...infraCounts })) {
    confidence[k] = Math.min(100, Math.round((v / maxScore) * 100));
  }

  return {
    languages : rank(languageCounts),
    frameworks: rank(frameworkCounts),
    databases : rank(dbCounts),
    runtimes  : rank(runtimeCounts),
    infra     : rank(infraCounts),
    signals,
    confidence,
  };
}
