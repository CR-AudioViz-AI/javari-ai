// app/api/user/profile/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

export const runtime = 'edge'

/**
 * GET /api/user/profile
 * Returns the current user's profile information
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user profile from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        email: user.email,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        language: profile.language || 'en',
        timezone: profile.timezone || 'America/New_York',
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      }
    })
  } catch (error: unknown) {
    logError('Error fetching profile:\', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/user/profile
 * Updates the current user's profile information
 */
export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { full_name, avatar_url, language, timezone } = body

    // Validate fields
    const updateData: any = {}
    
    if (full_name !== undefined) {
      if (typeof full_name !== 'string' || full_name.length > 100) {
        return NextResponse.json(
          { error: 'Invalid full_name' },
          { status: 400 }
        )
      }
      updateData.full_name = full_name
    }

    if (avatar_url !== undefined) {
      if (typeof avatar_url !== 'string') {
        return NextResponse.json(
          { error: 'Invalid avatar_url' },
          { status: 400 }
        )
      }
      updateData.avatar_url = avatar_url
    }

    if (language !== undefined) {
      if (!['en', 'es'].includes(language)) {
        return NextResponse.json(
          { error: 'Invalid language. Must be en or es' },
          { status: 400 }
        )
      }
      updateData.language = language
    }

    if (timezone !== undefined) {
      if (typeof timezone !== 'string') {
        return NextResponse.json(
          { error: 'Invalid timezone' },
          { status: 400 }
        )
      }
      updateData.timezone = timezone
    }

    // Update profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating profile:', updateError)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: updatedProfile.id,
        email: user.email,
        full_name: updatedProfile.full_name,
        avatar_url: updatedProfile.avatar_url,
        language: updatedProfile.language,
        timezone: updatedProfile.timezone,
        updated_at: updatedProfile.updated_at,
      }
    })
  } catch (error: unknown) {
    logError('Error updating profile:\', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
