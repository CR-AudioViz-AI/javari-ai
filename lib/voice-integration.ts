// Javari Voice Integration
// ElevenLabs (primary), Google Cloud TTS (fallback)
// Updated: December 22, 2025
export type VoiceProvider = 'elevenlabs' | 'google';
export interface VoiceConfig {
// ElevenLabs voice presets for Javari personality
// Google Cloud fallback config
    // Try ElevenLabs first
  // Fallback to Google
  // Split by sentences for natural streaming
    // Return default voices if API fails
export default {}
