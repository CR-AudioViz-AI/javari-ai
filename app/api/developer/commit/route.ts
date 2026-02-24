import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = 'CR-AudioViz-AI/javari-ai'; // Update if needed

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { fileName, code, message } = await request.json();

    if (!fileName || !code || !message) {
      return NextResponse.json(
        { error: 'fileName, code, and message are required' },
        { status: 400 }
      );
    }

    if (!GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN not configured');
    }

    // Encode code to base64
    const encodedContent = Buffer.from(code).toString('base64');

    // Check if file exists (to get SHA for update)
    const checkResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${fileName}`,
      {
        method: 'GET',
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    let sha: string | undefined;
    if (checkResponse.ok) {
      const existingFile = await checkResponse.json();
      sha = existingFile.sha;
    }

    // Create or update file
    const commitBody = {
      message,
      content: encodedContent,
      branch: 'main',
      ...(sha && { sha }), // Include SHA if updating existing file
    };

    const commitResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${fileName}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commitBody),
      }
    );

    if (!commitResponse.ok) {
      const errorData = await commitResponse.json();
      throw new Error(`GitHub API error: ${errorData.message || 'Unknown error'}`);
    }

    const commitData = await commitResponse.json();

    // Store in database
    await supabase.from('developer_files').insert({
      file_name: fileName,
      file_path: fileName,
      commit_sha: commitData.commit.sha,
      commit_url: commitData.commit.html_url,
      status: 'committed',
    });

    // Update generation record
    await supabase
      .from('developer_generations')
      .update({
        status: 'committed',
        commit_sha: commitData.commit.sha,
        commit_url: commitData.commit.html_url,
      })
      .eq('file_name', fileName)
      .order('created_at', { ascending: false })
      .limit(1);

    return NextResponse.json({
      success: true,
      commitUrl: commitData.commit.html_url,
      sha: commitData.commit.sha,
      message: sha ? 'File updated successfully' : 'File created successfully',
    });
  } catch (error: unknown) {
    logError('GitHub commit error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log error to database
    await supabase.from('developer_learning_log').insert({
      event_type: 'commit_error',
      description: `Failed to commit: ${errorMessage}`,
      metadata: { fileName: (await request.json()).fileName },
      success: false,
    });

    return NextResponse.json(
      {
        error: 'Failed to commit to GitHub',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
