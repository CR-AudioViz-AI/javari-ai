/**
 * CR AudioViz AI - Javari Video Chat
 * ===================================
 * 
 * The ultimate experience: Video call with Javari.
 * She speaks, gestures, and truly connects.
 * 
 * @version 1.0.0
 * @date January 1, 2026
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  Video, 
  VideoOff,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Settings,
  Maximize,
  Minimize,
  Bot,
  User,
  Loader2,
  Volume2,
  MessageSquare,
  Sparkles
} from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'javari'
  content: string
  videoUrl?: string
  timestamp: Date
}

export default function VideoChat() {
  const [isCallActive, setIsCallActive] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [transcript, setTranscript] = useState('')
  const [provider, setProvider] = useState<'did' | 'heygen'>('did')
  const [showChat, setShowChat] = useState(false)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const recognitionRef = useRef<any>(null)
  
  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = true
        recognitionRef.current.interimResults = true
        recognitionRef.current.lang = 'en-US'
        
        recognitionRef.current.onresult = (event: any) => {
          const last = event.results.length - 1
          const text = event.results[last][0].transcript
          setTranscript(text)
          
          if (event.results[last].isFinal) {
            processCommand(text)
          }
        }
        
        recognitionRef.current.onend = () => {
          if (isListening && isCallActive) {
            recognitionRef.current.start()
          }
        }
      }
    }
  }, [isListening, isCallActive])
  
  const startCall = () => {
    setIsCallActive(true)
    setIsListening(true)
    if (recognitionRef.current) {
      recognitionRef.current.start()
    }
    
    // Initial greeting
    generateVideoResponse("Hello Roy! Great to see you. What can I help you with today?")
  }
  
  const endCall = () => {
    setIsCallActive(false)
    setIsListening(false)
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setCurrentVideoUrl(null)
  }
  
  const toggleMute = () => {
    setIsMuted(!isMuted)
    if (recognitionRef.current) {
      if (isMuted) {
        recognitionRef.current.start()
        setIsListening(true)
      } else {
        recognitionRef.current.stop()
        setIsListening(false)
      }
    }
  }
  
  const processCommand = async (command: string) => {
    if (!command.trim() || isProcessing) return
    
    setMessages(prev => [...prev, {
      id: `user_${Date.now()}`,
      role: 'user',
      content: command,
      timestamp: new Date()
    }])
    
    await generateVideoResponse(command)
  }
  
  const generateVideoResponse = async (text: string) => {
    setIsProcessing(true)
    
    try {
      const response = await fetch('/api/javari/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transcript: text, 
          provider 
        })
      })
      
      const data = await response.json()
      
      if (data.videoUrl) {
        setCurrentVideoUrl(data.videoUrl)
      }
      
      setMessages(prev => [...prev, {
        id: `javari_${Date.now()}`,
        role: 'javari',
        content: data.response || text,
        videoUrl: data.videoUrl,
        timestamp: new Date()
      }])
      
    } catch (error) {
      console.error('Video generation error:', error)
    } finally {
      setIsProcessing(false)
    }
  }
  
  // Auto-play video when URL changes
  useEffect(() => {
    if (videoRef.current && currentVideoUrl) {
      videoRef.current.src = currentVideoUrl
      videoRef.current.play()
    }
  }, [currentVideoUrl])
  
  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'min-h-screen'} bg-gray-950 text-white flex`}>
      {/* Main Video Area */}
      <div className="flex-1 flex flex-col">
        {/* Video Display */}
        <div className="flex-1 relative bg-gray-900 flex items-center justify-center">
          {isCallActive ? (
            <>
              {/* Javari Avatar Video */}
              <div className="relative w-full max-w-3xl aspect-video">
                {currentVideoUrl ? (
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover rounded-lg"
                    autoPlay
                    playsInline
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4 animate-pulse">
                        <Bot className="w-16 h-16" />
                      </div>
                      <p className="text-xl font-semibold">Javari AI</p>
                      <p className="text-gray-400 text-sm">
                        {isProcessing ? 'Generating response...' : 'Listening...'}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Processing indicator */}
                {isProcessing && (
                  <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                    <span className="text-sm">Generating video...</span>
                  </div>
                )}
              </div>
              
              {/* User preview (small corner) */}
              <div className="absolute bottom-4 right-4 w-32 h-24 bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center">
                <User className="w-8 h-8 text-gray-500" />
              </div>
              
              {/* Live transcript */}
              {transcript && isListening && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/70 px-4 py-2 rounded-lg max-w-xl">
                  <p className="text-center">{transcript}</p>
                </div>
              )}
            </>
          ) : (
            // Pre-call state
            <div className="text-center">
              <div className="w-40 h-40 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-6 shadow-2xl shadow-purple-500/30">
                <Bot className="w-20 h-20" />
              </div>
              <h1 className="text-3xl font-bold mb-2">Video Call with Javari</h1>
              <p className="text-gray-400 mb-8">Your AI COO is ready to connect</p>
              <button
                onClick={startCall}
                className="px-8 py-4 bg-green-600 hover:bg-green-500 rounded-full text-lg font-semibold flex items-center gap-3 mx-auto transition transform hover:scale-105"
              >
                <Video className="w-6 h-6" />
                Start Video Call
              </button>
            </div>
          )}
        </div>
        
        {/* Call Controls */}
        {isCallActive && (
          <div className="bg-gray-900 border-t border-gray-800 px-6 py-4">
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={toggleMute}
                className={`p-4 rounded-full transition ${
                  isMuted ? 'bg-red-600 hover:bg-red-500' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
              
              <button
                onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                className={`p-4 rounded-full transition ${
                  !isVideoEnabled ? 'bg-red-600 hover:bg-red-500' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              </button>
              
              <button
                onClick={endCall}
                className="p-4 bg-red-600 hover:bg-red-500 rounded-full transition"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
              
              <button
                onClick={() => setShowChat(!showChat)}
                className={`p-4 rounded-full transition ${
                  showChat ? 'bg-purple-600 hover:bg-purple-500' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <MessageSquare className="w-6 h-6" />
              </button>
              
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-4 bg-gray-700 hover:bg-gray-600 rounded-full transition"
              >
                {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
              </button>
              
              {/* Provider selector */}
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as 'did' | 'heygen')}
                className="bg-gray-700 px-3 py-2 rounded-lg text-sm"
              >
                <option value="did">D-ID</option>
                <option value="heygen">HeyGen</option>
              </select>
            </div>
            
            {/* Status indicators */}
            <div className="flex items-center justify-center gap-4 mt-3 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                {isListening ? (
                  <>
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Listening
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                    Muted
                  </>
                )}
              </span>
              <span>•</span>
              <span>Provider: {provider.toUpperCase()}</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Chat Sidebar */}
      {showChat && isCallActive && (
        <div className="w-80 border-l border-gray-800 flex flex-col bg-gray-900">
          <div className="p-4 border-b border-gray-800">
            <h2 className="font-semibold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-purple-400" />
              Chat History
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'javari' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user' ? 'bg-purple-600' : 'bg-gray-800'
                }`}>
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
