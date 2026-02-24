// app/api/javari/learn/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - AUTONOMOUS LEARNING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: January 1, 2026 - 2:42 PM EST
// Version: 1.0 - JAVARI LEARNS AND IMPROVES
//
// This system allows Javari to:
// - Track command success/failure rates
// - Learn from user corrections
// - Improve response accuracy over time
// - Build a knowledge base from interactions
// - Suggest improvements to her own systems
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACK COLLECTION
// ═══════════════════════════════════════════════════════════════════════════════

interface CommandFeedback {
  commandId: string
  wasHelpful: boolean
  correction?: string
  expectedResult?: string
  actualResult?: string
  category?: string
}

async function recordFeedback(feedback: CommandFeedback): Promise<void> {
  await supabase.from('javari_learning').insert({
    command_id: feedback.commandId,
    was_helpful: feedback.wasHelpful,
    correction: feedback.correction,
    expected_result: feedback.expectedResult,
    actual_result: feedback.actualResult,
    category: feedback.category,
    created_at: new Date().toISOString()
  })
  
  // Update command analytics
  if (feedback.wasHelpful) {
    await supabase.rpc('increment_success_count', { cmd_category: feedback.category })
  } else {
    await supabase.rpc('increment_failure_count', { cmd_category: feedback.category })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATTERN LEARNING
// ═══════════════════════════════════════════════════════════════════════════════

interface LearnedPattern {
  trigger: string
  category: string
  intent: string
  confidence: number
  successRate: number
}

async function learnPattern(
  userInput: string, 
  category: string, 
  intent: string,
  wasSuccessful: boolean
): Promise<void> {
  // Extract keywords from input
  const keywords = userInput.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3)
  
  for (const keyword of keywords) {
    // Check if pattern exists
    const { data: existing } = await supabase
      .from('javari_patterns')
      .select('*')
      .eq('trigger', keyword)
      .eq('category', category)
      .single()
    
    if (existing) {
      // Update existing pattern
      const newCount = (existing.usage_count || 0) + 1
      const successCount = (existing.success_count || 0) + (wasSuccessful ? 1 : 0)
      const successRate = successCount / newCount
      
      await supabase
        .from('javari_patterns')
        .update({
          usage_count: newCount,
          success_count: successCount,
          success_rate: successRate,
          confidence: Math.min(0.95, successRate * (newCount / 10)),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
    } else {
      // Create new pattern
      await supabase.from('javari_patterns').insert({
        trigger: keyword,
        category,
        intent,
        usage_count: 1,
        success_count: wasSuccessful ? 1 : 0,
        success_rate: wasSuccessful ? 1 : 0,
        confidence: 0.1,
        created_at: new Date().toISOString()
      })
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE BASE
// ═══════════════════════════════════════════════════════════════════════════════

interface KnowledgeEntry {
  topic: string
  content: string
  source: string
  confidence: number
}

async function addKnowledge(entry: KnowledgeEntry): Promise<void> {
  // Check for duplicates
  const { data: existing } = await supabase
    .from('javari_knowledge')
    .select('*')
    .eq('topic', entry.topic)
    .single()
  
  if (existing) {
    // Update with higher confidence version
    if (entry.confidence > (existing.confidence || 0)) {
      await supabase
        .from('javari_knowledge')
        .update({
          content: entry.content,
          source: entry.source,
          confidence: entry.confidence,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
    }
  } else {
    await supabase.from('javari_knowledge').insert({
      topic: entry.topic,
      content: entry.content,
      source: entry.source,
      confidence: entry.confidence,
      created_at: new Date().toISOString()
    })
  }
}

async function queryKnowledge(topic: string): Promise<KnowledgeEntry[]> {
  const { data } = await supabase
    .from('javari_knowledge')
    .select('*')
    .ilike('topic', `%${topic}%`)
    .order('confidence', { ascending: false })
    .limit(5)
  
  return data || []
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMPROVEMENT SUGGESTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function generateImprovementSuggestions(): Promise<any[]> {
  // Find low success rate patterns
  const { data: lowSuccess } = await supabase
    .from('javari_patterns')
    .select('*')
    .lt('success_rate', 0.5)
    .gt('usage_count', 5)
    .order('success_rate', { ascending: true })
    .limit(10)
  
  // Find frequently corrected commands
  const { data: corrections } = await supabase
    .from('javari_learning')
    .select('category, correction')
    .not('correction', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)
  
  const suggestions = []
  
  if (lowSuccess && lowSuccess.length > 0) {
    suggestions.push({
      type: 'low_success_patterns',
      priority: 'high',
      message: `${lowSuccess.length} patterns have less than 50% success rate`,
      details: lowSuccess.map(p => ({
        trigger: p.trigger,
        category: p.category,
        successRate: `${(p.success_rate * 100).toFixed(1)}%`,
        usageCount: p.usage_count
      }))
    })
  }
  
  if (corrections && corrections.length > 0) {
    const categoryCorrections: Record<string, number> = {}
    corrections.forEach(c => {
      categoryCorrections[c.category] = (categoryCorrections[c.category] || 0) + 1
    })
    
    suggestions.push({
      type: 'frequent_corrections',
      priority: 'medium',
      message: 'Categories with frequent corrections need attention',
      details: Object.entries(categoryCorrections)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, count]) => ({ category: cat, corrections: count }))
    })
  }
  
  return suggestions
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

async function getLearningStats(): Promise<any> {
  const [patterns, knowledge, feedback] = await Promise.all([
    supabase.from('javari_patterns').select('*', { count: 'exact', head: true }),
    supabase.from('javari_knowledge').select('*', { count: 'exact', head: true }),
    supabase.from('javari_learning').select('was_helpful')
  ])
  
  const helpfulCount = feedback.data?.filter(f => f.was_helpful).length || 0
  const totalFeedback = feedback.data?.length || 0
  
  return {
    totalPatterns: patterns.count || 0,
    knowledgeEntries: knowledge.count || 0,
    feedbackCount: totalFeedback,
    helpfulRate: totalFeedback > 0 ? (helpfulCount / totalFeedback * 100).toFixed(1) + '%' : 'N/A',
    timestamp: new Date().toISOString()
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body
    
    switch (action) {
      case 'feedback':
        await recordFeedback(data as CommandFeedback)
        return NextResponse.json({ 
          success: true, 
          message: 'Thank you! I\'ll use this to improve.' 
        })
      
      case 'learn_pattern':
        await learnPattern(
          data.userInput,
          data.category,
          data.intent,
          data.wasSuccessful
        )
        return NextResponse.json({ 
          success: true, 
          message: 'Pattern learned' 
        })
      
      case 'add_knowledge':
        await addKnowledge(data as KnowledgeEntry)
        return NextResponse.json({ 
          success: true, 
          message: 'Knowledge added' 
        })
      
      case 'query_knowledge':
        const knowledge = await queryKnowledge(data.topic)
        return NextResponse.json({ 
          success: true, 
          knowledge 
        })
      
      case 'suggestions':
        const suggestions = await generateImprovementSuggestions()
        return NextResponse.json({ 
          success: true, 
          suggestions 
        })
      
      case 'stats':
        const stats = await getLearningStats()
        return NextResponse.json({ 
          success: true, 
          stats 
        })
      
      default:
        return NextResponse.json({ 
          error: 'Unknown action' 
        }, { status: 400 })
    }
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Learning system error'
    }, { status: 500 })
  }
}

export async function GET() {
  const stats = await getLearningStats()
  const suggestions = await generateImprovementSuggestions()
  
  return NextResponse.json({
    service: 'Javari Learning System',
    version: '1.0.0',
    description: 'Autonomous learning and improvement for Javari AI',
    stats,
    pendingSuggestions: suggestions.length,
    capabilities: [
      'Feedback collection and analysis',
      'Pattern learning from user interactions',
      'Knowledge base management',
      'Self-improvement suggestions',
      'Success rate tracking'
    ],
    tables: [
      'javari_learning - Feedback and corrections',
      'javari_patterns - Learned command patterns',
      'javari_knowledge - Accumulated knowledge base'
    ],
    usage: {
      recordFeedback: 'POST { action: "feedback", data: { commandId, wasHelpful, correction } }',
      learnPattern: 'POST { action: "learn_pattern", data: { userInput, category, intent, wasSuccessful } }',
      addKnowledge: 'POST { action: "add_knowledge", data: { topic, content, source, confidence } }',
      getSuggestions: 'POST { action: "suggestions" }',
      getStats: 'POST { action: "stats" }'
    }
  })
}
