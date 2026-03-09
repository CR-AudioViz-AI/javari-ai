// app/api/admin/stripe-status/route.ts — TEMPORARY DIAGNOSTIC — delete after use
import { NextRequest } from "next/server";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key) return Response.json({ error: "STRIPE_SECRET_KEY not set in env" });
  const keyPreview = key.slice(0,8)+"..."+key.slice(-4);
  const isLive = key.startsWith("sk_live");
  const [prodRes, priceRes] = await Promise.all([
    fetch("https://api.stripe.com/v1/products?limit=20&active=true", { headers: { Authorization: `Bearer ${key}` } }),
    fetch("https://api.stripe.com/v1/prices?limit=20&active=true",   { headers: { Authorization: `Bearer ${key}` } }),
  ]);
  const products = await prodRes.json();
  const prices   = await priceRes.json();
  return Response.json({
    key: keyPreview, isLive,
    products: products.data?.map((p: any) => ({ id: p.id, name: p.name })),
    prices:   prices.data?.map((p: any) => ({ id: p.id, product: p.product, amount: `${(p.unit_amount/100).toFixed(2)} ${p.currency}`, interval: p.recurring?.interval ?? "one_time" })),
  });
}
