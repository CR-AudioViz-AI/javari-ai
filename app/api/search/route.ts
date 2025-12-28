/**
 * UNIVERSAL SEARCH API
 * CR AudioViz AI - Henderson Standard
 * 
 * Cross-module search across the entire ecosystem:
 * - Full-text search
 * - Module filtering
 * - Cross-sell recommendations
 * - Search analytics
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Available modules for filtering
const MODULES = [
  "javari",
  "barrels",
  "cards",
  "oracle",
  "travel",
  "realtor",
  "invoice",
  "pdf",
  "social",
  "ebook",
  "logo",
  "games",
  "crochet",
  "knitting"
];

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const module = searchParams.get("module");
    const limit = parseInt(searchParams.get("limit") || "20");
    const userId = searchParams.get("user_id");

    if (!query) {
      return NextResponse.json({ 
        modules: MODULES,
        message: "Universal Search API - provide ?q=search_term"
      });
    }

    // Build search query
    let searchQuery = supabase
      .from("search_index")
      .select("*")
      .eq("is_active", true)
      .limit(limit);

    // Apply module filter if provided
    if (module && MODULES.includes(module)) {
      searchQuery = searchQuery.eq("module", module);
    }

    // Text search - use ilike for now, upgrade to full-text later
    searchQuery = searchQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`);

    const { data: results, error } = await searchQuery
      .order("relevance_score", { ascending: false });

    if (error) throw error;

    const duration = Date.now() - startTime;

    // Log search analytics
    await supabase.from("search_analytics").insert({
      query,
      user_id: userId,
      results_count: results?.length || 0,
      module_filter: module,
      search_duration_ms: duration
    });

    // Get cross-sell recommendations
    const { data: recommendations } = await supabase
      .from("cross_sell_recommendations")
      .select("*")
      .eq("is_active", true)
      .eq("source_module", module || "javari")
      .order("priority", { ascending: false })
      .limit(3);

    return NextResponse.json({
      query,
      module_filter: module,
      results: results || [],
      count: results?.length || 0,
      duration_ms: duration,
      recommendations: recommendations || [],
      available_modules: MODULES
    });

  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case "index": {
        // Add item to search index
        const { module, content_type, content_id, title, description, tags, url, image_url, metadata } = data;
        
        if (!module || !content_type || !content_id || !title) {
          return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const { data: indexed, error } = await supabase
          .from("search_index")
          .upsert({
            module,
            content_type,
            content_id,
            title,
            description,
            tags: tags || [],
            url,
            image_url,
            metadata: metadata || {},
            updated_at: new Date().toISOString()
          }, { onConflict: "module,content_type,content_id" })
          .select()
          .single();

        if (error) throw error;
        return NextResponse.json({ success: true, indexed });
      }

      case "remove": {
        // Remove from search index
        const { module, content_type, content_id } = data;
        
        const { error } = await supabase
          .from("search_index")
          .update({ is_active: false })
          .match({ module, content_type, content_id });

        if (error) throw error;
        return NextResponse.json({ success: true, message: "Removed from index" });
      }

      case "click": {
        // Log search result click
        const { search_query, result_id, user_id } = data;
        
        await supabase.from("search_analytics").insert({
          query: search_query,
          user_id,
          clicked_result_id: result_id
        });

        return NextResponse.json({ success: true });
      }

      case "add_recommendation": {
        // Add cross-sell recommendation
        const { source_module, target_module, title, description, cta_text, target_url, priority } = data;
        
        if (!source_module || !target_module || !title) {
          return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const { data: rec, error } = await supabase
          .from("cross_sell_recommendations")
          .insert({
            source_module,
            target_module,
            title,
            description,
            cta_text,
            target_url,
            priority: priority || 50
          })
          .select()
          .single();

        if (error) throw error;
        return NextResponse.json({ success: true, recommendation: rec });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Search POST error:", error);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }
}

