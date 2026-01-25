import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';
import {
  formatCountyQuestion,
  getCountyRoutingInfo,
  listSupportedCounties,
  COUNTY_TO_NOTEBOOK,
  DEFAULT_NOTEBOOK,
} from '@/lib/alex/notebook-routing';

/**
 * ALEX NotebookLM Query API
 *
 * POST /api/alex/notebook-query
 *
 * Queries the ALEX Knowledge Base (powered by the alex-knowledge MCP)
 * with caching and automatic county-based notebook routing.
 *
 * Request Body:
 * - county: string (optional) - County name for automatic notebook routing
 * - notebook: string (optional) - Direct notebook name (overrides county routing)
 * - question: string (required) - The question to ask
 * - bypass_cache: boolean (optional) - Force fresh query, ignore cache
 * - max_results: number (optional) - Maximum results to return (default 5)
 *
 * Response:
 * - answer: string - The answer from the knowledge base
 * - sources: array - Source documents used in the answer
 * - cached: boolean - Whether this response came from cache
 * - cache_key: string - The cache key used
 * - routing: object - Notebook routing info (county, notebook, region)
 */

interface NotebookQueryRequest {
  county?: string;
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
  routing: {
    county: string | null;
    notebook: string;
    region: string;
    used_default: boolean;
  };
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
 * Query the ALEX Knowledge Base via Supabase
 * Uses PostgreSQL full-text search for fast, relevant results
 */
async function queryAlexKnowledge(
  supabase: ReturnType<typeof createClient>,
  question: string,
  maxResults: number = 5
): Promise<{ answer: string; sources: KnowledgeResult[] }> {
  try {
    // Use the search_knowledge_text function in Supabase (full-text search)
    const { data, error } = await supabase.rpc('search_knowledge_text', {
      search_query: question,
      max_results: maxResults,
    });

    if (error) {
      console.error('Supabase search error:', error);
      throw new Error(`Knowledge search failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return {
        answer: 'No relevant information found in the knowledge base.',
        sources: [],
      };
    }

    // Format the response
    const sources: KnowledgeResult[] = data.map((row: {
      content: string;
      source_name: string;
      source_type: string;
      rank: number;
    }) => ({
      content: row.content,
      source_name: row.source_name,
      source_type: row.source_type,
      similarity: row.rank,
    }));

    // Combine the top results into an answer
    const answer = sources
      .map((s) => s.content)
      .join('\n\n---\n\n');

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

/**
 * Update notebook routing statistics
 */
async function updateRoutingStats(
  supabase: ReturnType<typeof createClient>,
  county: string,
  notebook: string
) {
  try {
    // Upsert the routing record with updated query count
    await supabase.from('notebook_routing').upsert(
      {
        county: county,
        notebook_name: notebook,
        last_queried_at: new Date().toISOString(),
        query_count: 1, // Will be incremented by trigger or manual update
      },
      {
        onConflict: 'county',
      }
    );

    // Increment the query count
    await supabase.rpc('increment_notebook_routing_count', { p_county: county });
  } catch (error) {
    // Don't fail the request if stats update fails
    console.warn('Failed to update routing stats:', error);
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

    const county = body.county?.trim() || null;
    const bypassCache = body.bypass_cache || false;
    const maxResults = body.max_results || 5;

    // Determine notebook: explicit notebook > county routing > default
    let notebook: string;
    let routingInfo: ReturnType<typeof getCountyRoutingInfo>;

    if (body.notebook) {
      // Explicit notebook provided
      notebook = body.notebook;
      routingInfo = {
        county: county || 'N/A',
        notebook: body.notebook,
        region: 'Custom',
        isDefault: false,
      };
    } else if (county) {
      // Route based on county
      routingInfo = getCountyRoutingInfo(county);
      notebook = routingInfo.notebook;
    } else {
      // Use default
      notebook = DEFAULT_NOTEBOOK;
      routingInfo = {
        county: 'N/A',
        notebook: DEFAULT_NOTEBOOK,
        region: 'Default',
        isDefault: true,
      };
    }

    // Format the question with county context if needed
    let question = body.question.trim();
    if (county) {
      question = formatCountyQuestion(county, question);
    }

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

        // Update routing stats
        if (county) {
          await updateRoutingStats(supabase, county, notebook);
        }

        const response: NotebookQueryResponse = {
          answer: cached.answer || '',
          sources: cached.sources || [],
          cached: true,
          cache_key: cacheKey,
          timestamp: cached.created_at,
          routing: {
            county: county,
            notebook: notebook,
            region: routingInfo.region,
            used_default: routingInfo.isDefault,
          },
        };

        return NextResponse.json(response);
      }
    }

    // Query the ALEX Knowledge Base
    console.log(`[ALEX] Querying notebook "${notebook}" for county "${county || 'N/A'}"`);
    console.log(`[ALEX] Question: ${question}`);

    const { answer, sources } = await queryAlexKnowledge(
      supabase,
      question,
      maxResults
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

    // Update routing stats
    if (county) {
      await updateRoutingStats(supabase, county, notebook);
    }

    const response: NotebookQueryResponse = {
      answer,
      sources: formattedSources,
      cached: false,
      cache_key: cacheKey,
      timestamp: new Date().toISOString(),
      routing: {
        county: county,
        notebook: notebook,
        region: routingInfo.region,
        used_default: routingInfo.isDefault,
      },
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
 * Returns cache statistics, routing info, and available notebooks
 */
export async function GET() {
  try {
    const supabase = createClient();

    // Get cache statistics
    const { data: cacheStats } = await supabase
      .from('notebook_cache')
      .select('notebook_name, hit_count, created_at')
      .order('created_at', { ascending: false });

    // Get routing statistics
    const { data: routingStats } = await supabase
      .from('notebook_routing')
      .select('*')
      .order('query_count', { ascending: false });

    // Group cache by notebook
    const notebooks: Record<string, { entries: number; total_hits: number }> = {};

    (cacheStats || []).forEach((entry) => {
      const name = entry.notebook_name;
      if (!notebooks[name]) {
        notebooks[name] = { entries: 0, total_hits: 0 };
      }
      notebooks[name].entries++;
      notebooks[name].total_hits += entry.hit_count || 0;
    });

    return NextResponse.json({
      cache_stats: {
        total_entries: cacheStats?.length || 0,
        notebooks,
      },
      routing_stats: routingStats || [],
      supported_counties: listSupportedCounties(),
      county_to_notebook: COUNTY_TO_NOTEBOOK,
      default_notebook: DEFAULT_NOTEBOOK,
      usage: {
        endpoint: 'POST /api/alex/notebook-query',
        body: {
          county: 'string (optional) - County name for automatic notebook routing',
          notebook: 'string (optional) - Direct notebook name (overrides county)',
          question: 'string (required) - The question to ask',
          bypass_cache: 'boolean (optional) - Force fresh query',
          max_results: 'number (optional) - Max results (default 5)',
        },
        examples: [
          {
            description: 'Query by county (recommended)',
            request: {
              county: 'Tarrant',
              question: 'What is the excess funds URL?',
            },
          },
          {
            description: 'Query specific notebook',
            request: {
              notebook: 'TX_Dallas_County_Playbook',
              question: 'What is the filing process for Dallas County?',
            },
          },
        ],
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
