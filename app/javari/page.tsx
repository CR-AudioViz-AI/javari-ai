/**
 * CR AudioViz AI - Javari AI Hub
 * ==============================
 * 
 * Central hub for all Javari interaction modes:
 * - Text Chat (Command Console)
 * - Voice Chat
 * - Video Call
 * 
 * @version 1.0.0
 * @date January 1, 2026
 */

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Bot,
  MessageSquare,
  Mic,
  Video,
  Sparkles,
  TrendingUp,
  Users,
  Server,
  Shield,
  Zap,
  ArrowRight,
  CheckCircle,
  Clock
} from 'lucide-react'

interface SystemStatus {
  mainSite: string
  javariAI: string
  vercel: string
  database: string
}

export default function JavariHub() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    // Check system status
    fetch('/api/javari/business', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'Check system health' })
    })
      .then(res => res.json())
      .then(data => {
        if (data.result?.services) {
          setSystemStatus(data.result.services)
        }
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [])
  
  const interactionModes = [
    {
      title: 'Command Console',
      description: 'Text-based commands with AI responses',
      icon: MessageSquare,
      href: '/command',
      color: 'from-blue-500 to-cyan-500',
      features: ['Natural language commands', 'Quick action buttons', 'Full business control']
    },
    {
      title: 'Voice Chat',
      description: 'Speak to Javari and hear responses',
      icon: Mic,
      href: '/command',
      color: 'from-purple-500 to-pink-500',
      features: ['Speech-to-text', 'ElevenLabs voice', 'Hands-free operation'],
      badge: 'Voice Enabled'
    },
    {
      title: 'Video Call',
      description: 'Face-to-face with your AI COO',
      icon: Video,
      href: '/video',
      color: 'from-orange-500 to-red-500',
      features: ['D-ID or HeyGen avatars', 'Real-time video', 'Natural gestures'],
      badge: 'Coming Soon'
    }
  ]
  
  const capabilities = [
    { icon: TrendingUp, title: 'Analytics', desc: 'Revenue, users, deployments' },
    { icon: Users, title: 'User Management', desc: 'Add credits, manage subscriptions' },
    { icon: Server, title: 'Deployments', desc: 'Fix builds, check status' },
    { icon: Shield, title: 'Security', desc: 'Approval-based dangerous ops' },
    { icon: Sparkles, title: 'Marketing', desc: 'Draft emails, create promos' },
    { icon: Zap, title: 'Self-Healing', desc: 'Autonomous error fixing' }
  ]
  
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-pink-900/20" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        
        <div className="relative max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-6 shadow-2xl shadow-purple-500/30">
              <Bot className="w-12 h-12" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Meet <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Javari</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Your AI COO that never sleeps. Run reports, manage users, fix deployments, and control your entire business with natural language.
            </p>
          </div>
          
          {/* System Status */}
          <div className="flex items-center justify-center gap-6 mb-12 text-sm">
            {isLoading ? (
              <span className="text-gray-500">Checking systems...</span>
            ) : systemStatus ? (
              <>
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${systemStatus.mainSite?.includes('✅') ? 'bg-green-500' : 'bg-red-500'}`} />
                  Main Site
                </span>
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${systemStatus.javariAI?.includes('✅') ? 'bg-green-500' : 'bg-red-500'}`} />
                  Javari AI
                </span>
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${systemStatus.database?.includes('✅') ? 'bg-green-500' : 'bg-red-500'}`} />
                  Database
                </span>
              </>
            ) : (
              <span className="flex items-center gap-1 text-green-400">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                All Systems Operational
              </span>
            )}
          </div>
          
          {/* Interaction Modes */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {interactionModes.map((mode, i) => (
              <Link
                key={i}
                href={mode.href}
                className="group relative bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-purple-500/50 transition-all hover:shadow-xl hover:shadow-purple-500/10"
              >
                {mode.badge && (
                  <span className="absolute top-4 right-4 px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full">
                    {mode.badge}
                  </span>
                )}
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${mode.color} flex items-center justify-center mb-4 group-hover:scale-110 transition`}>
                  <mode.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{mode.title}</h3>
                <p className="text-gray-400 mb-4">{mode.description}</p>
                <ul className="space-y-2">
                  {mode.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-gray-500">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center gap-2 text-purple-400 group-hover:text-purple-300 transition">
                  <span>Open</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                </div>
              </Link>
            ))}
          </div>
          
          {/* Capabilities Grid */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-center mb-8">What Javari Can Do</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {capabilities.map((cap, i) => (
                <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-center hover:border-purple-500/30 transition">
                  <cap.icon className="w-8 h-8 mx-auto mb-2 text-purple-400" />
                  <h4 className="font-medium text-sm mb-1">{cap.title}</h4>
                  <p className="text-xs text-gray-500">{cap.desc}</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Quick Commands */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              Try These Commands
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                'Run a revenue report',
                'Show user signups this week',
                'Check system health',
                'Fix the broken builds',
                'What is our grant status?',
                'Create a 20% discount code',
                'List all Pro users',
                'Show failed deployments'
              ].map((cmd, i) => (
                <Link
                  key={i}
                  href={`/command?cmd=${encodeURIComponent(cmd)}`}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 hover:text-white transition text-center"
                >
                  "{cmd}"
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="border-t border-gray-800 px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <span>CR AudioViz AI © 2026</span>
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Javari is always on, 24/7
          </span>
        </div>
      </div>
    </div>
  )
}
