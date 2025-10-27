import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { ApiResponse, JavariSubProject } from '@/types/javari';

// PATCH /api/subprojects/[id]/credentials - Update credential overrides
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const { id } = params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Sub-project ID is required' },
        { status: 400 }
      );
    }

    const { credential_overrides } = body;

    if (!credential_overrides || typeof credential_overrides !== 'object') {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'credential_overrides must be an object' },
        { status: 400 }
      );
    }

    // Remove empty values from credentials
    const cleanedCredentials = Object.fromEntries(
      Object.entries(credential_overrides).filter(([_, value]) => value && value !== '')
    );

    // Update the sub-project with new credential overrides
    const { data, error } = await supabase
      .from('javari_sub_projects')
      .update({ credential_overrides: cleanedCredentials })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<JavariSubProject>>(
      { success: true, data, message: 'Credentials updated successfully' },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// GET /api/subprojects/[id]/credentials - Get credential overrides (masked)
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const { id } = params;

    if (!id) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Sub-project ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('javari_sub_projects')
      .select('id, name, credential_overrides')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: error.message },
        { status: 404 }
      );
    }

    // Mask credential values for security (only show which keys exist)
    const maskedCredentials = Object.fromEntries(
      Object.entries(data.credential_overrides || {}).map(([key, value]) => {
        if (typeof value === 'string' && value.length > 0) {
          // Show first 4 and last 4 characters, mask the middle
          if (value.length > 12) {
            return [key, `${value.slice(0, 4)}${'*'.repeat(value.length - 8)}${value.slice(-4)}`];
          } else {
            return [key, '*'.repeat(value.length)];
          }
        }
        return [key, value];
      })
    );

    return NextResponse.json<ApiResponse<{
      id: string;
      name: string;
      credential_overrides: Record<string, any>;
      masked_credentials: Record<string, any>;
    }>>(
      {
        success: true,
        data: {
          id: data.id,
          name: data.name,
          credential_overrides: data.credential_overrides || {},
          masked_credentials: maskedCredentials,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// DELETE /api/subprojects/[id]/credentials - Clear all credential overrides
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const { id } = params;

    if (!id) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Sub-project ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('javari_sub_projects')
      .update({ credential_overrides: {} })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<JavariSubProject>>(
      { success: true, data, message: 'All credentials cleared successfully' },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
