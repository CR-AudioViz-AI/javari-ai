/**
 * CR AudioViz AI - Javari Command Console v2
 * ==========================================
 * 
 * Talk to Javari via text OR voice.
 * Your AI COO that never sleeps.
 * 
 * @version 2.0.0
 * @date January 1, 2026
 */

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { 
  Send, 
  Sparkles,
  Mic,
  MicOff,
  Bot,
  User,
  Loader2,
  Volume2,
  VolumeX,
  TrendingUp,
  DollarSign,
  Users,
  Server,
  FileText,
  Wrench,
  Mail,
  Tag
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'javari'
  content: string
  result?: any
  timestamp: Date
  processing?: boolean
  audioUrl?: string
}

const QUICK_COMMANDS = [
  { icon: TrendingUp, label: 'Revenue', command: 'Run a revenue report' },
  { icon: Users, label: 'Users', command: 'Show user signups this week' },
  { icon: Server, label: 'Health', command: 'Check system health' },
  { icon: DollarSign, label: 'Grants', command: 'Check grant status' },
  { icon: Wrench, label: 'Fix Builds', command: 'Fix the broken builds' },
  { icon: Mail, label: 'Draft Email', command: 'Draft a welcome email for new users' },
  { icon: Tag, label: 'Promo Code', command: 'Create a 20% discount code' },
  { icon: FileText, label: 'Failed Deploys', command: 'Show failed deployments' },
]

export default function CommandConsole() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'javari',
      content: "Hello Roy! I'm Javari, your AI COO. I can run reports, manage users, fix deployments, and handle business operations. Try saying or typing a command, or use the quick buttons above!",
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [speechSupported, setSpeechSupported] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  
  // Check for speech recognition support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      setSpeechSupported(!!SpeechRecognition)
      
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = false
        recognitionRef.current.interimResults = false
        recognitionRef.current.lang = 'en-US'
        
        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript
          setInput(transcript)
          executeCommand(transcript)
        }
        
        recognitionRef.current.onend = () => {
          setIsListening(false)
        }
        
        recognitionRef.current.onerror = () => {
          setIsListening(false)
        }
      }
    }
  }, [])
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  
  useEffect(() => {
    scrollToBottom()
  }, [messages])
  
  const playAudio = async (base64Audio: string) => {
    if (!voiceEnabled) return
    
    try {
      const audioBlob = new Blob(
        [Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0))],
        { type: 'audio/mpeg' }
      )
      const audioUrl = URL.createObjectURL(audioBlob)
      
      if (audioRef.current) {
        audioRef.current.pause()
      }
      
      audioRef.current = new Audio(audioUrl)
      await audioRef.current.play()
    } catch (error) {
      console.error('Audio playback error:', error)
    }
  }
  
  const executeCommand = async (command: string) => {
    if (!command.trim() || isProcessing) return
    
    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: command,
      timestamp: new Date()
    }
    
    const processingMessage: Message = {
      id: `javari_${Date.now()}`,
      role: 'javari',
      content: 'Processing...',
      timestamp: new Date(),
      processing: true
    }
    
    setMessages(prev => [...prev, userMessage, processingMessage])
    setInput('')
    setIsProcessing(true)
    
    try {
      // Use voice API for audio response
      const response = await fetch('/api/javari/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: command })
      })
      
      const data = await response.json()
      
      // Format the response text with markdown-like styling
      let responseText = data.response || 'Command processed.'
      if (data.success && data.audio) {
        playAudio(data.audio)
      }
      
      setMessages(prev => prev.map(m => 
        m.id === processingMessage.id 
          ? { ...m, content: responseText, processing: false, audioUrl: data.audio ? 'has-audio' : undefined }
          : m
      ))
      
    } catch (error) {
      setMessages(prev => prev.map(m => 
        m.id === processingMessage.id 
          ? { ...m, content: 'I had trouble processing that. Please try again.', processing: false }
          : m
      ))
    } finally {
      setIsProcessing(false)
    }
  }
  
  const toggleListening = () => {
    if (!speechSupported || !recognitionRef.current) return
    
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      executeCommand(input)
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Javari Command Console</h1>
              <p className="text-sm text-gray-400">Your AI COO • Always On • Voice Enabled</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`p-2 rounded-lg transition ${voiceEnabled ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-800 text-gray-500'}`}
              title={voiceEnabled ? 'Voice responses on' : 'Voice responses off'}
            >
              {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <span className="flex items-center gap-1 text-green-400 text-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Online
            </span>
          </div>
        </div>
      </div>
      
      {/* Quick Commands */}
      <div className="border-b border-gray-800 px-6 py-3 overflow-x-auto">
        <div className="max-w-4xl mx-auto flex gap-2">
          {QUICK_COMMANDS.map((cmd, i) => (
            <button
              key={i}
              onClick={() => executeCommand(cmd.command)}
              disabled={isProcessing}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-sm whitespace-nowrap transition disabled:opacity-50"
            >
              <cmd.icon className="w-4 h-4 text-purple-400" />
              {cmd.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'javari' && (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/20">
                  <Bot className="w-6 h-6" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-100'
                }`}
              >
                {message.processing ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing your command...</span>
                  </div>
                ) : (
                  <>
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    {message.audioUrl && voiceEnabled && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-purple-300">
                        <Volume2 className="w-3 h-3" />
                        <span>Voice response played</span>
                      </div>
                    )}
                  </>
                )}
                <div className="text-xs opacity-50 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
              {message.role === 'user' && (
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Voice indicator */}
      {isListening && (
        <div className="px-6 py-2 bg-purple-600/20 border-t border-purple-500/30">
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-purple-300">
            <div className="flex gap-1">
              <span className="w-1 h-4 bg-purple-400 rounded animate-pulse" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-6 bg-purple-400 rounded animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-4 bg-purple-400 rounded animate-pulse" style={{ animationDelay: '300ms' }} />
              <span className="w-1 h-5 bg-purple-400 rounded animate-pulse" style={{ animationDelay: '450ms' }} />
            </div>
            <span>Listening... speak your command</span>
          </div>
        </div>
      )}
      
      {/* Input */}
      <div className="border-t border-gray-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell Javari what to do..."
              disabled={isProcessing || isListening}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500 disabled:opacity-50"
            />
            <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
          </div>
          <button
            onClick={() => executeCommand(input)}
            disabled={!input.trim() || isProcessing}
            className="px-4 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
          {speechSupported && (
            <button
              onClick={toggleListening}
              disabled={isProcessing}
              className={`px-4 py-3 rounded-xl transition ${
                isListening 
                  ? 'bg-red-600 hover:bg-red-500 animate-pulse' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
        </div>
        <p className="text-center text-xs text-gray-500 mt-2">
          Press Enter to send • Click mic to speak • Javari responds with voice
        </p>
      </div>
    </div>
  )
}
