import { NextRequest, NextResponse } from 'next/server'
import { SelfHealingSystem } from '@/lib/autonomous/self-healing'
import { AutonomousGitHub } from '@/lib/autonomous/autonomous-github'
import { AutonomousVercel } from '@/lib/autonomous/autonomous-deploy'
import { createClient } from '@/lib/supabase/server'

/**
 * JAVARI AI - SELF-HEALING CRON JOB
 * 
 * Runs every 5 minutes to:
 * - Detect Vercel build failures
 * - Diagnose errors using AI
 * - Automatically fix simple issues
 * - Notify for complex issues
 * 
 * Created: November 19, 2025 - 4:15 PM EST
 * Part of Javari Autonomous System
 */

export const runtime = 'edge'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const supabase = createClient()

  try {
    console.log('🔍 Self-healing cron: Starting error detection...')

    // Initialize autonomous systems
    const github = new AutonomousGitHub({
      token: process.env.GITHUB_TOKEN!,
      org: 'CR-AudioViz-AI',
      repo: 'crav-javari'
    })

    const vercel = new AutonomousVercel({
      token: process.env.VERCEL_TOKEN!,
      teamId: process.env.VERCEL_TEAM_ID!,
      projectId: process.env.VERCEL_PROJECT_ID || 'prj_crav-javari'
    })

    const selfHealing = new SelfHealingSystem({
      github,
      vercel,
      openaiApiKey: process.env.OPENAI_API_KEY!,
      autoFixThreshold: 80 // Auto-fix if confidence >= 80%
    })

    // Detect errors
    const errors = await selfHealing.detectErrors()
    console.log(`Found ${errors.length} potential errors`)

    if (errors.length === 0) {
      // Log successful run
      await supabase.from('javari_healing_history').insert({
        status: 'no_errors',
        errors_found: 0,
        errors_fixed: 0,
        run_time_ms: Date.now() - startTime,
        triggered_at: new Date().toISOString()
      })

      return NextResponse.json({
        success: true,
        message: 'No errors detected',
        errors_found: 0,
        runtime_ms: Date.now() - startTime
      })
    }

    // Process each error
    const results = []
    let fixed = 0
    let failed = 0

    for (const error of errors) {
      console.log(`Diagnosing error: ${error.message}`)

      // Diagnose the error
      const diagnosis = await selfHealing.diagnoseError(error)
      console.log(`Diagnosis confidence: ${diagnosis.confidence}%`)

      // Attempt auto-fix if confidence is high enough
      if (diagnosis.confidence >= 80 && diagnosis.autoFixable) {
        console.log('Attempting auto-fix...')
        const fixResult = await selfHealing.attemptFix(error, diagnosis)
        
        if (fixResult.success) {
          fixed++
          console.log(`✅ Auto-fixed: ${error.message}`)
        } else {
          failed++
          console.log(`❌ Auto-fix failed: ${fixResult.error}`)
        }

        results.push({
          error: error.message,
          diagnosis: diagnosis.rootCause,
          confidence: diagnosis.confidence,
          auto_fixed: fixResult.success,
          commit_sha: fixResult.commitSha
        })
      } else {
        // Log for manual intervention
        console.log(`⚠️  Manual intervention needed (confidence: ${diagnosis.confidence}%)`)
        
        await supabase.from('javari_manual_review').insert({
          error_type: error.type,
          error_message: error.message,
          diagnosis: diagnosis.rootCause,
          confidence: diagnosis.confidence,
          fix_strategy: diagnosis.fixStrategy,
          requires_manual_review: true,
          created_at: new Date().toISOString()
        })

        results.push({
          error: error.message,
          diagnosis: diagnosis.rootCause,
          confidence: diagnosis.confidence,
          requires_manual_review: true
        })
      }
    }

    // Log healing run
    await supabase.from('javari_healing_history').insert({
      status: fixed > 0 ? 'fixed' : 'detected',
      errors_found: errors.length,
      errors_fixed: fixed,
      errors_failed: failed,
      run_time_ms: Date.now() - startTime,
      triggered_at: new Date().toISOString(),
      results: JSON.stringify(results)
    })

    return NextResponse.json({
      success: true,
      errors_found: errors.length,
      errors_fixed: fixed,
      errors_failed: failed,
      requires_manual_review: failed > 0,
      runtime_ms: Date.now() - startTime,
      results
    })

  } catch (error) {
    console.error('Self-healing cron error:', error)

    // Log failure
    await supabase.from('javari_healing_history').insert({
      status: 'failed',
      errors_found: 0,
      errors_fixed: 0,
      run_time_ms: Date.now() - startTime,
      triggered_at: new Date().toISOString(),
      error_message: error instanceof Error ? error.message : 'Unknown error'
    })

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      runtime_ms: Date.now() - startTime
    }, { status: 500 })
  }
}
