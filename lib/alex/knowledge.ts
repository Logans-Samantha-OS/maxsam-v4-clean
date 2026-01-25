/**
 * ALEX Knowledge Base Integration
 *
 * Provides functions for querying the ALEX Knowledge Base
 * which is powered by the alex-knowledge MCP server.
 *
 * The knowledge base contains:
 * - County playbooks and procedures
 * - Excess funds filing processes
 * - PDF extraction patterns
 * - System documentation
 */

// MCP Server endpoint (can be configured via env)
const ALEX_MCP_URL = process.env.ALEX_KNOWLEDGE_MCP_URL || 'http://localhost:3100';

export interface KnowledgeSource {
  id: string;
  name: string;
  type: string;
  chunks: number;
  description?: string;
  added: string;
}

export interface KnowledgeResult {
  content: string;
  source_id: string;
  source_name: string;
  source_type: string;
  similarity: number;
}

export interface QueryKnowledgeOptions {
  maxResults?: number;
  similarityThreshold?: number;
}

/**
 * Query the ALEX Knowledge Base
 *
 * @param question - The question to search for
 * @param options - Query options
 * @returns Relevant knowledge chunks with sources
 */
export async function queryKnowledge(
  question: string,
  options: QueryKnowledgeOptions = {}
): Promise<KnowledgeResult[]> {
  const { maxResults = 5, similarityThreshold = 0.7 } = options;

  try {
    const response = await fetch(`${ALEX_MCP_URL}/query`, {
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
      throw new Error(`Knowledge query failed: ${response.status}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('ALEX Knowledge query error:', error);
    return [];
  }
}

/**
 * List all knowledge sources
 *
 * @returns List of all sources in the knowledge base
 */
export async function listSources(): Promise<KnowledgeSource[]> {
  try {
    const response = await fetch(`${ALEX_MCP_URL}/sources`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`List sources failed: ${response.status}`);
    }

    const data = await response.json();
    return data.sources || [];
  } catch (error) {
    console.error('ALEX list sources error:', error);
    return [];
  }
}

/**
 * Add a document to the knowledge base
 *
 * @param content - The document content
 * @param sourceName - Name of the document
 * @param sourceType - Type (document, pdf, template, extraction_pattern)
 * @param description - Optional description
 * @returns Source ID if successful
 */
export async function addDocument(
  content: string,
  sourceName: string,
  sourceType: string = 'document',
  description?: string
): Promise<string | null> {
  try {
    const response = await fetch(`${ALEX_MCP_URL}/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        source_name: sourceName,
        source_type: sourceType,
        description,
      }),
    });

    if (!response.ok) {
      throw new Error(`Add document failed: ${response.status}`);
    }

    const data = await response.json();
    return data.source_id || null;
  } catch (error) {
    console.error('ALEX add document error:', error);
    return null;
  }
}

/**
 * Search for county-specific information
 *
 * @param county - County name (e.g., "Dallas", "Tarrant")
 * @param topic - Specific topic (e.g., "excess funds URL", "filing process")
 * @returns Relevant information
 */
export async function getCountyInfo(
  county: string,
  topic: string
): Promise<string | null> {
  const question = `${topic} for ${county} County Texas`;

  const results = await queryKnowledge(question, {
    maxResults: 3,
    similarityThreshold: 0.6,
  });

  if (results.length === 0) {
    return null;
  }

  // Return the most relevant result
  return results[0].content;
}

/**
 * Get excess funds URL for a county
 *
 * @param county - County name
 * @returns URL if found, null otherwise
 */
export async function getExcessFundsUrl(county: string): Promise<string | null> {
  const info = await getCountyInfo(county, 'excess funds URL');

  if (!info) {
    return null;
  }

  // Extract URL from the response
  const urlMatch = info.match(/https?:\/\/[^\s<>"]+/);
  return urlMatch ? urlMatch[0] : null;
}

/**
 * Get filing process for a county
 *
 * @param county - County name
 * @returns Filing process information
 */
export async function getFilingProcess(county: string): Promise<string | null> {
  return getCountyInfo(county, 'excess funds claim filing process');
}
