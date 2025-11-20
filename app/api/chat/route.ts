import { NextRequest, NextResponse } from 'next/server'
import { ProviderManager, type ChatMessage, type ProviderName } from '@/lib/provider-manager'
import { routeTask, type TaskType, type AIProvider } from '@/lib/ai-routing'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { safeAsync } from '@/lib/error-handler'
import { isDefined } from '@/lib/typescript-helpers'
import { JAVARI_SYSTEM_PROMPT } from '@/lib/javari-system-prompt'

export const runtime = 'edge'
export const maxDuration = 300

interface ChatRequestBody {
  messages?: ChatMessage[]
  aiProvider?: string
  taskType?: TaskType
  prioritizeCost?: boolean
}

/**
 * JAVARI AI - AUTONOMOUS MULTI-PROVIDER CHAT ENDPOINT
 * 
 * Features:
 * - Intelligent routing to 4 AI providers (OpenAI, Claude, Gemini, Mistral)
 * - Streaming responses for all providers
 * - Automatic fallback on provider failure
 * - Cost optimization and tracking
 * - Performance monitoring
 * 
 * Created: November 19, 2025 - 4:05 PM EST
 * Part of Javari Autonomous System Integration
 */
export async function POST(req: NextRequest) {
  return await safeAsync(
    async () => {
      const startTime = Date.now()
      
      // Parse request
      const body = await req.json() as ChatRequestBody
      const messages = body.messages
      const userProvider = body.aiProvider
      const taskType = (body.taskType || 'chat') as TaskType
      const prioritizeCost = body.prioritizeCost || false

      // Validate messages
      if (!isDefined(messages) || !Array.isArray(messages) || messages.length === 0) {
        return NextResponse.json(
          { error: 'Messages array is required' },
          { status: 400 }
        )
      }

      // Get current time for context
      const now = new Date()
      const currentDateTime = now.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/New_York'
      })

      // Add Javari system prompt with time awareness
      const systemMessage: ChatMessage = {
        role: 'system',
        content: `${JAVARI_SYSTEM_PROMPT}

## CURRENT DATE & TIME AWARENESS

**Current Date & Time:** ${currentDateTime} EST
**User Location:** Fort Myers, Florida (Eastern Time Zone)

You ALWAYS know the current date and time. Use this information when answering time-related questions.

NEVER say "I'm unable to provide real-time updates" or "I don't have access to current time." You DO have this information!`
      }

      const fullMessages = [systemMessage, ...messages]

      // Estimate tokens
      const totalChars = fullMessages.reduce((sum, msg) => sum + msg.content.length, 0)
      const estimatedTokens = Math.ceil(totalChars / 4)

      // Determine provider using intelligent routing
      let selectedProvider: ProviderName
      let routingReason: string

      if (userProvider && ['openai', 'claude', 'gemini', 'mistral'].includes(userProvider)) {
        selectedProvider = userProvider as ProviderName
        routingReason = 'User-specified provider'
      } else {
        const routing = routeTask(
          taskType,
          estimatedTokens,
          userProvider as AIProvider | undefined,
          prioritizeCost
        )
        selectedProvider = mapProviderToName(routing.provider)
        routingReason = routing.reasoning
      }

      // Select model
      const modelMap: Record<ProviderName, string> = {
        'openai': 'gpt-4-turbo-preview',
        'claude': 'claude-sonnet-4-20250514',
        'gemini': 'gemini-1.5-flash',
        'mistral': 'mistral-large-latest'
      }

      const model = modelMap[selectedProvider]

      // Initialize provider manager
      const providerManager = new ProviderManager()

      // Create streaming response
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Send provider info
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ 
                  type: 'provider', 
                  provider: selectedProvider,
                  model,
                  reason: routingReason
                })}\n\n`
              )
            )

            // Stream the response
            const streamGenerator = providerManager.chatStream({
              provider: selectedProvider,
              model,
              messages: fullMessages,
              temperature: 0.7,
              maxTokens: 4000,
              stream: true
            })

            let totalChunks = 0
            let fullResponse = ''

            for await (const chunk of streamGenerator) {
              if (chunk.text) {
                fullResponse += chunk.text
                totalChunks++
                
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ 
                      type: 'text', 
                      text: chunk.text 
                    })}\n\n`
                  )
                )
              }

              if (chunk.done) {
                // Send final metadata
                const latency = Date.now() - startTime
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'metadata',
                      chunks: totalChunks,
                      latency,
                      provider: selectedProvider,
                      model
                    })}\n\n`
                  )
                )
              }
            }

            // Send completion signal
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()

          } catch (error: unknown) {
            console.error('Stream error:', error)
            
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ 
                  type: 'error', 
                  error: getErrorMessage(error)
                })}\n\n`
              )
            )
            
            controller.close()
          }
        }
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      })
    },
    { file: 'chat/route.ts', function: 'POST' },
    NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  ) || NextResponse.json(
    { error: 'Unexpected error' },
    { status: 500 }
  )
}

/**
 * Map AI routing provider names to ProviderManager names
 */
function mapProviderToName(provider: AIProvider): ProviderName {
  const mapping: Record<string, ProviderName> = {
    'gpt-4': 'openai',
    'claude': 'claude',
    'gemini': 'gemini',
    'mistral': 'mistral'
  }
  return mapping[provider] || 'openai'
}
