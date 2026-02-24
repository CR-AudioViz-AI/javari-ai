// lib/enterprise/billing/org-credits.ts
// CR AudioViz AI — Enterprise Credit Pools & Department Quotas
// 2026-02-21 — STEP 10 Enterprise

export interface OrgCreditSummary {
  orgId:        string;
  totalPool:    number;
  allocated:    number;
  consumed:     number;
  remaining:    number;
  departments:  DeptCreditUsage[];
}

export interface DeptCreditUsage {
  workspaceId:  string;
  name:         string;
  quota:        number;
  used:         number;
  remaining:    number;
  percentUsed:  number;
}

export async function getOrgCreditSummary(orgId: string): Promise<OrgCreditSummary> {
  const url   = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const empty: OrgCreditSummary = { orgId, totalPool: 0, allocated: 0, consumed: 0, remaining: 0, departments: [] };
  if (!url || !sbKey) return empty;

  try {
    const [orgRes, wsRes] = await Promise.all([
      fetch(`${url}/rest/v1/organizations?id=eq.${orgId}&select=credit_pool`, {
        headers: { "apikey": sbKey, "Authorization": `Bearer ${sbKey}` },
      }),
      fetch(`${url}/rest/v1/workspaces?org_id=eq.${orgId}&select=id,name,credit_quota,credit_used`, {
        headers: { "apikey": sbKey, "Authorization": `Bearer ${sbKey}` },
      }),
    ]);

    const org  = await orgRes.json() as Array<{ credit_pool: number }>;
    const wss  = await wsRes.json()  as Array<{ id: string; name: string; credit_quota: number; credit_used: number }>;

    const totalPool  = org[0]?.credit_pool ?? 0;
    const allocated  = wss.reduce((s, w) => s + (w.credit_quota ?? 0), 0);
    const consumed   = wss.reduce((s, w) => s + (w.credit_used ?? 0), 0);

    const departments: DeptCreditUsage[] = wss.map((w) => ({
      workspaceId: w.id,
      name:        w.name,
      quota:       w.credit_quota ?? 0,
      used:        w.credit_used  ?? 0,
      remaining:   (w.credit_quota ?? 0) - (w.credit_used ?? 0),
      percentUsed: w.credit_quota ? Math.round((w.credit_used / w.credit_quota) * 100) : 0,
    }));

    return { orgId, totalPool, allocated, consumed, remaining: totalPool - consumed, departments };
  } catch { return empty; }
}

export async function allocateDeptCredits(
  workspaceId: string,
  quota:       number,
  allocatedBy: string
): Promise<void> {
  const url   = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !sbKey) return;
  await fetch(`${url}/rest/v1/workspaces?id=eq.${workspaceId}`, {
    method:  "PATCH",
    headers: { "apikey": sbKey, "Authorization": `Bearer ${sbKey}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
    body: JSON.stringify({ credit_quota: quota }),
  });
}
