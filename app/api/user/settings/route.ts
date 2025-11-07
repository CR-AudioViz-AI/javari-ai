// app/api/user/settings/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

export const runtime = 'edge'

/**
 * GET /api/user/settings
 * Returns the current user's settings and preferences
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

    // Get user settings from user_settings table or create if doesn't exist
    let { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    // If no settings record exists, create one with defaults
    if (!settings) {
      const defaultSettings = {
        user_id: user.id,
        language: 'en',
        timezone: 'America/New_York',
        theme: 'system',
        notifications_enabled: true,
        email_notifications: true,
        sound_enabled: true,
        auto_save_enabled: true,
        two_factor_enabled: false,
      }

      const { data: newSettings, error: createError } = await supabase
        .from('user_settings')
        .insert(defaultSettings)
        .select()
        .single()

      if (createError) {
        console.error('Error creating settings:', createError)
        return NextResponse.json(
          { error: 'Failed to initialize settings' },
          { status: 500 }
        )
      }

      settings = newSettings
    }

    return NextResponse.json({
      success: true,
      settings: {
        language: settings.language,
        timezone: settings.timezone,
        theme: settings.theme,
        notifications: {
          enabled: settings.notifications_enabled,
          email: settings.email_notifications,
          sound: settings.sound_enabled,
        },
        features: {
          auto_save: settings.auto_save_enabled,
        },
        security: {
          two_factor_enabled: settings.two_factor_enabled,
        },
        updated_at: settings.updated_at,
      }
    })
  } catch (error: unknown) {
    logError(\'Error fetching settings:\', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/user/settings
 * Updates the current user's settings
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
    const { 
      language, 
      timezone, 
      theme,
      notifications_enabled,
      email_notifications,
      sound_enabled,
      auto_save_enabled,
      two_factor_enabled
    } = body

    // Build update object with validation
    const updateData: any = {}
    
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

    if (theme !== undefined) {
      if (!['light', 'dark', 'system'].includes(theme)) {
        return NextResponse.json(
          { error: 'Invalid theme. Must be light, dark, or system' },
          { status: 400 }
        )
      }
      updateData.theme = theme
    }

    if (notifications_enabled !== undefined) {
      if (typeof notifications_enabled !== 'boolean') {
        return NextResponse.json(
          { error: 'Invalid notifications_enabled. Must be boolean' },
          { status: 400 }
        )
      }
      updateData.notifications_enabled = notifications_enabled
    }

    if (email_notifications !== undefined) {
      if (typeof email_notifications !== 'boolean') {
        return NextResponse.json(
          { error: 'Invalid email_notifications. Must be boolean' },
          { status: 400 }
        )
      }
      updateData.email_notifications = email_notifications
    }

    if (sound_enabled !== undefined) {
      if (typeof sound_enabled !== 'boolean') {
        return NextResponse.json(
          { error: 'Invalid sound_enabled. Must be boolean' },
          { status: 400 }
        )
      }
      updateData.sound_enabled = sound_enabled
    }

    if (auto_save_enabled !== undefined) {
      if (typeof auto_save_enabled !== 'boolean') {
        return NextResponse.json(
          { error: 'Invalid auto_save_enabled. Must be boolean' },
          { status: 400 }
        )
      }
      updateData.auto_save_enabled = auto_save_enabled
    }

    if (two_factor_enabled !== undefined) {
      if (typeof two_factor_enabled !== 'boolean') {
        return NextResponse.json(
          { error: 'Invalid two_factor_enabled. Must be boolean' },
          { status: 400 }
        )
      }
      updateData.two_factor_enabled = two_factor_enabled
    }

    // Update settings
    const { data: updatedSettings, error: updateError } = await supabase
      .from('user_settings')
      .update(updateData)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating settings:', updateError)
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      settings: {
        language: updatedSettings.language,
        timezone: updatedSettings.timezone,
        theme: updatedSettings.theme,
        notifications: {
          enabled: updatedSettings.notifications_enabled,
          email: updatedSettings.email_notifications,
          sound: updatedSettings.sound_enabled,
        },
        features: {
          auto_save: updatedSettings.auto_save_enabled,
        },
        security: {
          two_factor_enabled: updatedSettings.two_factor_enabled,
        },
        updated_at: updatedSettings.updated_at,
      }
    })
  } catch (error: unknown) {
    logError(\'Error updating settings:\', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
