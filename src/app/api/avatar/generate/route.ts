```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import OpenAI from 'openai';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { validateApiKey } from '@/lib/auth';

// Environment variables validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiApiKey = process.env.OPENAI_API_KEY!;
const replicateToken = process.env.REPLICATE_API_TOKEN!;

// Initialize clients
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

// Request validation schema
const generateAvatarSchema = z.object({
  userId: z.string().uuid(),
  photo: z.string().optional(), // Base64 encoded image
  preferences: z.object({
    style: z.enum(['realistic', 'cartoon', 'anime', 'stylized']).default('realistic'),
    gender: z.enum(['male', 'female', 'non-binary']).optional(),
    age: z.number().min(13).max(100).optional(),
    ethnicity: z.string().optional(),
    hairColor: z.string().optional(),
    eyeColor: z.string().optional(),
    skinTone: z.string().optional(),
    bodyType: z.enum(['slim', 'athletic', 'average', 'plus-size']).default('average'),
    clothing: z.object({
      top: z.string().default('casual-shirt'),
      bottom: z.string().default('jeans'),
      accessories: z.array(z.string()).default([])
    }).optional()
  }).optional(),
  customization: z.object({
    pose: z.string().default('neutral'),
    expression: z.string().default('neutral'),
    lighting: z.string().default('studio'),
    background: z.string().default('transparent')
  }).optional()
});

interface FacialFeatures {
  faceShape: string;
  eyeShape: string;
  noseShape: string;
  mouthShape: string;
  jawline: string;
  landmarks: number[][];
}

interface AvatarConfig {
  id: string;
  userId: string;
  style: string;
  features: FacialFeatures;
  customization: any;
  modelUrl: string;
  textureUrl: string;
  thumbnailUrl: string;
  createdAt: string;
}

// Rate limiting configuration
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await limiter.check(request, 5, 'AVATAR_GENERATION');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // API key validation
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey || !await validateApiKey(apiKey)) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = generateAvatarSchema.parse(body);

    const { userId, photo, preferences = {}, customization = {} } = validatedData;

    // Initialize MediaPipe Face Landmarker
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU"
      },
      runningMode: "IMAGE",
      numFaces: 1
    });

    let facialFeatures: FacialFeatures | null = null;

    // Analyze photo if provided
    if (photo) {
      try {
        // Decode base64 image
        const imageBuffer = Buffer.from(photo.split(',')[1], 'base64');
        
        // Process image with Sharp
        const processedImage = await sharp(imageBuffer)
          .resize(512, 512, { fit: 'cover' })
          .jpeg({ quality: 85 })
          .toBuffer();

        // Convert to ImageData for MediaPipe
        const imageData = new ImageData(
          new Uint8ClampedArray(processedImage),
          512,
          512
        );

        // Detect facial landmarks
        const landmarks = faceLandmarker.detect(imageData);
        
        if (landmarks.faceLandmarks && landmarks.faceLandmarks.length > 0) {
          const landmarkPoints = landmarks.faceLandmarks[0];
          
          // Analyze facial features using OpenAI Vision
          const faceAnalysis = await openai.chat.completions.create({
            model: "gpt-4-vision-preview",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Analyze this face and describe the facial features in JSON format with keys: faceShape, eyeShape, noseShape, mouthShape, jawline. Provide single word descriptions."
                  },
                  {
                    type: "image_url",
                    image_url: { url: `data:image/jpeg;base64,${photo.split(',')[1]}` }
                  }
                ]
              }
            ],
            max_tokens: 300
          });

          const analysisResult = JSON.parse(faceAnalysis.choices[0].message.content || '{}');
          
          facialFeatures = {
            ...analysisResult,
            landmarks: landmarkPoints.map(point => [point.x, point.y, point.z || 0])
          };
        }
      } catch (error) {
        console.error('Face analysis error:', error);
        // Continue without facial analysis if it fails
      }
    }

    // Generate avatar configuration
    const avatarId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Generate 3D model using Replicate
    const modelGeneration = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${replicateToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: "27b93a2413e7f36cd83da926f3656280b2931564ff050bf9575f1fdf9bcd7478", // Stable Diffusion 3D model
        input: {
          prompt: generateModelPrompt(preferences, facialFeatures),
          negative_prompt: "blurry, distorted, low quality, artifacts",
          num_inference_steps: 50,
          guidance_scale: 7.5,
          width: 512,
          height: 512
        }
      })
    });

    const modelResult = await modelGeneration.json();
    
    // Poll for completion
    let modelUrl = '';
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${modelResult.id}`, {
        headers: { 'Authorization': `Token ${replicateToken}` }
      });
      
      const status = await statusResponse.json();
      
      if (status.status === 'succeeded') {
        modelUrl = status.output[0];
        break;
      } else if (status.status === 'failed') {
        throw new Error('Model generation failed');
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    if (!modelUrl) {
      throw new Error('Model generation timeout');
    }

    // Generate texture variations
    const texturePrompt = generateTexturePrompt(preferences, customization);
    const textureGeneration = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${replicateToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: "ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4", // Texture generation model
        input: {
          prompt: texturePrompt,
          width: 1024,
          height: 1024,
          num_inference_steps: 30
        }
      })
    });

    const textureResult = await textureGeneration.json();
    
    // Wait for texture completion
    let textureUrl = '';
    attempts = 0;

    while (attempts < maxAttempts) {
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${textureResult.id}`, {
        headers: { 'Authorization': `Token ${replicateToken}` }
      });
      
      const status = await statusResponse.json();
      
      if (status.status === 'succeeded') {
        textureUrl = status.output[0];
        break;
      } else if (status.status === 'failed') {
        console.error('Texture generation failed, using default');
        textureUrl = '/assets/textures/default-avatar.png';
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    // Generate thumbnail
    const thumbnailBuffer = await sharp(Buffer.from(modelUrl))
      .resize(256, 256, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Upload assets to Supabase Storage
    const [modelUpload, textureUpload, thumbnailUpload] = await Promise.all([
      supabase.storage
        .from('avatars')
        .upload(`models/${avatarId}.glb`, modelUrl, {
          contentType: 'model/gltf-binary'
        }),
      supabase.storage
        .from('avatars')
        .upload(`textures/${avatarId}.png`, textureUrl, {
          contentType: 'image/png'
        }),
      supabase.storage
        .from('avatars')
        .upload(`thumbnails/${avatarId}.jpg`, thumbnailBuffer, {
          contentType: 'image/jpeg'
        })
    ]);

    if (modelUpload.error || textureUpload.error || thumbnailUpload.error) {
      throw new Error('Failed to upload avatar assets');
    }

    // Get public URLs
    const { data: modelPublicUrl } = supabase.storage
      .from('avatars')
      .getPublicUrl(`models/${avatarId}.glb`);
    
    const { data: texturePublicUrl } = supabase.storage
      .from('avatars')
      .getPublicUrl(`textures/${avatarId}.png`);
    
    const { data: thumbnailPublicUrl } = supabase.storage
      .from('avatars')
      .getPublicUrl(`thumbnails/${avatarId}.jpg`);

    // Save avatar configuration to database
    const avatarConfig: AvatarConfig = {
      id: avatarId,
      userId,
      style: preferences.style || 'realistic',
      features: facialFeatures || {} as FacialFeatures,
      customization,
      modelUrl: modelPublicUrl.publicUrl,
      textureUrl: texturePublicUrl.publicUrl,
      thumbnailUrl: thumbnailPublicUrl.publicUrl,
      createdAt: timestamp
    };

    const { error: dbError } = await supabase
      .from('avatar_configurations')
      .insert(avatarConfig);

    if (dbError) {
      console.error('Database save error:', dbError);
      throw new Error('Failed to save avatar configuration');
    }

    // Log generation for analytics
    await supabase
      .from('avatar_generations')
      .insert({
        avatar_id: avatarId,
        user_id: userId,
        generation_time: Date.now() - new Date(timestamp).getTime(),
        features_detected: !!facialFeatures,
        style: preferences.style || 'realistic',
        created_at: timestamp
      });

    return NextResponse.json({
      success: true,
      avatar: {
        id: avatarId,
        modelUrl: modelPublicUrl.publicUrl,
        textureUrl: texturePublicUrl.publicUrl,
        thumbnailUrl: thumbnailPublicUrl.publicUrl,
        features: facialFeatures,
        customization,
        createdAt: timestamp
      },
      message: 'Avatar generated successfully'
    });

  } catch (error) {
    console.error('Avatar generation error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Avatar generation failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const avatarId = searchParams.get('avatarId');

    if (!userId && !avatarId) {
      return NextResponse.json(
        { error: 'Missing userId or avatarId parameter' },
        { status: 400 }
      );
    }

    let query = supabase.from('avatar_configurations').select('*');

    if (avatarId) {
      query = query.eq('id', avatarId);
    } else if (userId) {
      query = query.eq('userId', userId);
    }

    const { data: avatars, error } = await query.order('createdAt', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch avatars: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      avatars: avatars || []
    });

  } catch (error) {
    console.error('Avatar fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch avatars' },
      { status: 500 }
    );
  }
}

// Helper functions
function generateModelPrompt(preferences: any, features: FacialFeatures | null): string {
  let prompt = `high quality 3D avatar, ${preferences.style || 'realistic'} style`;
  
  if (features) {
    prompt += `, ${features.faceShape} face shape, ${features.eyeShape} eyes, ${features.noseShape} nose`;
  }
  
  if (preferences.gender) {
    prompt += `, ${preferences.gender}`;
  }
  
  if (preferences.age) {
    const ageGroup = preferences.age < 25 ? 'young' : preferences.age < 45 ? 'adult' : 'mature';
    prompt += `, ${ageGroup}`;
  }
  
  if (preferences.ethnicity) {
    prompt += `, ${preferences.ethnicity} ethnicity`;
  }
  
  if (preferences.hairColor) {
    prompt += `, ${preferences.hairColor} hair`;
  }
  
  if (preferences.eyeColor) {
    prompt += `, ${preferences.eyeColor} eyes`;
  }

  prompt += ', professional lighting, clean background, high detail, 8k resolution';
  
  return prompt;
}

function generateTexturePrompt(preferences: any, customization: any): string {
  let prompt = `seamless texture map for 3D avatar, ${preferences.style || 'realistic'} style`;
  
  if (preferences.skinTone) {
    prompt += `, ${preferences.skinTone} skin tone`;
  }
  
  if (customization.lighting) {
    prompt += `, ${customization.lighting} lighting`;
  }
  
  prompt += ', high resolution, tileable, PBR materials, diffuse map';
  
  return prompt;
}
```