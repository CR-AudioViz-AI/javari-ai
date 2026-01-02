/**
 * CR AudioViz AI - Javari Command Console
 * ========================================
 * 
 * Talk to Javari and she runs the business.
 * Your AI COO that never sleeps.
 * 
 * @version 1.0.0
 * @date January 1, 2026
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  Send, 
  Sparkles,
  Mic,
  MicOff,
  Bot,
  User,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  DollarSign,
  Users,
  Server,
  FileText
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'javari'
  content: string
  result?: any
  timestamp: Date
  processing?: boolean
}

const QUICK_COMMANDS = [
  { icon: TrendingUp, label: 'Revenue Report', command: 'Run a revenue report for the last 30 days' },
  { icon: Users, label: 'User Signups', command: 'Show me user signups this week' },
  { icon: Server, label: 'System Health', command: 'Check system health' },
  { icon: DollarSign, label: 'Grant Status', command: 'What is our grant application status?' },
  { icon: FileText, label: 'Failed Builds', command: 'Show me all failed deployments' },
]

export default function CommandConsole() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'javari',
      content: "Hello Roy! I'm Javari, your AI COO. I'm here to run the business with you. Tell me anything - run reports, check status, fix issues, analyze data. What would you like me to do?",
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  
  useEffect(() => {
    scrollToBottom()
  }, [messages])
  
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
      content: 'Processing your command...',
      timestamp: new Date(),
      processing: true
    }
    
    setMessages(prev => [...prev, userMessage, processingMessage])
    setInput('')
    setIsProcessing(true)
    
    try {
      const response = await fetch('/api/javari/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, userId: 'roy' })
      })
      
      const data = await response.json()
      
      // Generate natural language response
      let responseText = ''
      if (data.success) {
        responseText = formatResult(data.result, command)
      } else {
        responseText = `I encountered an issue: ${data.error}. Let me try a different approach or please rephrase your request.`
      }
      
      setMessages(prev => prev.map(m => 
        m.id === processingMessage.id 
          ? { ...m, content: responseText, result: data.result, processing: false }
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
  
  const formatResult = (result: any, command: string): string => {
    if (!result) return "I've processed your request."
    
    switch (result.type) {
      case 'revenue_report':
        return `📊 **Revenue Report (${result.period})**

💳 Subscriptions: ${result.subscriptions.count} active ($${result.subscriptions.revenue.toLocaleString()})
🎫 Credit Sales: ${result.credits.purchases} purchases ($${result.credits.revenue.toLocaleString()})
💰 **Total Revenue: $${result.totalRevenue.toLocaleString()}**

Need me to break this down further or compare to previous periods?`

      case 'user_report':
        const tierBreakdown = Object.entries(result.byTier || {})
          .map(([tier, count]) => `  • ${tier}: ${count}`)
          .join('\n')
        return `👥 **User Report (${result.period})**

New signups: **${result.newUsers}** users

By subscription tier:
${tierBreakdown || '  No tier data available'}

Want me to analyze conversion rates or user behavior?`

      case 'deployment_report':
        return `🚀 **Deployment Status**

✅ Ready: ${result.stats.ready}
❌ Failed: ${result.stats.error}
🔄 Building: ${result.stats.building}

${result.stats.error > 0 ? `\nFailed deployments need attention. Say "fix the broken builds" and I'll start the self-healing process.` : 'All systems looking good!'}`

      case 'failed_deployments':
        if (result.count === 0) {
          return "✅ Great news! No failed deployments found. All systems are healthy."
        }
        const failed = result.deployments.slice(0, 5)
          .map((d: any) => `  • ${d.project}`)
          .join('\n')
        return `⚠️ Found **${result.count}** failed deployments:

${failed}

Say "fix the broken builds" and I'll initiate self-healing.`

      case 'heal_initiated':
        return `🔧 **Self-Healing Started**

I've initiated the autonomous healing process. Here's what's happening:
- Analyzing failed builds
- Diagnosing errors with AI
- Generating fixes
- Pushing to GitHub
- Verifying deployments

Check the Autopilot dashboard for real-time progress.`

      case 'grant_status':
        const submitted = result.grants.map((g: any) => 
          `  ✅ ${g.name}: ${g.amount} - ${g.status}`
        ).join('\n')
        const upcoming = result.upcoming.slice(0, 3).map((g: any) =>
          `  📋 ${g.name}: ${g.amount} (${g.deadline})`
        ).join('\n')
        return `📝 **Grant Status**

**Submitted:**
${submitted}

**Upcoming Opportunities:**
${upcoming}

Want me to prepare materials for the next application?`

      case 'system_health':
        const services = Object.entries(result.services)
          .map(([name, status]) => `  ${status === 'healthy' ? '✅' : '⚠️'} ${name}: ${status}`)
          .join('\n')
        return `🏥 **System Health Check**

${services}

All core systems operational. Anything specific you want me to investigate?`

      case 'current_pricing':
        return `💵 **Current Pricing**

Subscription Plans:
  • Starter: $9/mo (500 credits)
  • Creator: $19/mo (1,500 credits)
  • Pro: $29/mo (5,000 credits)
  • Studio: $49/mo (15,000 credits)
  • Enterprise: $99/mo (50,000 credits)
  • Agency: $199/mo (unlimited)

Want me to change any pricing? Just tell me what to adjust.`

      case 'pricing_change_requested':
        return `⚠️ **Pricing Change Requested**

Plan: ${result.plan}
New Price: $${result.newPrice}
Status: Pending your approval

This change requires your confirmation before I execute it. Reply "approve" to proceed.`

      default:
        return `I've processed your request. Here's what I found:\n\n${JSON.stringify(result, null, 2)}`
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
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Javari Command Console</h1>
              <p className="text-sm text-gray-400">Your AI COO • Always On</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5" />
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
                    <span>Processing...</span>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                )}
                <div className="text-xs opacity-50 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
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
              disabled={isProcessing}
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
          <button
            onClick={() => setIsListening(!isListening)}
            className={`px-4 py-3 rounded-xl transition ${
              isListening 
                ? 'bg-red-600 hover:bg-red-500' 
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-center text-xs text-gray-500 mt-2">
          Press Enter to send • Javari can run reports, fix builds, manage pricing, and more
        </p>
      </div>
    </div>
  )
}
