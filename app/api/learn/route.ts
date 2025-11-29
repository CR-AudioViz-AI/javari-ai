// app/api/learn/route.ts
// Javari AI Learning API - Endpoint for saving learnings from conversations
// Timestamp: 2025-11-29 14:55 UTC

import { NextRequest, NextResponse } from 'next/server';
import { learnFromConversation, addKnowledge, getKnowledgeStats } from '@/lib/javari-learning';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'learn_from_conversation': {
        const { conversationId, userMessage, assistantResponse, wasHelpful, feedbackScore, solutionWorked } = body;

        if (!userMessage || !assistantResponse) {
          return NextResponse.json(
            { error: 'Missing required fields: userMessage and assistantResponse' },
            { status: 400 }
          );
        }

        const result = await learnFromConversation({
          conversationId: conversationId || `conv_${Date.now()}`,
          userMessage,
          assistantResponse,
          wasHelpful: wasHelpful ?? true,
          feedbackScore,
          solutionWorked: solutionWorked ?? true
        });

        return NextResponse.json(result);
      }

      case 'add_knowledge': {
        const { topic, subtopic, concept, explanation, skill_level, examples, best_practices, common_mistakes, tags, keywords, verified } = body;

        if (!topic || !concept || !explanation) {
          return NextResponse.json(
            { error: 'Missing required fields: topic, concept, and explanation' },
            { status: 400 }
          );
        }

        const result = await addKnowledge({
          topic,
          subtopic: subtopic || topic,
          skill_level: skill_level || 'intermediate',
          concept,
          explanation,
          examples: examples || [],
          best_practices: best_practices || [],
          common_mistakes: common_mistakes || [],
          tags: tags || [],
          keywords: keywords || [],
          verified: verified ?? false,
          verified_by: verified ? 'api' : 'unverified'
        });

        return NextResponse.json(result);
      }

      case 'get_stats': {
        const stats = await getKnowledgeStats();
        return NextResponse.json({ success: true, stats });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid actions: learn_from_conversation, add_knowledge, get_stats` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Learning API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const stats = await getKnowledgeStats();
    return NextResponse.json({
      success: true,
      message: 'Javari Learning API',
      stats,
      endpoints: {
        'POST /api/learn': {
          actions: {
            learn_from_conversation: {
              description: 'Extract and save knowledge from a conversation',
              required: ['userMessage', 'assistantResponse'],
              optional: ['conversationId', 'wasHelpful', 'feedbackScore', 'solutionWorked']
            },
            add_knowledge: {
              description: 'Manually add knowledge entry',
              required: ['topic', 'concept', 'explanation'],
              optional: ['subtopic', 'skill_level', 'examples', 'best_practices', 'common_mistakes', 'tags', 'keywords', 'verified']
            },
            get_stats: {
              description: 'Get knowledge base statistics'
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Learning API GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get stats' },
      { status: 500 }
    );
  }
}
