// lib/javari/factory/blueprint.ts
// Javari Module Factory — Blueprint Generator
// 2026-02-20 — STEP 4 implementation
//
// Converts a high-level module description into a structured blueprint.
// Blueprint feeds the planner (TaskGraph) and orchestrator (routing context).

import { toSlug, toPascal } from "./file-tree";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ModuleComplexity = "minimal" | "standard" | "full";
export type AuthRequirement  = "none" | "optional" | "required";

export interface RouteSpec {
  path:        string;      // URL path e.g. "/dashboard/reports"
  type:        "page" | "layout" | "loading" | "error";
  description: string;
  hasParams:   boolean;     // dynamic segment e.g. /[id]
}

export interface ApiSpec {
  path:        string;      // API path e.g. "/api/reports"
  methods:     Array<"GET" | "POST" | "PUT" | "PATCH" | "DELETE">;
  description: string;
  requiresAuth: boolean;
  returnsJson:  boolean;
}

export interface ComponentSpec {
  name:        string;      // PascalCase component name
  path:        string;      // relative path
  description: string;
  hasForm:     boolean;
  hasList:     boolean;
  hasModal:    boolean;
}

export interface DatabaseSpec {
  tableName:   string;      // snake_case
  columns: Array<{
    name:      string;
    type:      "uuid" | "text" | "integer" | "boolean" | "timestamptz" | "jsonb" | "numeric";
    nullable:  boolean;
    default?:  string;
  }>;
  hasRls:       boolean;    // Row Level Security
  hasCreatedAt: boolean;
  hasUpdatedAt: boolean;
}

export interface ModuleBlueprint {
  moduleId:    string;
  moduleName:  string;
  slug:        string;
  description: string;
  complexity:  ModuleComplexity;
  auth:        AuthRequirement;

  routes:      RouteSpec[];
  apis:        ApiSpec[];
  components:  ComponentSpec[];
  database?:   DatabaseSpec[];

  // Generation hints
  needsState:       boolean;   // uses React state/context
  needsDataFetching: boolean;  // uses SWR/React Query/fetch
  needsRealtime:    boolean;   // uses Supabase realtime
  needsFileUpload:  boolean;
  needsSearch:      boolean;

  // Planning metadata
  estimatedTasks:   number;    // how many tasks the planner will generate
  generationGoal:   string;    // the full goal string passed to planGoal()
  plannerContext:   string;    // additional context for the planner

  createdAt: string;
}

// ── Blueprint builder ─────────────────────────────────────────────────────────

export interface BlueprintOptions {
  complexity?:   ModuleComplexity;
  auth?:         AuthRequirement;
  includeTests?: boolean;
  includeSchema?: boolean;
}

/**
 * buildBlueprint — Convert a free-text module description into a structured blueprint.
 * Pure function — deterministic given same inputs (no LLM calls here).
 * The blueprint is then used by planGoal() and the factory orchestration.
 */
export function buildBlueprint(
  moduleName: string,
  description: string,
  options: BlueprintOptions = {}
): ModuleBlueprint {
  const slug       = toSlug(moduleName);
  const pascal     = toPascal(slug);
  const complexity = options.complexity ?? inferComplexity(description);
  const auth       = options.auth       ?? inferAuth(description);
  const moduleId   = `module_${slug}_${Date.now().toString(36)}`;

  // ── Route specs ────────────────────────────────────────────────────────────
  const routes: RouteSpec[] = [
    {
      path:        `/${slug}`,
      type:        "page",
      description: `Main ${moduleName} page — list view or dashboard`,
      hasParams:   false,
    },
    {
      path:        `/${slug}/[id]`,
      type:        "page",
      description: `Detail view for a single ${moduleName} item`,
      hasParams:   true,
    },
  ];

  if (complexity === "full") {
    routes.push({
      path:        `/${slug}/new`,
      type:        "page",
      description: `Create new ${moduleName}`,
      hasParams:   false,
    });
    routes.push({
      path:        `/${slug}/[id]/edit`,
      type:        "page",
      description: `Edit existing ${moduleName}`,
      hasParams:   true,
    });
  }

  // ── API specs ──────────────────────────────────────────────────────────────
  const apis: ApiSpec[] = [
    {
      path:         `/api/${slug}`,
      methods:      ["GET", "POST"],
      description:  `List and create ${moduleName} resources`,
      requiresAuth: auth !== "none",
      returnsJson:  true,
    },
    {
      path:         `/api/${slug}/[id]`,
      methods:      complexity === "minimal" ? ["GET"] : ["GET", "PUT", "DELETE"],
      description:  `Get, update, delete a single ${moduleName}`,
      requiresAuth: auth !== "none",
      returnsJson:  true,
    },
  ];

  // ── Component specs ────────────────────────────────────────────────────────
  const components: ComponentSpec[] = [
    {
      name:        `${pascal}List`,
      path:        `components/${slug}/${pascal}List.tsx`,
      description: `Renders a paginated list of ${moduleName} items`,
      hasForm:     false,
      hasList:     true,
      hasModal:    false,
    },
    {
      name:        `${pascal}Card`,
      path:        `components/${slug}/${pascal}Card.tsx`,
      description: `Single item card/tile for ${moduleName}`,
      hasForm:     false,
      hasList:     false,
      hasModal:    false,
    },
  ];

  if (complexity !== "minimal") {
    components.push({
      name:        `${pascal}Form`,
      path:        `components/${slug}/${pascal}Form.tsx`,
      description: `Create/edit form for ${moduleName} with validation`,
      hasForm:     true,
      hasList:     false,
      hasModal:    false,
    });
  }

  if (complexity === "full") {
    components.push({
      name:        `${pascal}Modal`,
      path:        `components/${slug}/${pascal}Modal.tsx`,
      description: `Modal dialog for quick ${moduleName} actions`,
      hasForm:     true,
      hasList:     false,
      hasModal:    true,
    });
  }

  // ── Database specs ─────────────────────────────────────────────────────────
  let database: DatabaseSpec[] | undefined;
  if (options.includeSchema !== false && needsDatabase(description)) {
    database = [
      {
        tableName: slug.replace(/-/g, "_"),
        columns: [
          { name: "id",         type: "uuid",        nullable: false, default: "uuid_generate_v4()" },
          { name: "user_id",    type: "uuid",        nullable: auth !== "none" ? false : true },
          { name: "name",       type: "text",        nullable: false },
          { name: "description",type: "text",        nullable: true  },
          { name: "status",     type: "text",        nullable: false, default: "'active'" },
          { name: "metadata",   type: "jsonb",       nullable: true,  default: "'{}'" },
          { name: "created_at", type: "timestamptz", nullable: false, default: "NOW()" },
          { name: "updated_at", type: "timestamptz", nullable: false, default: "NOW()" },
        ],
        hasRls:       auth !== "none",
        hasCreatedAt: true,
        hasUpdatedAt: true,
      },
    ];
  }

  // ── Generation hints ───────────────────────────────────────────────────────
  const descLower = description.toLowerCase();
  const needsState       = descLower.includes("state") || descLower.includes("filter") || descLower.includes("search");
  const needsDataFetching = true; // always need data
  const needsRealtime    = descLower.includes("realtime") || descLower.includes("live") || descLower.includes("chat");
  const needsFileUpload  = descLower.includes("upload") || descLower.includes("file") || descLower.includes("image");
  const needsSearch      = descLower.includes("search") || descLower.includes("filter");

  // ── Planning goal ──────────────────────────────────────────────────────────
  const generationGoal = [
    `Generate a complete ${moduleName} module for a Next.js 14 (App Router) application.`,
    `Description: ${description}`,
    ``,
    `Generate these files:`,
    routes.map((r) => `- ${r.path} (${r.type}): ${r.description}`).join("\n"),
    apis.map((a)   => `- ${a.path} (${a.methods.join(",")}): ${a.description}`).join("\n"),
    components.map((c) => `- ${c.path}: ${c.description}`).join("\n"),
    database ? `- Supabase migration SQL for table: ${database[0].tableName}` : "",
    ``,
    `Requirements:`,
    `- TypeScript strict mode`,
    `- Tailwind CSS for styling`,
    `- shadcn/ui components where appropriate`,
    auth !== "none" ? `- Supabase auth (${auth})` : "- No authentication required",
    `- Production-grade error handling`,
    `- WCAG 2.2 AA accessibility`,
  ].filter(Boolean).join("\n");

  const plannerContext = [
    `Module: ${moduleName} (${slug})`,
    `Complexity: ${complexity}`,
    `Auth: ${auth}`,
    `Routes: ${routes.length}`,
    `APIs: ${apis.length}`,
    `Components: ${components.length}`,
    database ? `Database tables: ${database.length}` : "",
  ].filter(Boolean).join(" | ");

  // Estimate task count: 1 blueprint + 1 per file type group + 1 aggregation
  const estimatedTasks = 1 + routes.length + apis.length + Math.ceil(components.length / 2) +
    (database ? 1 : 0) + 1;

  return {
    moduleId,
    moduleName,
    slug,
    description,
    complexity,
    auth,
    routes,
    apis,
    components,
    database,
    needsState,
    needsDataFetching,
    needsRealtime,
    needsFileUpload,
    needsSearch,
    estimatedTasks,
    generationGoal,
    plannerContext,
    createdAt: new Date().toISOString(),
  };
}

// ── Heuristics ────────────────────────────────────────────────────────────────

function inferComplexity(description: string): ModuleComplexity {
  const d = description.toLowerCase();
  if (d.includes("simple") || d.includes("basic") || d.includes("minimal")) return "minimal";
  if (d.includes("complete") || d.includes("full") || d.includes("enterprise") ||
      d.includes("advanced") || d.includes("comprehensive")) return "full";
  return "standard";
}

function inferAuth(description: string): AuthRequirement {
  const d = description.toLowerCase();
  if (d.includes("no auth") || d.includes("public") || d.includes("open")) return "none";
  if (d.includes("required") || d.includes("authenticated") || d.includes("private")) return "required";
  if (d.includes("optional") || d.includes("logged in")) return "optional";
  return "required"; // safe default
}

function needsDatabase(description: string): boolean {
  const d = description.toLowerCase();
  return (
    d.includes("database") || d.includes("supabase") || d.includes("table") ||
    d.includes("data") || d.includes("store") || d.includes("save") ||
    d.includes("crud") || d.includes("list")
  );
}

/**
 * blueprintToPlanningSummary — human-readable summary for SSE events
 */
export function blueprintToPlanningSummary(bp: ModuleBlueprint): string {
  return [
    `Module: ${bp.moduleName} (${bp.complexity})`,
    `Auth: ${bp.auth}`,
    `Files to generate: ${bp.routes.length} routes + ${bp.apis.length} APIs + ${bp.components.length} components`,
    bp.database ? `+ ${bp.database.length} DB schema(s)` : "",
    `Estimated tasks: ${bp.estimatedTasks}`,
  ].filter(Boolean).join(" | ");
}
