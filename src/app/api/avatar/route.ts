```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { ratelimit } from '@/lib/redis';
import OpenAI from 'openai';
import Replicate from 'replicate';
import { v4 as uuidv4 } from 'uuid';

// Validation schemas
const createAvatarSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  appearance: z.object({
    gender: z.enum(['male', 'female', 'non-binary', 'other']),
    age_range: z.enum(['young', 'adult', 'mature', 'elderly']),
    ethnicity: z.string().optional(),
    hair_color: z.string().optional(),
    eye_color: z.string().optional(),
    skin_tone: z.string().optional(),
    body_type: z.enum(['slim', 'athletic', 'average', 'curvy', 'muscular']),
    height: z.enum(['short', 'average', 'tall']),
    style_preference: z.enum(['casual', 'formal', 'artistic', 'sporty', 'gothic', 'futuristic']),
    ai_generated: z.boolean().default(false)
  }),
  personality: z.object({
    traits: z.array(z.string()).max(10),
    voice_tone: z.enum(['friendly', 'professional', 'casual', 'energetic', 'calm', 'mysterious']),
    interaction_style: z.enum(['extroverted', 'introverted', 'balanced']),
    humor_level: z.number().min(1).max(10),
    formality_level: z.number().min(1).max(10)
  }),
  preferences: z.object({
    favorite_colors: z.array(z.string()).max(5),
    music_genres: z.array(z.string()).max(10),
    interests: z.array(z.string()).max(15),
    communication_style: z.string().optional()
  }),
  modules_enabled: z.array(z.string()).default(['all'])
});

const updateAvatarSchema = createAvatarSchema.partial().extend({
  avatar_id: z.string().uuid()
});

// Initialize external services
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!
});

interface Database {
  public: {
    Tables: {
      avatars: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          appearance_data: any;
          personality_data: any;
          preferences_data: any;
          modules_enabled: string[];
          avatar_image_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          appearance_data: any;
          personality_data: any;
          preferences_data: any;
          modules_enabled?: string[];
          avatar_image_url?: string | null;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          description?: string | null;
          appearance_data?: any;
          personality_data?: any;
          preferences_data?: any;
          modules_enabled?: string[];
          avatar_image_url?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      avatar_clothing: {
        Row: {
          id: string;
          avatar_id: string;
          category: string;
          item_name: string;
          item_data: any;
          is_equipped: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          avatar_id: string;
          category: string;
          item_name: string;
          item_data: any;
          is_equipped?: boolean;
        };
      };
      avatar_accessories: {
        Row: {
          id: string;
          avatar_id: string;
          accessory_type: string;
          accessory_name: string;
          accessory_data: any;
          is_equipped: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          avatar_id: string;
          accessory_type: string;
          accessory_name: string;
          accessory_data: any;
          is_equipped?: boolean;
        };
      };
      avatar_behaviors: {
        Row: {
          id: string;
          avatar_id: string;
          behavior_type: string;
          behavior_data: any;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          avatar_id: string;
          behavior_type: string;
          behavior_data: any;
          is_active?: boolean;
        };
      };
    };
  };
}

// AI-powered appearance generation
async function generateAvatarAppearance(appearance: any, preferences: any) {
  try {
    const prompt = `Generate a detailed avatar appearance description for:
    Gender: ${appearance.gender}
    Age: ${appearance.age_range}
    Style: ${appearance.style_preference}
    Body type: ${appearance.body_type}
    Height: ${appearance.height}
    Preferences: ${JSON.stringify(preferences)}
    
    Return specific details for hair style, facial features, distinctive characteristics, and overall aesthetic.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.8
    });

    const description = completion.choices[0]?.message?.content || '';

    // Generate avatar image using Replicate
    const imagePrompt = `Professional avatar portrait, ${description}, high quality, detailed, realistic style, clean background, centered composition`;
    
    const output = await replicate.run(
      "stability-ai/stable-diffusion:27b93a2413e7f36cd83da926f3656280b2931564ff050bf9575f1fdf9bcd7478",
      {
        input: {
          prompt: imagePrompt,
          width: 512,
          height: 512,
          num_outputs: 1,
          num_inference_steps: 50,
          guidance_scale: 7.5
        }
      }
    ) as string[];

    return {
      description,
      image_url: output[0] || null
    };
  } catch (error) {
    console.error('AI generation error:', error);
    return {
      description: 'Generated avatar with custom appearance',
      image_url: null
    };
  }
}

// Generate personality-based behaviors
async function generateAvatarBehaviors(personality: any) {
  const behaviors = [];

  // Interaction patterns
  behaviors.push({
    behavior_type: 'interaction',
    behavior_data: {
      greeting_style: personality.interaction_style === 'extroverted' ? 'enthusiastic' : 
                     personality.interaction_style === 'introverted' ? 'reserved' : 'friendly',
      response_time: personality.voice_tone === 'energetic' ? 'quick' : 'thoughtful',
      conversation_depth: personality.formality_level > 7 ? 'formal' : 'casual'
    },
    is_active: true
  });

  // Emotional responses
  behaviors.push({
    behavior_type: 'emotional',
    behavior_data: {
      humor_usage: personality.humor_level,
      empathy_level: personality.traits.includes('empathetic') ? 8 : 5,
      enthusiasm: personality.voice_tone === 'energetic' ? 9 : 6
    },
    is_active: true
  });

  // Communication patterns
  behaviors.push({
    behavior_type: 'communication',
    behavior_data: {
      formality: personality.formality_level,
      verbosity: personality.interaction_style === 'extroverted' ? 'verbose' : 'concise',
      topic_preferences: personality.traits
    },
    is_active: true
  });

  return behaviors;
}

// Sync avatar across CRAIverse modules
async function syncAvatarAcrossModules(avatarId: string, modulesEnabled: string[], supabase: any) {
  try {
    // Get avatar data
    const { data: avatar } = await supabase
      .from('avatars')
      .select('*')
      .eq('id', avatarId)
      .single();

    if (!avatar) return;

    // Update Redis cache for real-time sync
    if (process.env.REDIS_URL) {
      const redis = require('ioredis');
      const redisClient = new redis(process.env.REDIS_URL);
      
      await redisClient.setex(
        `avatar:${avatarId}`,
        3600, // 1 hour cache
        JSON.stringify(avatar)
      );

      // Publish to module-specific channels
      for (const module of modulesEnabled) {
        await redisClient.publish(`avatar:sync:${module}`, JSON.stringify({
          type: 'avatar_updated',
          avatar_id: avatarId,
          data: avatar
        }));
      }

      redisClient.disconnect();
    }
  } catch (error) {
    console.error('Module sync error:', error);
  }
}

// GET - Retrieve avatar(s)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const avatarId = searchParams.get('id');
    const includeClothing = searchParams.get('include_clothing') === 'true';
    const includeAccessories = searchParams.get('include_accessories') === 'true';
    const includeBehaviors = searchParams.get('include_behaviors') === 'true';

    const supabase = createRouteHandlerClient<Database>({ cookies });
    
    // Get user session
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Rate limiting
    const identifier = `avatar_get_${userId}`;
    const { success } = await ratelimit.limit(identifier);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    if (avatarId) {
      // Get specific avatar
      const { data: avatar, error } = await supabase
        .from('avatars')
        .select('*')
        .eq('id', avatarId)
        .eq('user_id', userId)
        .single();

      if (error) {
        return NextResponse.json({ error: 'Avatar not found' }, { status: 404 });
      }

      // Include related data if requested
      const result: any = { ...avatar };

      if (includeClothing) {
        const { data: clothing } = await supabase
          .from('avatar_clothing')
          .select('*')
          .eq('avatar_id', avatarId);
        result.clothing = clothing || [];
      }

      if (includeAccessories) {
        const { data: accessories } = await supabase
          .from('avatar_accessories')
          .select('*')
          .eq('avatar_id', avatarId);
        result.accessories = accessories || [];
      }

      if (includeBehaviors) {
        const { data: behaviors } = await supabase
          .from('avatar_behaviors')
          .select('*')
          .eq('avatar_id', avatarId);
        result.behaviors = behaviors || [];
      }

      return NextResponse.json({ avatar: result });
    } else {
      // Get all user avatars
      const { data: avatars, error } = await supabase
        .from('avatars')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: 'Failed to fetch avatars' }, { status: 500 });
      }

      return NextResponse.json({ avatars });
    }
  } catch (error) {
    console.error('GET Avatar error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new avatar
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createAvatarSchema.parse(body);

    const supabase = createRouteHandlerClient<Database>({ cookies });
    
    // Get user session
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Rate limiting
    const identifier = `avatar_create_${userId}`;
    const { success } = await ratelimit.limit(identifier);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    const avatarId = uuidv4();

    // Generate AI appearance if requested
    let appearanceData = validatedData.appearance;
    let avatarImageUrl = null;

    if (validatedData.appearance.ai_generated) {
      const generated = await generateAvatarAppearance(
        validatedData.appearance,
        validatedData.preferences
      );
      
      appearanceData = {
        ...validatedData.appearance,
        ai_description: generated.description
      };
      avatarImageUrl = generated.image_url;
    }

    // Create avatar record
    const { data: avatar, error } = await supabase
      .from('avatars')
      .insert({
        id: avatarId,
        user_id: userId,
        name: validatedData.name,
        description: validatedData.description || null,
        appearance_data: appearanceData,
        personality_data: validatedData.personality,
        preferences_data: validatedData.preferences,
        modules_enabled: validatedData.modules_enabled,
        avatar_image_url: avatarImageUrl,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Avatar creation error:', error);
      return NextResponse.json(
        { error: 'Failed to create avatar' },
        { status: 500 }
      );
    }

    // Generate and save default behaviors
    const behaviors = await generateAvatarBehaviors(validatedData.personality);
    
    if (behaviors.length > 0) {
      const behaviorInserts = behaviors.map(behavior => ({
        ...behavior,
        avatar_id: avatarId
      }));

      await supabase
        .from('avatar_behaviors')
        .insert(behaviorInserts);
    }

    // Add default clothing items
    const defaultClothing = [
      {
        avatar_id: avatarId,
        category: 'top',
        item_name: 'Basic Shirt',
        item_data: {
          color: validatedData.preferences.favorite_colors[0] || '#4A90E2',
          style: validatedData.appearance.style_preference,
          material: 'cotton'
        },
        is_equipped: true
      },
      {
        avatar_id: avatarId,
        category: 'bottom',
        item_name: 'Casual Pants',
        item_data: {
          color: '#2D3748',
          style: validatedData.appearance.style_preference,
          material: 'denim'
        },
        is_equipped: true
      }
    ];

    await supabase
      .from('avatar_clothing')
      .insert(defaultClothing);

    // Sync across modules
    await syncAvatarAcrossModules(avatarId, validatedData.modules_enabled, supabase);

    return NextResponse.json({ 
      avatar,
      message: 'Avatar created successfully'
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('POST Avatar error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update avatar
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = updateAvatarSchema.parse(body);

    const supabase = createRouteHandlerClient<Database>({ cookies });
    
    // Get user session
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Rate limiting
    const identifier = `avatar_update_${userId}`;
    const { success } = await ratelimit.limit(identifier);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    // Verify ownership
    const { data: existingAvatar } = await supabase
      .from('avatars')
      .select('id, user_id')
      .eq('id', validatedData.avatar_id)
      .eq('user_id', userId)
      .single();

    if (!existingAvatar) {
      return NextResponse.json({ error: 'Avatar not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (validatedData.name) updateData.name = validatedData.name;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.appearance) updateData.appearance_data = validatedData.appearance;
    if (validatedData.personality) updateData.personality_data = validatedData.personality;
    if (validatedData.preferences) updateData.preferences_data = validatedData.preferences;
    if (validatedData.modules_enabled) updateData.modules_enabled = validatedData.modules_enabled;

    // Handle AI-generated appearance updates
    if (validatedData.appearance?.ai_generated) {
      const generated = await generateAvatarAppearance(
        validatedData.appearance,
        validatedData.preferences || {}
      );
      
      updateData.appearance_data = {
        ...validatedData.appearance,
        ai_description: generated.description
      };
      
      if (generated.image_url) {
        updateData.avatar_image_url = generated.image_url;
      }
    }

    // Update avatar
    const { data: avatar, error } = await supabase
      .from('avatars')
      .update(updateData)
      .eq('id', validatedData.avatar_id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Avatar update error:', error);
      return NextResponse.json(
        { error: 'Failed to update avatar' },
        { status: 500 }
      );
    }

    // Update behaviors if personality changed
    if (validatedData.personality) {
      // Remove existing behaviors
      await supabase
        .from('avatar_behaviors')
        .delete()
        .eq('avatar_id', validatedData.avatar_id);

      // Generate new behaviors
      const behaviors = await generateAvatarBehaviors(validatedData.personality);
      
      if (behaviors.length > 0) {
        const behaviorInserts = behaviors.map(behavior => ({
          ...behavior,
          avatar_id: validatedData.avatar_id
        }));

        await supabase
          .from('avatar_behaviors')
          .insert(behaviorInserts);
      }
    }

    // Sync across modules
    await syncAvatarAcrossModules(
      validatedData.avatar_id,
      updateData.modules_enabled || ['all'],
      supabase
    );

    return NextResponse.json({ 
      avatar,
      message: 'Avatar updated successfully'
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('PUT Avatar error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Remove avatar
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const avatarId = searchParams.get('id');

    if (!avatarId) {
      return NextResponse.json(
        { error: 'Avatar ID is required' },
        { status: 400 }
      );
    }

    const supabase = createRouteHandlerClient<Database>({ cookies });
    
    // Get user session
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Rate limiting
    const identifier = `avatar_delete_${userId}`;
    const { success } = await ratelimit.limit(identifier);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    // Verify ownership
    const { data: existingAvatar } = await supabase
      .from('avatars')
      .select('id, user_id')
      .eq('id', avatarId)
      .eq('user_id', userId)
      .single();

    if (!existingAvatar) {
      return NextResponse.json({ error: 'Avatar not found' }, { status: 404 });
    }

    // Delete related data first (foreign key constraints)
    await Promise.all([
      supabase.from('avatar_clothing').delete().eq('avatar_id', avatarId),
      supabase.from('avatar_accessories').delete().eq('avatar_id', avatarId),
      supabase.from('avatar_behaviors').delete().eq('avatar_id', avatarId)
    ]);

    // Delete avatar