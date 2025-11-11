import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import OpenAI from 'openai';
import type { ApiResponse } from '@/types/javari';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/sessions/[id]/generate-summary
 * 
 * Generate an AI-powered summary for a session including:
 * - Overall summary of what was accomplished
 * - Key accomplishments list
 * - Recommended next steps
 * - Identified blockers
 * - Recommendations for improvement
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const sessionId = params.id;

    // Get conversation data
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Conversation not found',
      }, { status: 404 });
    }

    // Get work logs for this session
    const { data: workLogs } = await supabase
      .from('work_logs')
      .select('*')
      .eq('conversation_id', sessionId)
      .order('created_at', { ascending: true });

    // Get project info if available
    let projectInfo = '';
    if (conversation.project_id) {
      const { data: project } = await supabase
        .from('projects')
        .select('name, description')
        .eq('id', conversation.project_id)
        .single();
      
      if (project) {
        projectInfo = `\nProject: ${project.name}${project.description ? ` - ${project.description}` : ''}`;
      }
    }

    // Prepare context for AI
    const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
    const messageCount = messages.length;
    
    // Extract user messages for context
    const userMessages = messages
      .filter((m: any) => m.role === 'user')
      .map((m: any) => m.content)
      .slice(0, 20); // Limit to first 20 messages

    // Summarize work logs
    const workSummary = {
      files_created: workLogs?.filter(l => l.action_type === 'file_created').length || 0,
      files_modified: workLogs?.filter(l => l.action_type === 'file_modified').length || 0,
      files_deleted: workLogs?.filter(l => l.action_type === 'file_deleted').length || 0,
      apis_created: workLogs?.filter(l => l.action_type === 'api_created').length || 0,
      tests_written: workLogs?.filter(l => l.action_type === 'test_written').length || 0,
      bugs_fixed: workLogs?.filter(l => l.action_type === 'bug_fixed').length || 0,
      lines_added: workLogs?.reduce((sum, l) => sum + (l.lines_added || 0), 0) || 0,
      lines_deleted: workLogs?.reduce((sum, l) => sum + (l.lines_deleted || 0), 0) || 0,
    };

    // Calculate session duration
    const startTime = new Date(conversation.created_at);
    const endTime = conversation.status === 'active' ? new Date() : new Date(conversation.updated_at);
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

    // Create prompt for AI
    const prompt = `You are Javari AI, an autonomous development assistant. Analyze this development session and provide insights.${projectInfo}

Session Details:
- Duration: ${durationMinutes} minutes
- Messages exchanged: ${messageCount}
- Conversation title: ${conversation.title || 'Untitled'}

Work Accomplished:
- Files created: ${workSummary.files_created}
- Files modified: ${workSummary.files_modified}
- Files deleted: ${workSummary.files_deleted}
- Lines added: ${workSummary.lines_added}
- Lines deleted: ${workSummary.lines_deleted}
- APIs created: ${workSummary.apis_created}
- Tests written: ${workSummary.tests_written}
- Bugs fixed: ${workSummary.bugs_fixed}

Recent user queries/topics:
${userMessages.map((msg, i) => `${i + 1}. ${msg.substring(0, 200)}${msg.length > 200 ? '...' : ''}`).join('\n')}

Please provide a comprehensive session summary in the following JSON format:
{
  "summary": "A 2-3 sentence overview of what was accomplished in this session",
  "key_accomplishments": [
    "Specific accomplishment 1",
    "Specific accomplishment 2",
    "Specific accomplishment 3"
  ],
  "next_steps": [
    "Recommended next step 1",
    "Recommended next step 2",
    "Recommended next step 3"
  ],
  "blockers": [
    "Any identified blocker or challenge"
  ],
  "recommendations": [
    "Recommendation for improvement 1",
    "Recommendation for improvement 2"
  ]
}

Focus on:
1. Concrete accomplishments based on the work logs
2. Realistic next steps that build on what was done
3. Actual blockers mentioned in conversations
4. Actionable recommendations

Keep all items concise and specific. Return ONLY valid JSON, no additional text.`;

    // Call OpenAI to generate summary
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are Javari AI, an expert at analyzing development sessions and providing actionable insights. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    
    // Parse AI response
    let aiInsights;
    try {
      // Remove markdown code blocks if present
      const cleanJson = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      aiInsights = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText);
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Failed to generate AI summary',
      }, { status: 500 });
    }

    // Update conversation with AI insights
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        metadata: {
          ...conversation.metadata,
          ai_summary: aiInsights.summary,
          key_accomplishments: aiInsights.key_accomplishments || [],
          next_steps: aiInsights.next_steps || [],
          blockers: aiInsights.blockers || [],
          recommendations: aiInsights.recommendations || [],
          summary_generated_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Failed to save AI insights:', updateError);
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Failed to save AI summary',
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<typeof aiInsights>>({
      success: true,
      data: aiInsights,
    });

  } catch (error: unknown) {
    logError('Generate summary error:\', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
