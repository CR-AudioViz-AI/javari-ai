// Javari Learning System
// Autonomous knowledge acquisition from multiple sources

import { createClient } from '@supabase/supabase-js';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type LearningSource =
  | 'news'
  | 'documentation'
  | 'github'
  | 'conversation'
  | 'stackoverflow'
  | 'reddit';

export type KnowledgeCategory =
  | 'technical'
  | 'business'
  | 'industry'
  | 'tools'
  | 'best_practices';

interface LearningEntry {
  id?: string;
  source: LearningSource;
  category: KnowledgeCategory;
  title: string;
  content: string;
  url?: string;
  metadata: Record<string, any>;
  relevance_score: number;
  created_at?: string;
}

interface ConversationPattern {
  pattern_type: string;
  frequency: number;
  successful_resolutions: number;
  failed_resolutions: number;
  average_resolution_time: number;
  solution_template?: string;
}

/**
 * Ingest news from Google News and Reuters
 */
export async function ingestNews(): Promise<{ success: boolean; count: number }> {
  try {
    const sources = [
      { name: 'Google News Tech', rss: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB' },
      { name: 'Reuters Tech', rss: 'https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best' },
      { name: 'Hacker News', api: 'https://hacker-news.firebaseio.com/v0/topstories.json' },
    ];

    let totalIngested = 0;

    for (const source of sources) {
      try {
        let articles: any[] = [];

        if (source.rss) {
          // Fetch RSS feed
          const response = await fetch(source.rss);
          const text = await response.text();
          articles = parseRSSFeed(text);
        } else if (source.api) {
          // Fetch from API (Hacker News)
          articles = await fetchHackerNews();
        }

        // Filter and store relevant articles
        for (const article of articles.slice(0, 10)) { // Top 10 per source
          const relevanceScore = calculateRelevance(article.title, article.content);
          
          if (relevanceScore > 0.5) { // Only store relevant articles
            await storeKnowledge({
              source: 'news',
              category: determineCategory(article.title, article.content),
              title: article.title,
              content: article.content,
              url: article.url,
              metadata: {
                source_name: source.name,
                published_at: article.published_at,
              },
              relevance_score: relevanceScore,
            });
            totalIngested++;
          }
        }
      } catch (error: unknown) {
        console.error(`Error ingesting from ${source.name}:`, error);
      }
    }

    // Update last ingestion time
    await supabase
      .from('learning_sources')
      .upsert({
        source_type: 'news',
        last_ingestion: new Date().toISOString(),
        items_ingested: totalIngested,
      });

    return { success: true, count: totalIngested };
  } catch (error: unknown) {
    logError('Error in news ingestion:\', error);
    return { success: false, count: 0 };
  }
}

/**
 * Process and learn from uploaded documents
 */
export async function processDocument(
  fileUrl: string,
  fileType: string,
  userId: string
): Promise<{ success: boolean; insights: string[] }> {
  try {
    let content = '';

    // Extract text based on file type
    if (fileType === 'application/pdf') {
      content = await extractPDFText(fileUrl);
    } else if (fileType.includes('word')) {
      content = await extractDocxText(fileUrl);
    } else if (fileType === 'text/plain') {
      const response = await fetch(fileUrl);
      content = await response.text();
    }

    // Chunk content for analysis
    const chunks = chunkText(content, 1000);
    const insights: string[] = [];

    for (const chunk of chunks) {
      // Analyze chunk for key insights
      const analysis = await analyzeTextForInsights(chunk);
      
      if (analysis.relevanceScore > 0.6) {
        // Store in knowledge base
        await storeKnowledge({
          source: 'documentation',
          category: analysis.category,
          title: analysis.title,
          content: analysis.summary,
          metadata: {
            user_id: userId,
            file_url: fileUrl,
            file_type: fileType,
          },
          relevance_score: analysis.relevanceScore,
        });

        insights.push(analysis.insight);
      }
    }

    return { success: true, insights };
  } catch (error: unknown) {
    logError('Error processing document:\', error);
    return { success: false, insights: [] };
  }
}

/**
 * Monitor GitHub activity and learn from issues/PRs
 */
export async function monitorGitHub(repoUrl: string): Promise<{ success: boolean; learned: number }> {
  try {
    const [owner, repo] = extractGitHubRepo(repoUrl);
    let learned = 0;

    // Fetch recent issues
    const issues = await fetchGitHubIssues(owner, repo);
    
    for (const issue of issues) {
      // Look for issues with solutions
      if (issue.state === 'closed' && issue.comments > 0) {
        const comments = await fetchIssueComments(owner, repo, issue.number);
        const solution = extractSolution(comments);

        if (solution) {
          await storeKnowledge({
            source: 'github',
            category: 'technical',
            title: issue.title,
            content: solution,
            url: issue.html_url,
            metadata: {
              repo: `${owner}/${repo}`,
              issue_number: issue.number,
              labels: issue.labels,
            },
            relevance_score: 0.8,
          });
          learned++;
        }
      }
    }

    // Fetch recent merged PRs
    const prs = await fetchGitHubPRs(owner, repo);
    
    for (const pr of prs) {
      if (pr.merged_at) {
        // Learn from successful changes
        await storeKnowledge({
          source: 'github',
          category: 'best_practices',
          title: pr.title,
          content: pr.body || '',
          url: pr.html_url,
          metadata: {
            repo: `${owner}/${repo}`,
            pr_number: pr.number,
            files_changed: pr.changed_files,
          },
          relevance_score: 0.7,
        });
        learned++;
      }
    }

    return { success: true, learned };
  } catch (error: unknown) {
    logError('Error monitoring GitHub:\', error);
    return { success: false, learned: 0 };
  }
}

/**
 * Learn patterns from conversations
 */
export async function learnFromConversation(
  conversationId: string,
  messages: Array<{ role: string; content: string }>,
  wasSuccessful: boolean,
  resolutionTime: number
): Promise<void> {
  try {
    // Extract problem and solution
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');

    if (userMessages.length === 0 || assistantMessages.length === 0) return;

    // Identify the pattern
    const problemType = classifyProblem(userMessages[0].content);
    const solution = assistantMessages[assistantMessages.length - 1].content;

    // Check if we've seen this pattern before
    const { data: existingPattern } = await supabase
      .from('conversation_patterns')
      .select('*')
      .eq('pattern_type', problemType)
      .single();

    if (existingPattern) {
      // Update existing pattern
      await supabase
        .from('conversation_patterns')
        .update({
          frequency: existingPattern.frequency + 1,
          successful_resolutions: existingPattern.successful_resolutions + (wasSuccessful ? 1 : 0),
          failed_resolutions: existingPattern.failed_resolutions + (wasSuccessful ? 0 : 1),
          average_resolution_time: 
            (existingPattern.average_resolution_time * existingPattern.frequency + resolutionTime) / 
            (existingPattern.frequency + 1),
          updated_at: new Date().toISOString(),
        })
        .eq('pattern_type', problemType);
    } else {
      // Create new pattern
      await supabase
        .from('conversation_patterns')
        .insert({
          pattern_type: problemType,
          frequency: 1,
          successful_resolutions: wasSuccessful ? 1 : 0,
          failed_resolutions: wasSuccessful ? 0 : 1,
          average_resolution_time: resolutionTime,
          solution_template: wasSuccessful ? solution : null,
        });
    }

    // Store conversation as learning material if successful
    if (wasSuccessful) {
      await storeKnowledge({
        source: 'conversation',
        category: 'technical',
        title: `Solution: ${problemType}`,
        content: solution,
        metadata: {
          conversation_id: conversationId,
          problem_type: problemType,
          resolution_time: resolutionTime,
        },
        relevance_score: 0.9,
      });
    }
  } catch (error: unknown) {
    logError('Error learning from conversation:\', error);
  }
}

/**
 * Search knowledge base for similar problems
 */
export async function searchKnowledge(
  query: string,
  limit: number = 5
): Promise<LearningEntry[]> {
  try {
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('*')
      .textSearch('content', query)
      .order('relevance_score', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error: unknown) {
    logError('Error searching knowledge:\', error);
    return [];
  }
}

/**
 * Get conversation patterns for a problem type
 */
export async function getConversationPatterns(
  problemType?: string
): Promise<ConversationPattern[]> {
  try {
    let query = supabase
      .from('conversation_patterns')
      .select('*')
      .order('frequency', { ascending: false });

    if (problemType) {
      query = query.eq('pattern_type', problemType);
    }

    const { data, error } = await query.limit(10);

    if (error) throw error;
    return data || [];
  } catch (error: unknown) {
    logError('Error getting patterns:\', error);
    return [];
  }
}

// Helper functions
function parseRSSFeed(xml: string): any[] {
  // Simple RSS parser (in production, use a library)
  const articles: any[] = [];
  const itemRegex = /<item>(.*?)<\/item>/gs;
  const matches = xml.matchAll(itemRegex);

  for (const match of matches) {
    const item = match[1];
    const title = item.match(/<title>(.*?)<\/title>/)?.[1] || '';
    const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
    const description = item.match(/<description>(.*?)<\/description>/)?.[1] || '';
    
    articles.push({
      title,
      url: link,
      content: description,
      published_at: new Date().toISOString(),
    });
  }

  return articles;
}

async function fetchHackerNews(): Promise<any[]> {
  const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
  const storyIds = await response.json();
  
  const articles = [];
  for (const id of storyIds.slice(0, 10)) {
    const storyResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
    const story = await storyResponse.json();
    
    articles.push({
      title: story.title,
      url: story.url,
      content: story.title, // HN doesn't have descriptions
      published_at: new Date(story.time * 1000).toISOString(),
    });
  }

  return articles;
}

function calculateRelevance(title: string, content: string): number {
  const keywords = [
    'AI', 'machine learning', 'development', 'programming', 'software',
    'code', 'deployment', 'cloud', 'database', 'API', 'security',
    'performance', 'optimization', 'bug', 'fix', 'error', 'build',
  ];

  const text = (title + ' ' + content).toLowerCase();
  const matches = keywords.filter(keyword => text.includes(keyword.toLowerCase()));
  
  return Math.min(matches.length / 5, 1.0); // 5+ keywords = 100% relevance
}

function determineCategory(title: string, content: string): KnowledgeCategory {
  const text = (title + ' ' + content).toLowerCase();

  if (text.includes('business') || text.includes('market') || text.includes('revenue')) {
    return 'business';
  }
  if (text.includes('tool') || text.includes('library') || text.includes('framework')) {
    return 'tools';
  }
  if (text.includes('best practice') || text.includes('pattern') || text.includes('architecture')) {
    return 'best_practices';
  }
  if (text.includes('industry') || text.includes('trend') || text.includes('report')) {
    return 'industry';
  }

  return 'technical';
}

async function storeKnowledge(entry: LearningEntry): Promise<void> {
  try {
    await supabase
      .from('knowledge_base')
      .insert({
        source: entry.source,
        category: entry.category,
        title: entry.title,
        content: entry.content,
        url: entry.url,
        metadata: entry.metadata,
        relevance_score: entry.relevance_score,
      });
  } catch (error: unknown) {
    logError('Error storing knowledge:\', error);
  }
}

async function analyzeTextForInsights(text: string): Promise<any> {
  // In production, use AI to analyze text
  // For now, simple keyword matching
  const relevanceScore = calculateRelevance('', text);
  
  return {
    title: text.substring(0, 100),
    summary: text.substring(0, 500),
    category: determineCategory('', text),
    relevanceScore,
    insight: 'Extracted key information from document',
  };
}

function chunkText(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

function extractGitHubRepo(url: string): [string, string] {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  return match ? [match[1], match[2]] : ['', ''];
}

async function fetchGitHubIssues(owner: string, repo: string): Promise<any[]> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues?state=closed&per_page=10`,
    { headers: { 'Accept': 'application/vnd.github.v3+json' } }
  );
  return response.json();
}

async function fetchIssueComments(owner: string, repo: string, issueNumber: number): Promise<any[]> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    { headers: { 'Accept': 'application/vnd.github.v3+json' } }
  );
  return response.json();
}

function extractSolution(comments: any[]): string | null {
  // Look for comments that indicate a solution
  for (const comment of comments) {
    const body = comment.body.toLowerCase();
    if (body.includes('solved') || body.includes('fixed') || body.includes('solution')) {
      return comment.body;
    }
  }
  return null;
}

async function fetchGitHubPRs(owner: string, repo: string): Promise<any[]> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&per_page=10`,
    { headers: { 'Accept': 'application/vnd.github.v3+json' } }
  );
  return response.json();
}

function classifyProblem(content: string): string {
  const text = content.toLowerCase();

  if (text.includes('deploy') || text.includes('deployment')) return 'deployment_issue';
  if (text.includes('build') || text.includes('compile')) return 'build_error';
  if (text.includes('database') || text.includes('sql')) return 'database_issue';
  if (text.includes('api') || text.includes('endpoint')) return 'api_issue';
  if (text.includes('performance') || text.includes('slow')) return 'performance_issue';
  if (text.includes('bug') || text.includes('error')) return 'bug_fix';
  if (text.includes('feature') || text.includes('implement')) return 'feature_request';

  return 'general_question';
}

async function extractPDFText(url: string): Promise<string> {
  // In production, use a PDF parsing library
  return 'PDF content placeholder';
}

async function extractDocxText(url: string): Promise<string> {
  // In production, use a DOCX parsing library
  return 'DOCX content placeholder';
}
