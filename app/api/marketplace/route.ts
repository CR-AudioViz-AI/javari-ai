/**
 * MARKETPLACE ENGINE API
 * CR AudioViz AI - Henderson Standard
 * 
 * Unified commerce infrastructure for all buyer/seller interactions:
 * - Vendor onboarding
 * - Listing management
 * - Transaction processing
 * - Payout management
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Vendor tiers with requirements
const VENDOR_TIERS = {
  basic: { 
    commission: 0.15, 
    requirements: ["email_verified"],
    max_listings: 10
  },
  verified: { 
    commission: 0.12, 
    requirements: ["email_verified", "identity_verified"],
    max_listings: 100
  },
  pro: { 
    commission: 0.08, 
    requirements: ["email_verified", "identity_verified", "business_verified"],
    max_listings: -1 // unlimited
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const vendorId = searchParams.get("vendor_id");
    const module = searchParams.get("module");

    switch (action) {
      case "vendor": {
        if (!vendorId) {
          return NextResponse.json({ error: "vendor_id required" }, { status: 400 });
        }
        
        const { data: vendor, error } = await supabase
          .from("vendors")
          .select("*")
          .eq("id", vendorId)
          .single();

        if (error) throw error;
        return NextResponse.json({ vendor });
      }

      case "listings": {
        let query = supabase
          .from("marketplace_listings")
          .select("*")
          .eq("status", "active")
          .order("created_at", { ascending: false });

        if (vendorId) query = query.eq("vendor_id", vendorId);
        if (module) query = query.eq("module", module);

        const { data: listings, error } = await query.limit(50);
        if (error) throw error;
        return NextResponse.json({ listings, count: listings?.length || 0 });
      }

      case "stats": {
        const { data: vendors } = await supabase
          .from("vendors")
          .select("id", { count: "exact" })
          .eq("status", "active");

        const { data: listings } = await supabase
          .from("marketplace_listings")
          .select("id", { count: "exact" })
          .eq("status", "active");

        const { data: transactions } = await supabase
          .from("marketplace_transactions")
          .select("amount")
          .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

        const totalVolume = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

        return NextResponse.json({
          active_vendors: vendors?.length || 0,
          active_listings: listings?.length || 0,
          monthly_volume: totalVolume,
          vendor_tiers: VENDOR_TIERS
        });
      }

      default:
        return NextResponse.json({ 
          message: "Marketplace Engine API",
          actions: ["vendor", "listings", "stats"],
          vendor_tiers: VENDOR_TIERS
        });
    }
  } catch (error) {
    console.error("Marketplace GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case "vendor_apply": {
        const { user_id, business_name, business_type, email, phone, description, website } = data;
        
        if (!user_id || !business_name || !email) {
          return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Create vendor application
        const { data: vendor, error } = await supabase
          .from("vendors")
          .insert({
            user_id,
            business_name,
            business_type: business_type || "individual",
            email,
            phone,
            description,
            website,
            status: "pending",
            tier: "basic",
            commission_rate: VENDOR_TIERS.basic.commission,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        return NextResponse.json({ 
          success: true, 
          message: "Vendor application submitted",
          vendor_id: vendor.id,
          status: "pending"
        });
      }

      case "vendor_approve": {
        const { vendor_id, tier } = data;
        
        if (!vendor_id) {
          return NextResponse.json({ error: "vendor_id required" }, { status: 400 });
        }

        const tierConfig = VENDOR_TIERS[tier as keyof typeof VENDOR_TIERS] || VENDOR_TIERS.basic;

        const { error } = await supabase
          .from("vendors")
          .update({
            status: "active",
            tier: tier || "basic",
            commission_rate: tierConfig.commission,
            approved_at: new Date().toISOString()
          })
          .eq("id", vendor_id);

        if (error) throw error;

        return NextResponse.json({ success: true, message: "Vendor approved" });
      }

      case "create_listing": {
        const { vendor_id, module, title, description, price, currency, category, images, metadata } = data;
        
        if (!vendor_id || !title || !price) {
          return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Check vendor status
        const { data: vendor } = await supabase
          .from("vendors")
          .select("status, tier")
          .eq("id", vendor_id)
          .single();

        if (!vendor || vendor.status !== "active") {
          return NextResponse.json({ error: "Vendor not active" }, { status: 403 });
        }

        const { data: listing, error } = await supabase
          .from("marketplace_listings")
          .insert({
            vendor_id,
            module: module || "marketplace",
            title,
            description,
            price,
            currency: currency || "USD",
            category,
            images: images || [],
            metadata: metadata || {},
            status: "active",
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        return NextResponse.json({ 
          success: true, 
          listing_id: listing.id
        });
      }

      case "process_sale": {
        const { listing_id, buyer_id, amount, payment_method } = data;
        
        if (!listing_id || !buyer_id || !amount) {
          return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Get listing and vendor info
        const { data: listing } = await supabase
          .from("marketplace_listings")
          .select("*, vendors(*)")
          .eq("id", listing_id)
          .single();

        if (!listing) {
          return NextResponse.json({ error: "Listing not found" }, { status: 404 });
        }

        const commission = amount * (listing.vendors?.commission_rate || 0.15);
        const vendorPayout = amount - commission;

        // Create transaction record
        const { data: transaction, error } = await supabase
          .from("marketplace_transactions")
          .insert({
            listing_id,
            vendor_id: listing.vendor_id,
            buyer_id,
            amount,
            commission,
            vendor_payout: vendorPayout,
            payment_method,
            status: "completed",
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        return NextResponse.json({ 
          success: true,
          transaction_id: transaction.id,
          amount,
          commission,
          vendor_payout: vendorPayout
        });
      }

      case "request_payout": {
        const { vendor_id, amount, payout_method } = data;
        
        if (!vendor_id || !amount) {
          return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Check vendor balance (sum of unpaid transactions)
        const { data: balance } = await supabase
          .from("marketplace_transactions")
          .select("vendor_payout")
          .eq("vendor_id", vendor_id)
          .eq("payout_status", "pending");

        const availableBalance = balance?.reduce((sum, t) => sum + (t.vendor_payout || 0), 0) || 0;

        if (amount > availableBalance) {
          return NextResponse.json({ 
            error: "Insufficient balance",
            available: availableBalance,
            requested: amount
          }, { status: 400 });
        }

        // Create payout request (actual payout via Stripe Connect would happen here)
        const { data: payout, error } = await supabase
          .from("vendor_payouts")
          .insert({
            vendor_id,
            amount,
            payout_method: payout_method || "stripe",
            status: "pending",
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        return NextResponse.json({ 
          success: true,
          payout_id: payout.id,
          amount,
          status: "pending"
        });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Marketplace POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

