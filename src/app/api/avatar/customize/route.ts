```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { headers } from 'next/headers';
import Pusher from 'pusher';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize Pusher for real-time updates
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

// Avatar customization schema
const avatarCustomizationSchema = z.object({
  appearance: z.object({
    skinTone: z.string().regex(/^#[0-9A-F]{6}$/i),
    eyeColor: z.string().regex(/^#[0-9A-F]{6}$/i),
    hairColor: z.string().regex(/^#[0-9A-F]{6}$/i),
    hairStyle: z.string().min(1).max(50),
    faceShape: z.enum(['oval', 'round', 'square', 'heart', 'long']),
    bodyType: z.enum(['slim', 'athletic', 'average', 'curvy', 'plus']),
    height: z.number().min(0.5).max(2.5),
  }).optional(),
  clothing: z.object({
    head: z.string().nullable().optional(),
    top: z.string().nullable().optional(),
    bottom: z.string().nullable().optional(),
    shoes: z.string().nullable().optional(),
    outerwear: z.string().nullable().optional(),
  }).optional(),
  accessories: z.object({
    jewelry: z.array(z.string()).max(5).optional(),
    bags: z.array(z.string()).max(2).optional(),
    glasses: z.string().nullable().optional(),
    hat: z.string().nullable().optional(),
    watch: z.string().nullable().optional(),
  }).optional(),
  behavioral: z.object({
    personality: z.enum(['friendly', 'professional', 'casual', 'energetic', 'calm']),
    gesture_style: z.enum(['minimal', 'expressive', 'formal', 'animated']),
    voice_tone: z.enum(['warm', 'neutral', 'authoritative', 'cheerful']),
    interaction_preference: z.enum(['extroverted', 'introverted', 'balanced']),
  }).optional(),
  nft_assets: z.array(z.object({
    contract_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    token_id: z.string(),
    asset_type: z.enum(['clothing', 'accessory', 'appearance_modifier']),
    metadata_uri: z.string().url(),
  })).max(10).optional(),
  export_settings: z.object({
    platforms: z.array(z.enum(['vrm', 'fbx', 'gltf', 'ready_player_me', 'custom'])).optional(),
    quality: z.enum(['low', 'medium', 'high', 'ultra']).default('medium'),
    include_animations: z.boolean().default(true),
  }).optional(),
});

// Rate limiting map
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 30;

  const current = rateLimitMap.get(identifier);
  if (!current || now > current.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (current.count >= maxRequests) {
    return false;
  }

  current.count++;
  return true;
}

async function validateNFTAssets(nftAssets: any[], userId: string): Promise<boolean> {
  if (!nftAssets || nftAssets.length === 0) return true;

  try {
    for (const asset of nftAssets) {
      // Verify NFT ownership via blockchain API
      const response = await fetch(`${process.env.BLOCKCHAIN_API_URL}/verify-ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_address: asset.contract_address,
          token_id: asset.token_id,
          owner_address: userId, // Assuming userId maps to wallet address
        }),
      });

      if (!response.ok) return false;
      const verification = await response.json();
      if (!verification.is_owner) return false;
    }
    return true;
  } catch (error) {
    console.error('NFT validation error:', error);
    return false;
  }
}

async function validateAssetInventory(clothing: any, accessories: any, userId: string): Promise<boolean> {
  try {
    const allAssetIds = [
      ...(clothing ? Object.values(clothing).filter(Boolean) : []),
      ...(accessories ? Object.values(accessories).flat().filter(Boolean) : []),
    ];

    if (allAssetIds.length === 0) return true;

    const { data: userAssets, error } = await supabase
      .from('avatar_assets')
      .select('asset_id')
      .eq('user_id', userId)
      .in('asset_id', allAssetIds);

    if (error) throw error;

    const ownedAssetIds = userAssets.map(asset => asset.asset_id);
    return allAssetIds.every(assetId => ownedAssetIds.includes(assetId));
  } catch (error) {
    console.error('Asset inventory validation error:', error);
    return false;
  }
}

async function generateAvatarExport(customizationData: any, exportSettings: any): Promise<string[]> {
  try {
    const exportUrls: string[] = [];
    const platforms = exportSettings.platforms || ['gltf'];

    for (const platform of platforms) {
      const response = await fetch(`${process.env.AVATAR_SDK_URL}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.AVATAR_SDK_KEY}`,
        },
        body: JSON.stringify({
          customization: customizationData,
          format: platform,
          quality: exportSettings.quality,
          include_animations: exportSettings.include_animations,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        exportUrls.push(result.download_url);
      }
    }

    return exportUrls;
  } catch (error) {
    console.error('Avatar export error:', error);
    return [];
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const headersList = headers();
    const authorization = headersList.get('authorization');
    const userAgent = headersList.get('user-agent') || 'unknown';
    const clientIp = headersList.get('x-forwarded-for') || 'unknown';

    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authorization.split(' ')[1];
    const { data: user, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = user.user.id;
    const rateLimitId = `${userId}:${clientIp}`;

    if (!checkRateLimit(rateLimitId)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validatedData = avatarCustomizationSchema.parse(body);

    // Validate NFT assets if provided
    if (validatedData.nft_assets && validatedData.nft_assets.length > 0) {
      const nftValid = await validateNFTAssets(validatedData.nft_assets, userId);
      if (!nftValid) {
        return NextResponse.json(
          { error: 'Invalid NFT asset ownership' },
          { status: 403 }
        );
      }
    }

    // Validate asset inventory
    const inventoryValid = await validateAssetInventory(
      validatedData.clothing,
      validatedData.accessories,
      userId
    );

    if (!inventoryValid) {
      return NextResponse.json(
        { error: 'Asset not owned by user' },
        { status: 403 }
      );
    }

    // Get current avatar profile
    const { data: currentProfile, error: profileError } = await supabase
      .from('avatar_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError;
    }

    // Merge customization data
    const mergedCustomization = {
      ...currentProfile?.customization_data,
      ...validatedData,
      updated_at: new Date().toISOString(),
      version: (currentProfile?.version || 0) + 1,
    };

    // Update avatar profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from('avatar_profiles')
      .upsert({
        user_id: userId,
        customization_data: mergedCustomization,
        version: mergedCustomization.version,
        last_modified: new Date().toISOString(),
      })
      .select()
      .single();

    if (updateError) throw updateError;

    // Generate export files if requested
    let exportUrls: string[] = [];
    if (validatedData.export_settings) {
      exportUrls = await generateAvatarExport(
        mergedCustomization,
        validatedData.export_settings
      );
    }

    // Store NFT assets if provided
    if (validatedData.nft_assets && validatedData.nft_assets.length > 0) {
      const nftRecords = validatedData.nft_assets.map(asset => ({
        user_id: userId,
        contract_address: asset.contract_address,
        token_id: asset.token_id,
        asset_type: asset.asset_type,
        metadata_uri: asset.metadata_uri,
        is_active: true,
        linked_at: new Date().toISOString(),
      }));

      await supabase.from('avatar_nfts').upsert(nftRecords);
    }

    // Broadcast real-time update
    await pusher.trigger(`avatar-${userId}`, 'customization-updated', {
      profile: updatedProfile,
      export_urls: exportUrls,
      timestamp: new Date().toISOString(),
    });

    // Log activity
    await supabase.from('avatar_activity_logs').insert({
      user_id: userId,
      action: 'avatar_customized',
      details: {
        changes: Object.keys(validatedData),
        version: mergedCustomization.version,
        user_agent: userAgent,
        ip_address: clientIp,
      },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      export_urls: exportUrls,
      message: 'Avatar customization updated successfully',
    });

  } catch (error) {
    console.error('Avatar customization error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const headersList = headers();
    const authorization = headersList.get('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authorization.split(' ')[1];
    const { data: user, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = user.user.id;
    const { searchParams } = new URL(request.url);
    const includeAssets = searchParams.get('include_assets') === 'true';
    const includeNFTs = searchParams.get('include_nfts') === 'true';

    // Get avatar profile
    const { data: profile, error: profileError } = await supabase
      .from('avatar_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError;
    }

    let assets = null;
    let nfts = null;

    if (includeAssets) {
      const { data: assetData } = await supabase
        .from('avatar_assets')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);
      assets = assetData;
    }

    if (includeNFTs) {
      const { data: nftData } = await supabase
        .from('avatar_nfts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);
      nfts = nftData;
    }

    return NextResponse.json({
      profile: profile || { user_id: userId, customization_data: {}, version: 0 },
      assets,
      nfts,
    });

  } catch (error) {
    console.error('Get avatar customization error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const headersList = headers();
    const authorization = headersList.get('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authorization.split(' ')[1];
    const { data: user, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = user.user.id;
    const body = await request.json();
    const validatedData = avatarCustomizationSchema.parse(body);

    // Complete replacement - validate all assets
    if (validatedData.nft_assets) {
      const nftValid = await validateNFTAssets(validatedData.nft_assets, userId);
      if (!nftValid) {
        return NextResponse.json(
          { error: 'Invalid NFT asset ownership' },
          { status: 403 }
        );
      }
    }

    const inventoryValid = await validateAssetInventory(
      validatedData.clothing,
      validatedData.accessories,
      userId
    );

    if (!inventoryValid) {
      return NextResponse.json(
        { error: 'Asset not owned by user' },
        { status: 403 }
      );
    }

    const completeCustomization = {
      ...validatedData,
      updated_at: new Date().toISOString(),
      version: 1,
    };

    // Replace avatar profile completely
    const { data: updatedProfile, error: updateError } = await supabase
      .from('avatar_profiles')
      .upsert({
        user_id: userId,
        customization_data: completeCustomization,
        version: 1,
        last_modified: new Date().toISOString(),
      })
      .select()
      .single();

    if (updateError) throw updateError;

    // Generate exports if requested
    let exportUrls: string[] = [];
    if (validatedData.export_settings) {
      exportUrls = await generateAvatarExport(
        completeCustomization,
        validatedData.export_settings
      );
    }

    // Broadcast update
    await pusher.trigger(`avatar-${userId}`, 'avatar-replaced', {
      profile: updatedProfile,
      export_urls: exportUrls,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      export_urls: exportUrls,
      message: 'Avatar completely updated',
    });

  } catch (error) {
    console.error('Avatar replacement error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```