/**
 * TRUST & SAFETY API
 * CR AudioViz AI - Henderson Standard
 * 
 * Handles reporting, moderation, and user trust:
 * - Report content/users
 * - Get moderation queue
 * - Update trust scores
 * - Apply moderation actions
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Report types
const REPORT_TYPES = [
  "spam",
  "harassment",
  "inappropriate_content", 
  "fraud",
  "impersonation",
  "copyright",
  "misinformation",
  "other"
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const status = searchParams.get("status") || "pending";
    const limit = parseInt(searchParams.get("limit") || "50");

    switch (action) {
      case "queue":
        // Get moderation queue
        const { data: queue, error: queueError } = await supabase
          .from("moderation_queue")
          .select("*")
          .eq("status", status)
          .order("priority", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(limit);

        if (queueError) throw queueError;
        return NextResponse.json({ queue, count: queue?.length || 0 });

      case "stats":
        // Get moderation stats
        const { data: pending } = await supabase
          .from("moderation_queue")
          .select("id", { count: "exact" })
          .eq("status", "pending");

        const { data: resolved } = await supabase
          .from("moderation_queue")
          .select("id", { count: "exact" })
          .eq("status", "resolved");

        return NextResponse.json({
          pending: pending?.length || 0,
          resolved: resolved?.length || 0,
          report_types: REPORT_TYPES
        });

      default:
        return NextResponse.json({ 
          message: "Trust & Safety API",
          actions: ["queue", "stats"],
          report_types: REPORT_TYPES
        });
    }
  } catch (error) {
    console.error("Safety GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case "report_content": {
        const { content_type, content_id, reason, details, reporter_id, app_id } = data;
        
        if (!content_type || !content_id || !reason) {
          return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Create moderation queue item
        const { data: queueItem, error } = await supabase
          .from("moderation_queue")
          .insert({
            content_type,
            content_id,
            reason,
            details,
            reported_by: reporter_id,
            app_id,
            status: "pending",
            priority: reason === "fraud" || reason === "harassment" ? "high" : "normal"
          })
          .select()
          .single();

        if (error) throw error;

        return NextResponse.json({ 
          success: true, 
          message: "Report submitted",
          queue_id: queueItem.id
        });
      }

      case "report_user": {
        const { reporter_id, reported_user_id, report_type, reason, description } = data;
        
        if (!reported_user_id || !report_type || !reason) {
          return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Create user report
        const { data: report, error } = await supabase
          .from("user_reports")
          .insert({
            reporter_id,
            reported_user_id,
            report_type,
            reason,
            description,
            status: "open"
          })
          .select()
          .single();

        if (error) throw error;

        // Update reported user trust score
        await supabase.rpc("increment_reports_received", { 
          target_user_id: reported_user_id 
        }).catch(() => {
          // Fallback if RPC not available
          supabase
            .from("user_trust_scores")
            .upsert({
              user_id: reported_user_id,
              reports_received: 1
            }, { onConflict: "user_id" });
        });

        return NextResponse.json({ 
          success: true, 
          message: "User report submitted",
          report_id: report.id
        });
      }

      case "resolve": {
        const { queue_id, resolution, notes, performed_by } = data;
        
        if (!queue_id || !resolution) {
          return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const { error } = await supabase
          .from("moderation_queue")
          .update({
            status: "resolved",
            resolution,
            resolution_notes: notes,
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("id", queue_id);

        if (error) throw error;

        return NextResponse.json({ success: true, message: "Item resolved" });
      }

      case "moderate_user": {
        const { user_id, action_type, reason, duration_hours, performed_by } = data;
        
        if (!user_id || !action_type || !reason) {
          return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const expires_at = duration_hours 
          ? new Date(Date.now() + duration_hours * 60 * 60 * 1000).toISOString()
          : null;

        // Log moderation action
        const { data: modAction, error } = await supabase
          .from("moderation_actions")
          .insert({
            user_id,
            action_type,
            reason,
            duration_hours,
            expires_at,
            performed_by
          })
          .select()
          .single();

        if (error) throw error;

        // Update trust score
        await supabase
          .from("user_trust_scores")
          .upsert({
            user_id,
            violations: 1,
            last_violation_at: new Date().toISOString(),
            trust_level: action_type === "ban" ? "suspended" : "restricted"
          }, { onConflict: "user_id" });

        return NextResponse.json({ 
          success: true, 
          message: `User ${action_type} applied`,
          action_id: modAction.id,
          expires_at
        });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Safety POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

