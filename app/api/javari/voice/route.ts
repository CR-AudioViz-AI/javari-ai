// app/api/javari/voice/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - VOICE COMMAND INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: January 1, 2026 - 1:56 PM EST
// Version: 1.0 - SPEAK TO JAVARI
//
// Integration points:
// - ElevenLabs for text-to-speech (Javari's voice)
// - Web Speech API for speech-to-text (user input)
// - OpenRouter for command processing
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'

// Javari's voice configuration
const JAVARI_VOICE = {
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL', // Default: Bella
  model: 'eleven_turbo_v2',
  stability: 0.5,
  similarity_boost: 0.8,
  style: 0.5,
  use_speaker_boost: true
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEXT TO SPEECH - Javari speaks back
// ═══════════════════════════════════════════════════════════════════════════════

async function textToSpeech(text: string): Promise<ArrayBuffer | null> {
  if (!process.env.ELEVENLABS_API_KEY) {
    console.log('ElevenLabs API key not configured')
    return null
  }
  
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${JAVARI_VOICE.elevenLabsVoiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text,
          model_id: JAVARI_VOICE.model,
          voice_settings: {
            stability: JAVARI_VOICE.stability,
            similarity_boost: JAVARI_VOICE.similarity_boost,
            style: JAVARI_VOICE.style,
            use_speaker_boost: JAVARI_VOICE.use_speaker_boost
          }
        })
      }
    )
    
    if (!response.ok) {
      console.error('ElevenLabs error:', response.status)
      return null
    }
    
    return await response.arrayBuffer()
  } catch (error) {
    console.error('TTS error:', error)
    return null
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROCESS VOICE COMMAND
// ═══════════════════════════════════════════════════════════════════════════════

async function processVoiceCommand(transcript: string): Promise<{ text: string; audio?: string }> {
  // Send to business command API
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://javariai.com'}/api/javari/business`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: transcript, userId: 'voice' })
  })
  
  const result = await response.json()
  
  // Format response for speech
  let spokenResponse = formatForSpeech(result)
  
  // Generate audio response
  const audioBuffer = await textToSpeech(spokenResponse)
  
  return {
    text: spokenResponse,
    audio: audioBuffer ? Buffer.from(audioBuffer).toString('base64') : undefined
  }
}

function formatForSpeech(result: any): string {
  if (!result.success) {
    return "I'm sorry, I had trouble processing that command. Could you try again?"
  }
  
  const data = result.result
  
  switch (data?.type) {
    case 'revenue_report':
      return `Here's your revenue report. You have ${data.subscriptions.count} active subscriptions generating $${data.subscriptions.revenue} in subscription revenue. Total revenue is $${data.totalRevenue}. Your projected annual recurring revenue is $${data.projectedARR}.`
    
    case 'user_report':
      return `In the ${data.period.replace('_', ' ')}, you had ${data.newUsers} new user signups. Would you like me to break this down by subscription tier?`
    
    case 'deployment_report':
    case 'deployment_status':
      const stats = data.stats || data
      if (stats.error > 0) {
        return `You have ${stats.error} failed deployments that need attention. ${stats.ready} deployments are ready. Would you like me to start the self-healing process?`
      }
      return `All systems healthy! ${stats.ready} deployments are ready with no failures.`
    
    case 'heal_initiated':
      return "I've started the self-healing process. I'm analyzing failed builds and will generate fixes automatically. Check the Autopilot dashboard for progress."
    
    case 'grant_status':
      return `You have ${data.submitted.length} grant applications submitted. The Amber Grant and Skip Year-End Grant are pending review. You have ${data.upcoming.length} upcoming grant opportunities worth over $474,000 in potential funding.`
    
    case 'system_health':
      const allHealthy = Object.values(data.services).every((s: any) => s.includes('Healthy') || s.includes('✅'))
      if (allHealthy) {
        return "All systems are healthy and operational. Main site, Javari AI, Vercel, and database are all running smoothly."
      }
      return "I've detected some issues with the platform. Let me check what's happening."
    
    case 'user_list':
      return `Found ${data.count} users. The most recent signups are ${data.users?.slice(0, 3).map((u: any) => u.email.split('@')[0]).join(', ')}. Would you like more details?`
    
    case 'credits_added':
      return `Done! I've added ${data.creditsAdded} credits to ${data.user}. Their new balance is ${data.newBalance} credits.`
    
    case 'email_draft':
      return "I've drafted the email for you. You can review it in the Command Console. Would you like me to send it to a specific audience?"
    
    case 'promo_created':
      return `Created promo code ${data.code} for ${data.discount} off. It's valid for ${data.validUntil} with a maximum of ${data.maxUses} uses.`
    
    case 'approval_required':
      return "This action requires your approval. I've logged it for review. You can approve it by saying 'approve' or through the admin dashboard."
    
    default:
      return "I've processed your command. Is there anything else you'd like me to do?"
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    const { transcript, action } = body
    
    // Health check for voice service
    if (action === 'check') {
      const hasElevenLabs = !!process.env.ELEVENLABS_API_KEY
      return NextResponse.json({
        success: true,
        ttsEnabled: hasElevenLabs,
        voiceId: JAVARI_VOICE.elevenLabsVoiceId,
        message: hasElevenLabs ? 'Voice service ready' : 'Voice service requires ElevenLabs API key'
      })
    }
    
    // Test TTS
    if (action === 'test') {
      const testAudio = await textToSpeech("Hello Roy! I'm Javari, your AI assistant. How can I help you today?")
      return NextResponse.json({
        success: !!testAudio,
        audio: testAudio ? Buffer.from(testAudio).toString('base64') : null,
        message: testAudio ? 'Voice test successful' : 'Voice service not configured'
      })
    }
    
    if (!transcript) {
      return NextResponse.json({ error: 'Transcript required' }, { status: 400 })
    }
    
    const response = await processVoiceCommand(transcript)
    
    return NextResponse.json({
      success: true,
      transcript,
      response: response.text,
      audio: response.audio,
      hasAudio: !!response.audio,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Voice processing failed',
      response: "I'm sorry, I had trouble processing that. Please try again."
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'Javari Voice Command Interface',
    version: '1.0.0',
    features: {
      speechToText: 'Browser Web Speech API',
      textToSpeech: 'ElevenLabs',
      commandProcessing: 'Business Command Center'
    },
    voiceConfig: {
      voiceId: JAVARI_VOICE.elevenLabsVoiceId,
      model: JAVARI_VOICE.model
    },
    usage: {
      speak: 'POST with { transcript: "your command" }',
      test: 'POST with { action: "test" }',
      check: 'POST with { action: "check" }'
    }
  })
}
