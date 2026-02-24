// ============================================================================
// API ROUTE: Update/Delete Marketplace Listing
// ============================================================================
// Path: app/api/marketplace/listings/[id]/route.ts
// Methods: PATCH, DELETE
// Description: Update or delete a marketplace listing
// Phase: 1 (CRUD only)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Valid status transitions
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  active: ['inactive', 'sold', 'archived'],
  inactive: ['active', 'archived'],
  sold: ['archived'],
  archived: [] // cannot transition from archived
};

async function authenticateUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized', status: 401 };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return { error: 'Invalid authentication token', status: 401 };
  }

  return { user };
}

async function verifyListingOwnership(listingId: string, userId: string) {
  // Get listing
  const { data: listing, error: listingError } = await supabase
    .from('marketplace_listings')
    .select('*, vendors(user_id)')
    .eq('id', listingId)
    .single();

  if (listingError || !listing) {
    return { error: 'Listing not found', status: 404 };
  }

  // Check ownership via vendor
  if (listing.vendors?.user_id !== userId) {
    return { error: 'Forbidden: You do not own this listing', status: 403 };
  }

  return { listing };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const listingId = params.id;

    // Authenticate user
    const authResult = await authenticateUser(request);
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }
    const { user } = authResult;

    // Verify ownership
    const ownershipResult = await verifyListingOwnership(listingId, user.id);
    if ('error' in ownershipResult) {
      return NextResponse.json(
        { error: ownershipResult.error },
        { status: ownershipResult.status }
      );
    }
    const { listing } = ownershipResult;

    // Parse update data
    const body = await request.json();
    const {
      title,
      description,
      price,
      status,
      module,
      category,
      metadata
    } = body;

    // Build update object (only include provided fields)
    const updates: any = {
      updated_at: new Date().toISOString()
    };

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = price;
    if (module !== undefined) updates.module = module;
    if (category !== undefined) updates.category = category;
    if (metadata !== undefined) updates.metadata = metadata;

    // Validate status transition if status is being updated
    if (status !== undefined) {
      const currentStatus = listing.status;
      const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];

      if (!validTransitions.includes(status)) {
        return NextResponse.json(
          { 
            error: 'Invalid status transition',
            message: `Cannot transition from '${currentStatus}' to '${status}'. Valid transitions: ${validTransitions.join(', ') || 'none'}`
          },
          { status: 400 }
        );
      }

      updates.status = status;
    }

    // Update listing
    const { data: updatedListing, error: updateError } = await supabase
      .from('marketplace_listings')
      .update(updates)
      .eq('id', listingId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating listing:', updateError);
      return NextResponse.json(
        { error: 'Failed to update listing', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      listing: updatedListing
    });

  } catch (error: any) {
    console.error('Error in PATCH /api/marketplace/listings/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const listingId = params.id;

    // Authenticate user
    const authResult = await authenticateUser(request);
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }
    const { user } = authResult;

    // Verify ownership
    const ownershipResult = await verifyListingOwnership(listingId, user.id);
    if ('error' in ownershipResult) {
      return NextResponse.json(
        { error: ownershipResult.error },
        { status: ownershipResult.status }
      );
    }
    const { listing } = ownershipResult;

    // Soft delete: mark as archived instead of hard delete
    const { data: deletedListing, error: deleteError } = await supabase
      .from('marketplace_listings')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString()
      })
      .eq('id', listingId)
      .select()
      .single();

    if (deleteError) {
      console.error('Error deleting listing:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete listing', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Listing archived successfully',
      listing: deletedListing
    });

  } catch (error: any) {
    console.error('Error in DELETE /api/marketplace/listings/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const listingId = params.id;

    const { data: listing, error } = await supabase
      .from('marketplace_listings')
      .select('*, vendors(*)')
      .eq('id', listingId)
      .single();

    if (error || !listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      listing
    });

  } catch (error: any) {
    console.error('Error in GET /api/marketplace/listings/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
