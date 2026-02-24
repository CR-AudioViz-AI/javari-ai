// ============================================================================
// API ROUTE: Create Marketplace Listing
// ============================================================================
// Path: app/api/marketplace/listings/route.ts
// Method: POST
// Description: Create a new marketplace listing
// Phase: 1 (CRUD only, no transaction processing)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Vendor tier limits
const VENDOR_TIER_LIMITS = {
  basic: 10,
  verified: 100,
  pro: -1 // unlimited
};

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      vendor_id,
      title,
      description,
      price,
      module,
      category,
      metadata
    } = body;

    // Validate required fields
    if (!vendor_id || !title || !description || price === undefined) {
      return NextResponse.json(
        { 
          error: 'Validation error',
          message: 'Missing required fields: vendor_id, title, description, price'
        },
        { status: 400 }
      );
    }

    // Verify vendor exists and user owns it
    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', vendor_id)
      .single();

    if (vendorError || !vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    // Verify user owns vendor (basic ownership check)
    if (vendor.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not own this vendor account' },
        { status: 403 }
      );
    }

    // Check vendor tier listing limits
    const tier = vendor.tier || 'basic';
    const maxListings = VENDOR_TIER_LIMITS[tier as keyof typeof VENDOR_TIER_LIMITS] || 10;

    if (maxListings !== -1) {
      const { count } = await supabase
        .from('marketplace_listings')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', vendor_id)
        .eq('status', 'active');

      if (count && count >= maxListings) {
        return NextResponse.json(
          { 
            error: 'Listing limit reached',
            message: `Your ${tier} tier allows maximum ${maxListings} active listings`
          },
          { status: 403 }
        );
      }
    }

    // Create listing
    const { data: listing, error: createError } = await supabase
      .from('marketplace_listings')
      .insert({
        vendor_id,
        title,
        description,
        price,
        module: module || null,
        category: category || null,
        status: 'active',
        metadata: metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating listing:', createError);
      return NextResponse.json(
        { error: 'Failed to create listing', details: createError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      listing
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error in POST /api/marketplace/listings:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get('vendor_id');
    const module = searchParams.get('module');
    const status = searchParams.get('status') || 'active';

    let query = supabase
      .from('marketplace_listings')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

    if (module) {
      query = query.eq('module', module);
    }

    const { data: listings, error } = await query.limit(50);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      listings: listings || [],
      count: listings?.length || 0
    });

  } catch (error: any) {
    console.error('Error in GET /api/marketplace/listings:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
