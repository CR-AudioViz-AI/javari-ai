import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/health/[id] - Get a single health record by ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    const { data: record, error } = await supabase
      .from('javari_build_health_tracking')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !record) {
      return NextResponse.json(
        { error: 'Health record not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(record);
    
  } catch (error) {
    console.error('Error fetching health record:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/health/[id] - Update a health record
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();
    
    // Check if record exists
    const { data: existing, error: fetchError } = await supabase
      .from('javari_build_health_tracking')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Health record not found' },
        { status: 404 }
      );
    }
    
    // Prepare update data
    const updateData: any = {};
    
    if (body.build_status !== undefined) updateData.build_status = body.build_status;
    if (body.error_type !== undefined) updateData.error_type = body.error_type;
    if (body.error_message !== undefined) updateData.error_message = body.error_message;
    if (body.error_stack !== undefined) updateData.error_stack = body.error_stack;
    if (body.auto_fixable !== undefined) updateData.auto_fixable = body.auto_fixable;
    if (body.fix_suggestion !== undefined) updateData.fix_suggestion = body.fix_suggestion;
    if (body.fix_confidence !== undefined) updateData.fix_confidence = body.fix_confidence;
    if (body.fix_applied !== undefined) updateData.fix_applied = body.fix_applied;
    if (body.fix_result !== undefined) updateData.fix_result = body.fix_result;
    if (body.build_duration_seconds !== undefined) updateData.build_duration_seconds = body.build_duration_seconds;
    if (body.files_affected !== undefined) updateData.files_affected = body.files_affected;
    if (body.build_completed_at !== undefined) updateData.build_completed_at = body.build_completed_at;
    
    // Update record
    const { data: updated, error } = await supabase
      .from('javari_build_health_tracking')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating health record:', error);
      return NextResponse.json(
        { error: 'Failed to update health record', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(updated);
    
  } catch (error) {
    console.error('Error updating health record:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/health/[id] - Delete a health record
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    // Check if record exists
    const { data: record, error: fetchError } = await supabase
      .from('javari_build_health_tracking')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !record) {
      return NextResponse.json(
        { error: 'Health record not found' },
        { status: 404 }
      );
    }
    
    // Delete record
    const { error } = await supabase
      .from('javari_build_health_tracking')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting health record:', error);
      return NextResponse.json(
        { error: 'Failed to delete health record', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { message: 'Health record deleted successfully' },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('Error deleting health record:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
