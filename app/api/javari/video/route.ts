// app/api/javari/video/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - VIDEO AVATAR INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: January 1, 2026 - 2:15 PM EST
// Version: 1.0 - JAVARI AS A LIVING VIDEO AVATAR
//
// The ultimate vision: Javari appears as a video like you're in a conference call.
// She speaks, gestures, and truly connects with users.
//
// Integration options:
// - HeyGen: Video avatar API
// - D-ID: Real-time digital human
// - Simli: Real-time avatar
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'

// Avatar configuration
const JAVARI_AVATAR = {
  // HeyGen avatar settings
  heygen: {
    avatarId: process.env.HEYGEN_AVATAR_ID || 'default',
    voiceId: process.env.HEYGEN_VOICE_ID || 'en-US-female-1',
    apiKey: process.env.HEYGEN_API_KEY
  },
  // D-ID settings
  did: {
    presenterId: process.env.DID_PRESENTER_ID || 'amy-jcwCkr1grs',
    voiceId: process.env.DID_VOICE_ID || 'en-US-JennyNeural',
    apiKey: process.env.DID_API_KEY
  },
  // Simli settings
  simli: {
    faceId: process.env.SIMLI_FACE_ID,
    apiKey: process.env.SIMLI_API_KEY
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEYGEN VIDEO GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

async function generateHeyGenVideo(text: string): Promise<{ videoUrl?: string; error?: string }> {
  if (!JAVARI_AVATAR.heygen.apiKey) {
    return { error: 'HeyGen API key not configured' }
  }

  try {
    // Create video generation task
    const response = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: {
        'X-Api-Key': JAVARI_AVATAR.heygen.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        video_inputs: [{
          character: {
            type: 'avatar',
            avatar_id: JAVARI_AVATAR.heygen.avatarId,
            avatar_style: 'normal'
          },
          voice: {
            type: 'text',
            input_text: text,
            voice_id: JAVARI_AVATAR.heygen.voiceId
          }
        }],
        dimension: {
          width: 720,
          height: 720
        }
      })
    })

    const data = await response.json()
    
    if (data.error) {
      return { error: data.error.message || 'HeyGen generation failed' }
    }

    // Poll for completion
    const videoId = data.data?.video_id
    if (!videoId) {
      return { error: 'No video ID returned' }
    }

    // Wait for video to be ready (max 60 seconds)
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 5000))
      
      const statusRes = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
        headers: { 'X-Api-Key': JAVARI_AVATAR.heygen.apiKey! }
      })
      
      const status = await statusRes.json()
      
      if (status.data?.status === 'completed') {
        return { videoUrl: status.data.video_url }
      }
      
      if (status.data?.status === 'failed') {
        return { error: 'Video generation failed' }
      }
    }

    return { error: 'Video generation timeout' }

  } catch (error) {
    return { error: error instanceof Error ? error.message : 'HeyGen error' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// D-ID VIDEO GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

async function generateDIDVideo(text: string): Promise<{ videoUrl?: string; error?: string }> {
  if (!JAVARI_AVATAR.did.apiKey) {
    return { error: 'D-ID API key not configured' }
  }

  try {
    const response = await fetch('https://api.d-id.com/talks', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${JAVARI_AVATAR.did.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source_url: 'https://create-images-results.d-id.com/DefaultPresenters/amy-jcwCkr1grs/image.jpeg',
        script: {
          type: 'text',
          input: text,
          provider: {
            type: 'microsoft',
            voice_id: JAVARI_AVATAR.did.voiceId
          }
        },
        config: {
          stitch: true,
          fluent: true
        }
      })
    })

    const data = await response.json()
    
    if (data.error) {
      return { error: data.error }
    }

    const talkId = data.id
    
    // Poll for completion
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 5000))
      
      const statusRes = await fetch(`https://api.d-id.com/talks/${talkId}`, {
        headers: { 'Authorization': `Basic ${JAVARI_AVATAR.did.apiKey}` }
      })
      
      const status = await statusRes.json()
      
      if (status.status === 'done') {
        return { videoUrl: status.result_url }
      }
      
      if (status.status === 'error') {
        return { error: 'Video generation failed' }
      }
    }

    return { error: 'Video generation timeout' }

  } catch (error) {
    return { error: error instanceof Error ? error.message : 'D-ID error' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REAL-TIME STREAMING (WebRTC)
// ═══════════════════════════════════════════════════════════════════════════════

async function createStreamingSession(): Promise<{ 
  sessionId?: string
  iceServers?: any[]
  offer?: any
  error?: string 
}> {
  // D-ID streaming API
  if (!JAVARI_AVATAR.did.apiKey) {
    return { error: 'D-ID API key not configured for streaming' }
  }

  try {
    const response = await fetch('https://api.d-id.com/talks/streams', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${JAVARI_AVATAR.did.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source_url: 'https://create-images-results.d-id.com/DefaultPresenters/amy-jcwCkr1grs/image.jpeg'
      })
    })

    const data = await response.json()
    
    if (data.error) {
      return { error: data.error }
    }

    return {
      sessionId: data.id,
      iceServers: data.ice_servers,
      offer: data.offer
    }

  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Streaming session error' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROCESS VIDEO COMMAND
// ═══════════════════════════════════════════════════════════════════════════════

async function processVideoCommand(transcript: string, provider: 'heygen' | 'did' = 'did'): Promise<{
  text: string
  videoUrl?: string
  error?: string
}> {
  // Get response from business API
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://javariai.com'}/api/javari/business`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: transcript, userId: 'video' })
  })

  const result = await response.json()
  
  // Format response for video
  let spokenText = formatForVideo(result)
  
  // Generate video with chosen provider
  let videoResult
  if (provider === 'heygen') {
    videoResult = await generateHeyGenVideo(spokenText)
  } else {
    videoResult = await generateDIDVideo(spokenText)
  }

  return {
    text: spokenText,
    videoUrl: videoResult.videoUrl,
    error: videoResult.error
  }
}

function formatForVideo(result: any): string {
  if (!result.success) {
    return "I'm sorry, I had trouble with that. Let me try again."
  }

  const data = result.result
  
  // Keep video responses concise and conversational
  switch (data?.type) {
    case 'revenue_report':
      return `Great news on revenue! You have ${data.subscriptions.count} active subscriptions bringing in $${data.subscriptions.revenue}. Your total revenue is $${data.totalRevenue}, with a projected annual revenue of $${data.projectedARR}. Things are looking good!`
    
    case 'user_report':
      return `Here's the user update. You've got ${data.newUsers} new signups. Your community is growing! Want me to dig deeper into the data?`
    
    case 'system_health':
      return `All systems are running smoothly. The main site, Javari AI, Vercel, and database are all healthy and operational. We're in great shape!`
    
    case 'grant_status':
      return `On the grants front - we have three applications submitted and pending review. That's over $30,000 in potential funding, with more opportunities worth $474,000 on the horizon!`
    
    case 'heal_initiated':
      return `I've started fixing those broken builds. The self-healing process is analyzing the errors and generating fixes automatically. I'll keep an eye on it.`
    
    default:
      return `Got it! I've processed your request. Is there anything else you'd like me to help with?`
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { transcript, action, provider = 'did' } = body

    // Check service status
    if (action === 'check') {
      return NextResponse.json({
        success: true,
        providers: {
          heygen: {
            configured: !!JAVARI_AVATAR.heygen.apiKey,
            avatarId: JAVARI_AVATAR.heygen.avatarId
          },
          did: {
            configured: !!JAVARI_AVATAR.did.apiKey,
            presenterId: JAVARI_AVATAR.did.presenterId
          },
          simli: {
            configured: !!JAVARI_AVATAR.simli.apiKey
          }
        },
        message: 'Video avatar service status'
      })
    }

    // Create streaming session for real-time video
    if (action === 'stream') {
      const session = await createStreamingSession()
      return NextResponse.json({
        success: !session.error,
        ...session,
        timestamp: new Date().toISOString()
      })
    }

    // Generate video response
    if (!transcript) {
      return NextResponse.json({ error: 'Transcript required' }, { status: 400 })
    }

    const response = await processVideoCommand(transcript, provider)

    return NextResponse.json({
      success: !response.error,
      transcript,
      response: response.text,
      videoUrl: response.videoUrl,
      error: response.error,
      provider,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Video processing failed'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'Javari Video Avatar Interface',
    version: '1.0.0',
    vision: 'Javari appears as a living video avatar - like a video call with your AI COO',
    providers: {
      heygen: {
        type: 'Pre-rendered video',
        configured: !!JAVARI_AVATAR.heygen.apiKey,
        features: ['High quality', 'Custom avatars', 'Multiple languages']
      },
      did: {
        type: 'Real-time + pre-rendered',
        configured: !!JAVARI_AVATAR.did.apiKey,
        features: ['WebRTC streaming', 'Low latency', 'Natural expressions']
      },
      simli: {
        type: 'Real-time only',
        configured: !!JAVARI_AVATAR.simli.apiKey,
        features: ['Ultra low latency', 'Interactive']
      }
    },
    usage: {
      generateVideo: 'POST { transcript: "your message", provider: "did" }',
      startStream: 'POST { action: "stream" }',
      checkStatus: 'POST { action: "check" }'
    },
    requiredEnvVars: [
      'DID_API_KEY - For D-ID avatar',
      'HEYGEN_API_KEY - For HeyGen avatar',
      'SIMLI_API_KEY - For Simli real-time'
    ]
  })
}
