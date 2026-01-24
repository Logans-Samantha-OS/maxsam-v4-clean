import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

/**
 * ALEX NotebookLM Query API
 *
 * POST /api/alex/notebook-query
 *
 * Queries the ALEX Knowledge Base (powered by the alex-knowledge MCP)
 * with caching to reduce API calls and improve response time.
 *
 * Request Body:
 * - notebook: string (optional) - Notebook name for categorization (e.g., "TX_Dallas_County_Playbook")
 * - question: string (required) - The question to ask
 * - bypass_cache: boolean (optional) - Force fresh query, ignore cache
 * - max_results: number (optional) - Maximum results to return (default 5)
 *
 * Response:
 * - answer: string - The answer from the knowledge base
 * - sources: array - Source documents used in the answer
 * - cached: boolean - Whether this response came from cache
 * - cache_key: string - The cache key used
 */

// ALEX Knowledge Base API URL (MCP server endpoint)
const ALEX_KNOWLEDGE_API = process.env.ALEX_KNOWLEDGE_API_URL || 'http://localhost:3100';

interface NotebookQueryRequest {
  notebook?: string;
  question: string;
  bypass_cache?: boolean;
  max_results?: number;
  similarity_threshold?: number;
}

interface KnowledgeResult {
  content: string;
  source_name: string;
  source_type: string;
  similarity: number;
}

interface NotebookQueryResponse {
  answer: string;
  sources: Array<{
    name: string;
    type: string;
    relevance: number;
  }>;
  cached: boolean;
  cache_key: string;
  timestamp: string;
}

/**
 * Generate a hash for the question to use as cache key
 */
function hashQuestion(question: string): string {
  // Normalize the question: lowercase, trim, collapse whitespace
  const normalized = question.toLowerCase().trim().replace(/\s+/g, ' ');
  return crypto.createHash('md5').update(normalized).digest('hex');
}

/**
 * Query the ALEX Knowledge Base MCP server
 */
async function queryAlexKnowledge(
  question: string,
  maxResults: number = 5,
  similarityThreshold: number = 0.7
): Promise<{ answer: string; sources: KnowledgeResult[] }> {
  try {
    // Call the ALEX Knowledge MCP API
    const response = await fetch(`${ALEX_KNOWLEDGE_API}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        max_results: maxResults,
        similarity_threshold: similarityThreshold,
      }),
    });

    if (!response.ok) {
      throw new Error(`ALEX Knowledge API error: ${response.status}`);
    }

    const data = await response.json();

    // Format the response
    const sources = data.results || [];

    // Combine the top results into an answer
    const answer = sources.length > 0
      ? sources.map((s: KnowledgeResult) => s.content).join('\n\n---\n\n')
      : 'No relevant information found in the knowledge base.';

    return { answer, sources };
  } catch (error) {
    console.error('ALEX Knowledge query error:', error);

    // Fallback: Return a helpful error message
    return {
      answer: `Unable to query ALEX Knowledge Base. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      sources: [],
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: NotebookQueryRequest = await request.json();

    // Validate request
    if (!body.question || typeof body.question !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: question' },
        { status: 400 }
      );
    }

    const notebook = body.notebook || 'default';
    const question = body.question.trim();
    const bypassCache = body.bypass_cache || false;
    const maxResults = body.max_results || 5;
    const similarityThreshold = body.similarity_threshold || 0.7;

    const questionHash = hashQuestion(question);
    const cacheKey = `${notebook}:${questionHash}`;

    const supabase = createClient();

    // Check cache first (unless bypass requested)
    if (!bypassCache) {
      const { data: cached } = await supabase
        .from('notebook_cache')
        .select('*')
        .eq('notebook_name', notebook)
        .eq('question_hash', questionHash)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (cached) {
        // Update hit count
        await supabase
          .from('notebook_cache')
          .update({
            hit_count: (cached.hit_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', cached.id);

        const response: NotebookQueryResponse = {
          answer: cached.answer || '',
          sources: cached.sources || [],
          cached: true,
          cache_key: cacheKey,
          timestamp: cached.created_at,
        };

        return NextResponse.json(response);
      }
    }

    // Query the ALEX Knowledge Base
    const { answer, sources } = await queryAlexKnowledge(
      question,
      maxResults,
      similarityThreshold
    );

    // Format sources for storage
    const formattedSources = sources.map((s: KnowledgeResult) => ({
      name: s.source_name,
      type: s.source_type,
      relevance: s.similarity,
    }));

    // Cache the result (upsert to handle race conditions)
    const { error: cacheError } = await supabase
      .from('notebook_cache')
      .upsert({
        notebook_name: notebook,
        question_hash: questionHash,
        question: question,
        answer: answer,
        sources: formattedSources,
        hit_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      }, {
        onConflict: 'notebook_name,question_hash',
      });

    if (cacheError) {
      console.warn('Failed to cache notebook query:', cacheError);
      // Don't fail the request just because caching failed
    }

    const response: NotebookQueryResponse = {
      answer,
      sources: formattedSources,
      cached: false,
      cache_key: cacheKey,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Notebook query error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/alex/notebook-query
 *
 * Returns cache statistics and available notebooks
 */
export async function GET() {
  try {
    const supabase = createClient();

    // Get cache statistics
    const { data: stats } = await supabase
      .from('notebook_cache')
      .select('notebook_name, hit_count, created_at')
      .order('created_at', { ascending: false });

    // Group by notebook
    const notebooks: Record<string, { entries: number; total_hits: number }> = {};

    (stats || []).forEach((entry) => {
      const name = entry.notebook_name;
      if (!notebooks[name]) {
        notebooks[name] = { entries: 0, total_hits: 0 };
      }
      notebooks[name].entries++;
      notebooks[name].total_hits += entry.hit_count || 0;
    });

    return NextResponse.json({
      cache_stats: {
        total_entries: stats?.length || 0,
        notebooks,
      },
      usage: {
        endpoint: 'POST /api/alex/notebook-query',
        body: {
          notebook: 'string (optional) - Notebook name for categorization',
          question: 'string (required) - The question to ask',
          bypass_cache: 'boolean (optional) - Force fresh query',
          max_results: 'number (optional) - Max results (default 5)',
        },
        example: {
          notebook: 'TX_Dallas_County_Playbook',
          question: 'What is the excess funds URL for Dallas County?',
        },
      },
    });

  } catch (error) {
    console.error('Notebook query stats error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
