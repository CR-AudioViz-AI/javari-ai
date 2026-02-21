// lib/enterprise/partners/manifest.ts
// CR AudioViz AI — Partner App/Module Manifest Spec
// 2026-02-21 — STEP 10 Enterprise

export interface PartnerManifest {
  id:           string;
  name:         string;
  version:      string;
  description:  string;
  author: {
    name:    string;
    email:   string;
    url?:    string;
  };
  category:     "productivity" | "analytics" | "communication" | "finance" | "other";
  tags:         string[];
  requiredTier: "free" | "creator" | "pro" | "enterprise";
  permissions:  string[];
  entrypoint:   string;
  webhooks?: {
    onInstall?:   string;
    onUninstall?: string;
    onUpgrade?:   string;
  };
  pricing?: {
    model:     "free" | "per_seat" | "usage_based" | "flat";
    price?:    number;
    currency?: string;
  };
  status:       "draft" | "pending_review" | "approved" | "rejected" | "deprecated";
  submittedAt?: string;
  approvedAt?:  string;
}

export type ManifestValidationResult = {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
};

export function validateManifest(manifest: Partial<PartnerManifest>): ManifestValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!manifest.id)          errors.push("id is required");
  if (!manifest.name)        errors.push("name is required");
  if (!manifest.version)     errors.push("version is required");
  if (!manifest.description) errors.push("description is required");
  if (!manifest.author?.name) errors.push("author.name is required");
  if (!manifest.author?.email) errors.push("author.email is required");
  if (!manifest.entrypoint)  errors.push("entrypoint is required");

  if (manifest.name && manifest.name.length > 50)
    warnings.push("name should be 50 characters or fewer");
  if (manifest.description && manifest.description.length < 20)
    warnings.push("description should be at least 20 characters");
  if (!manifest.tags || manifest.tags.length === 0)
    warnings.push("tags are recommended for discoverability");

  return { valid: errors.length === 0, errors, warnings };
}

export async function submitManifest(
  manifest: PartnerManifest,
  partnerId: string
): Promise<{ id: string; status: "pending_review" }> {
  const url   = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const validated = validateManifest(manifest);
  if (!validated.valid) throw new Error(`Invalid manifest: ${validated.errors.join(", ")}`);

  const submissionId = `manifest_${Date.now().toString(36)}`;
  if (url && sbKey) {
    await fetch(`${url}/rest/v1/partner_manifests`, {
      method: "POST",
      headers: { "apikey": sbKey, "Authorization": `Bearer ${sbKey}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify({ id: submissionId, partner_id: partnerId, manifest, status: "pending_review", submitted_at: new Date().toISOString() }),
    });
  }
  return { id: submissionId, status: "pending_review" };
}
