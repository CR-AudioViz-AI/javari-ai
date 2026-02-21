// lib/enterprise/billing/seats.ts
// CR AudioViz AI — Seat-Based Enterprise Billing
// 2026-02-21 — STEP 10 Enterprise

export interface SeatTier {
  name:         string;
  pricePerSeat: number;    // USD/month
  minSeats:     number;
  maxSeats:     number;
  features:     string[];
}

export const SEAT_TIERS: SeatTier[] = [
  {
    name:         "Starter",
    pricePerSeat: 19,
    minSeats:     1,
    maxSeats:     10,
    features: ["Basic AI access", "5,000 credits/seat", "Email support"],
  },
  {
    name:         "Business",
    pricePerSeat: 39,
    minSeats:     11,
    maxSeats:     100,
    features: ["Full AI team routing", "20,000 credits/seat", "Priority support", "Custom domain"],
  },
  {
    name:         "Enterprise",
    pricePerSeat: 79,
    minSeats:     101,
    maxSeats:     10000,
    features: ["Dedicated infrastructure", "Unlimited credits", "SSO/SAML", "SLA 99.9%", "Custom contracts"],
  },
];

export function calculateSeatPrice(seats: number): {
  tier:          SeatTier;
  totalMonthly:  number;
  totalAnnual:   number;
  perSeat:       number;
  annualSavings: number;
} {
  const tier = SEAT_TIERS.find((t) => seats >= t.minSeats && seats <= t.maxSeats)
    ?? SEAT_TIERS[SEAT_TIERS.length - 1];
  const totalMonthly  = seats * tier.pricePerSeat;
  const annualRate    = tier.pricePerSeat * 0.8; // 20% annual discount
  const totalAnnual   = seats * annualRate * 12;
  const annualSavings = totalMonthly * 12 - totalAnnual;
  return { tier, totalMonthly, totalAnnual, perSeat: tier.pricePerSeat, annualSavings };
}

export interface SeatAssignment {
  orgId:      string;
  userId:     string;
  seatType:   "full" | "viewer" | "api_only";
  assignedAt: string;
  assignedBy: string;
}

export async function assignSeat(opts: SeatAssignment): Promise<void> {
  const url   = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !sbKey) return;
  await fetch(`${url}/rest/v1/seat_assignments`, {
    method: "POST",
    headers: { "apikey": sbKey, "Authorization": `Bearer ${sbKey}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
    body: JSON.stringify({ org_id: opts.orgId, user_id: opts.userId, seat_type: opts.seatType, assigned_at: opts.assignedAt, assigned_by: opts.assignedBy }),
  });
}

export async function getOrgSeats(orgId: string): Promise<{
  assigned: number; available: number; total: number
}> {
  try {
    const url   = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !sbKey) return { assigned: 0, available: 0, total: 0 };

    const [seatsRes, orgRes] = await Promise.all([
      fetch(`${url}/rest/v1/seat_assignments?org_id=eq.${orgId}&select=id`, {
        headers: { "apikey": sbKey, "Authorization": `Bearer ${sbKey}`, "Prefer": "count=exact" },
      }),
      fetch(`${url}/rest/v1/organizations?id=eq.${orgId}&select=max_seats`, {
        headers: { "apikey": sbKey, "Authorization": `Bearer ${sbKey}` },
      }),
    ]);
    const contentRange = seatsRes.headers.get("content-range") ?? "0/0";
    const assigned     = parseInt(contentRange.split("/")[1] ?? "0");
    const org          = await orgRes.json() as Array<{ max_seats: number }>;
    const total        = org[0]?.max_seats ?? 5;
    return { assigned, available: total - assigned, total };
  } catch { return { assigned: 0, available: 0, total: 0 }; }
}
