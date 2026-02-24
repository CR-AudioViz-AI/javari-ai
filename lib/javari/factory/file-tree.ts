// lib/javari/factory/file-tree.ts
// Javari Module Factory — Canonical File Tree Schema
// 2026-02-20 — STEP 4 implementation
//
// Represents the full file structure for a generated module.
// Supports multi-agent diffs + merges.
// All paths relative to project root.

// ── Types ─────────────────────────────────────────────────────────────────────

export type FileCategory =
  | "page"           // app/<module>/page.tsx
  | "layout"         // app/<module>/layout.tsx
  | "api_route"      // app/api/<module>/route.ts
  | "component"      // components/<module>/*.tsx
  | "hook"           // lib/<module>/hooks/*.ts
  | "util"           // lib/<module>/utils/*.ts
  | "type"           // lib/<module>/types.ts or types/<module>.ts
  | "schema"         // supabase/migrations/*.sql
  | "test"           // __tests__/<module>/*.test.ts
  | "config"         // config files
  | "index";         // barrel index.ts

export type FileStatus =
  | "pending"        // not yet generated
  | "generating"     // agent working on it
  | "generated"      // content ready, not validated
  | "validated"      // passed validator
  | "failed"         // generation or validation failed
  | "merged";        // merged into final bundle

export interface FileNode {
  id:          string;    // unique within module (e.g. "page_home", "api_auth")
  path:        string;    // relative path from project root
  category:    FileCategory;
  status:      FileStatus;
  content?:    string;    // generated file content
  rawContent?: string;    // pre-validation content
  error?:      string;
  agentRole?:  string;    // which role generated this
  validationScore?: number;
  dependencies: string[]; // other file IDs this file depends on
  createdAt:   string;
  updatedAt:   string;
}

export interface DirectoryNode {
  path:     string;
  files:    FileNode[];
  children: DirectoryNode[];
}

export interface ModuleFileTree {
  moduleId:    string;
  moduleName:  string;
  rootPath:    string;    // e.g. "app/modules/my-module"
  files:       FileNode[];
  totalFiles:  number;
  doneFiles:   number;
  failedFiles: number;
  createdAt:   string;
}

// ── Standard path templates ───────────────────────────────────────────────────

export function buildStandardPaths(moduleName: string): Record<string, string> {
  const slug = toSlug(moduleName);
  return {
    page:           `app/${slug}/page.tsx`,
    layout:         `app/${slug}/layout.tsx`,
    loading:        `app/${slug}/loading.tsx`,
    error:          `app/${slug}/error.tsx`,
    api_route:      `app/api/${slug}/route.ts`,
    api_sub:        `app/api/${slug}/[id]/route.ts`,
    component_main: `components/${slug}/${toPascal(slug)}.tsx`,
    component_list: `components/${slug}/${toPascal(slug)}List.tsx`,
    component_form: `components/${slug}/${toPascal(slug)}Form.tsx`,
    hook:           `lib/hooks/use${toPascal(slug)}.ts`,
    types:          `lib/types/${slug}.ts`,
    utils:          `lib/utils/${slug}.ts`,
    schema:         `supabase/migrations/${Date.now()}_${slug}.sql`,
    test_component: `__tests__/${slug}/${toPascal(slug)}.test.tsx`,
    test_api:       `__tests__/api/${slug}.test.ts`,
  };
}

export function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function toPascal(slug: string): string {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

export function toCamel(slug: string): string {
  const pascal = toPascal(slug);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// ── Factory helpers ───────────────────────────────────────────────────────────

export function createFileNode(
  id: string,
  path: string,
  category: FileCategory,
  dependencies: string[] = []
): FileNode {
  const now = new Date().toISOString();
  return {
    id,
    path,
    category,
    status:       "pending",
    dependencies,
    createdAt:    now,
    updatedAt:    now,
  };
}

export function createModuleFileTree(
  moduleId: string,
  moduleName: string,
  files: FileNode[]
): ModuleFileTree {
  const slug = toSlug(moduleName);
  return {
    moduleId,
    moduleName,
    rootPath:    `app/${slug}`,
    files,
    totalFiles:  files.length,
    doneFiles:   0,
    failedFiles: 0,
    createdAt:   new Date().toISOString(),
  };
}

export function updateFileNode(
  tree: ModuleFileTree,
  fileId: string,
  update: Partial<FileNode>
): ModuleFileTree {
  const files = tree.files.map((f) =>
    f.id === fileId ? { ...f, ...update, updatedAt: new Date().toISOString() } : f
  );
  const doneFiles   = files.filter((f) => f.status === "validated" || f.status === "merged").length;
  const failedFiles = files.filter((f) => f.status === "failed").length;
  return { ...tree, files, doneFiles, failedFiles };
}

/**
 * buildTreeView — convert flat FileNode[] into nested DirectoryNode tree
 * for display in UI or SSE progress events.
 */
export function buildTreeView(files: FileNode[]): DirectoryNode {
  const root: DirectoryNode = { path: "", files: [], children: [] };

  for (const file of files) {
    const parts = file.path.split("/");
    const fileName = parts.pop()!;
    let current = root;

    for (const part of parts) {
      let child = current.children.find((c) => c.path === part);
      if (!child) {
        child = { path: part, files: [], children: [] };
        current.children.push(child);
      }
      current = child;
    }

    current.files.push(file);
  }

  return root;
}
