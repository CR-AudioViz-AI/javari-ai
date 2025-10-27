// ============================================================================
// ENHANCED API ROUTE: /api/javari/chat
// Handles AI chat with OpenAI GPT-4 + Function Calling
// Connects to real Javari AI backend APIs
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

interface ChatSession {
  id: string;
  projectId?: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system' | 'function'; content: string; name?: string }>;
  createdAt: string;
}

const sessions = new Map<string, ChatSession>();

// System prompt for Javari AI with function calling context
const SYSTEM_PROMPT = `You are Javari AI, an autonomous development assistant for CR AudioViz AI.

You have access to real-time data about projects, builds, and system health through function calls. When users ask about:
- Projects: Call list_projects or get_project_details
- Build failures: Call get_build_health or get_recent_failures
- Work logs: Call get_work_logs
- Creating projects: Call create_project

Always use your function calling capabilities to provide REAL data instead of generic responses.

Your personality:
- Professional but friendly
- Direct and action-oriented
- Proactive in offering help
- Detail-oriented but concise

When you receive function results, analyze them and provide clear, actionable insights.`;

// Define available functions for GPT-4 to call
const JAVARI_FUNCTIONS = [
  {
    name: 'list_projects',
    description: 'Get a list of all projects in the Javari AI system',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of projects to return (default: 10)'
        }
      }
    }
  },
  {
    name: 'get_project_details',
    description: 'Get detailed information about a specific project',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The UUID of the project to get details for'
        }
      },
      required: ['projectId']
    }
  },
  {
    name: 'get_build_health',
    description: 'Get build health status for a project',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The UUID of the project to check build health for'
        },
        limit: {
          type: 'number',
          description: 'Number of recent builds to return (default: 5)'
        }
      },
      required: ['projectId']
    }
  },
  {
    name: 'get_recent_failures',
    description: 'Get recent build failures across all projects or a specific project',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Optional: Filter by specific project UUID'
        },
        limit: {
          type: 'number',
          description: 'Number of failures to return (default: 10)'
        }
      }
    }
  },
  {
    name: 'get_work_logs',
    description: 'Get work logs for a specific chat session',
    parameters: {
      type: 'object',
      properties: {
        chatSessionId: {
          type: 'string',
          description: 'The UUID of the chat session to get work logs for'
        },
        limit: {
          type: 'number',
          description: 'Number of logs to return (default: 20)'
        }
      },
      required: ['chatSessionId']
    }
  },
  {
    name: 'create_project',
    description: 'Create a new project in Javari AI',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name of the project'
        },
        description: {
          type: 'string',
          description: 'A description of the project'
        },
        githubRepo: {
          type: 'string',
          description: 'GitHub repository URL (optional)'
        },
        vercelProject: {
          type: 'string',
          description: 'Vercel project ID (optional)'
        }
      },
      required: ['name']
    }
  }
];

// Execute function calls by calling actual Javari AI APIs
async function executeFunctionCall(functionName: string, args: any): Promise<any> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  try {
    switch (functionName) {
      case 'list_projects': {
        const limit = args.limit || 10;
        const response = await fetch(`${baseUrl}/api/projects?limit=${limit}`);
        const data = await response.json();
        return data.projects || data;
      }

      case 'get_project_details': {
        const response = await fetch(`${baseUrl}/api/projects?id=${args.projectId}`);
        const data = await response.json();
        return data.project || data;
      }

      case 'get_build_health': {
        const limit = args.limit || 5;
        const response = await fetch(`${baseUrl}/api/health?projectId=${args.projectId}&limit=${limit}`);
        const data = await response.json();
        return data.builds || data;
      }

      case 'get_recent_failures': {
        const limit = args.limit || 10;
        const params = new URLSearchParams({
          status: 'failed',
          limit: String(limit)
        });
        if (args.projectId) {
          params.append('projectId', args.projectId);
        }
        const response = await fetch(`${baseUrl}/api/health?${params}`);
        const data = await response.json();
        return data.builds || data;
      }

      case 'get_work_logs': {
        const limit = args.limit || 20;
        const response = await fetch(`${baseUrl}/api/work/log?chatSessionId=${args.chatSessionId}&limit=${limit}`);
        const data = await response.json();
        return data.logs || data;
      }

      case 'create_project': {
        const response = await fetch(`${baseUrl}/api/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: args.name,
            description: args.description,
            github_repo: args.githubRepo,
            vercel_project: args.vercelProject
          })
        });
        const data = await response.json();
        return data.project || data;
      }

      default:
        return { error: `Unknown function: ${functionName}` };
    }
  } catch (error) {
    console.error(`Error executing function ${functionName}:`, error);
    return { error: `Failed to execute ${functionName}: ${error}` };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sessionId, message, projectId } = body;

    // Initialize new chat session
    if (action === 'init') {
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      sessions.set(newSessionId, {
        id: newSessionId,
        projectId,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }],
        createdAt: new Date().toISOString()
      });

      // Store session in database
      try {
        const supabase = createServerClient();
        await supabase.from('javari_chat_sessions').insert({
          id: newSessionId,
          project_id: projectId || null,
          user_id: '00000000-0000-0000-0000-000000000000', // TODO: Get from auth
          title: 'New Chat Session',
          status: 'active'
        });
      } catch (dbError) {
        console.error('Failed to store session in DB:', dbError);
      }

      return NextResponse.json({ sessionId: newSessionId });
    }

    // Send message with function calling support
    if (action === 'message') {
      if (!sessionId || !message) {
        return NextResponse.json(
          { error: 'Session ID and message are required' },
          { status: 400 }
        );
      }

      let session = sessions.get(sessionId);
      if (!session) {
        session = {
          id: sessionId,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }],
          createdAt: new Date().toISOString()
        };
        sessions.set(sessionId, session);
      }

      // Add user message to history
      session.messages.push({ role: 'user', content: message });

      let functionCallLoop = 0;
      let finalResponse = '';

      // Function calling loop (allow up to 5 function calls)
      while (functionCallLoop < 5) {
        try {
          // Call OpenAI API with function calling
          const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: 'gpt-4',
              messages: session.messages,
              functions: JAVARI_FUNCTIONS,
              temperature: 0.7,
              max_tokens: 2000
            })
          });

          if (!openaiResponse.ok) {
            const error = await openaiResponse.text();
            console.error('OpenAI API error:', error);
            return NextResponse.json(
              { error: 'Failed to get response from AI' },
              { status: 500 }
            );
          }

          const data = await openaiResponse.json();
          const choice = data.choices[0];

          // Check if GPT wants to call a function
          if (choice.finish_reason === 'function_call' && choice.message.function_call) {
            const functionCall = choice.message.function_call;
            const functionName = functionCall.name;
            const functionArgs = JSON.parse(functionCall.arguments);

            console.log(`Executing function: ${functionName}`, functionArgs);

            // Execute the function
            const functionResult = await executeFunctionCall(functionName, functionArgs);

            // Add function call and result to message history
            session.messages.push({
              role: 'assistant',
              content: '',
              function_call: functionCall
            } as any);

            session.messages.push({
              role: 'function',
              name: functionName,
              content: JSON.stringify(functionResult)
            });

            functionCallLoop++;
            continue;
          }

          // Got final response
          finalResponse = choice.message.content;
          session.messages.push({ role: 'assistant', content: finalResponse });
          break;

        } catch (error) {
          console.error('Error in function calling loop:', error);
          return NextResponse.json(
            { error: 'Failed to process message' },
            { status: 500 }
          );
        }
      }

      // Limit message history
      if (session.messages.length > 21) {
        session.messages = [
          session.messages[0], // Keep system prompt
          ...session.messages.slice(-20)
        ];
      }

      // Update session in database
      try {
        const supabase = createServerClient();
        await supabase.from('javari_chat_sessions').update({
          message_count: session.messages.filter(m => m.role === 'user' || m.role === 'assistant').length,
          updated_at: new Date().toISOString()
        }).eq('id', sessionId);
      } catch (dbError) {
        console.error('Failed to update session in DB:', dbError);
      }

      return NextResponse.json({
        response: finalResponse
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID required' },
      { status: 400 }
    );
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    sessionId: session.id,
    messageCount: session.messages.filter(m => m.role === 'user' || m.role === 'assistant').length,
    createdAt: session.createdAt
  });
}
