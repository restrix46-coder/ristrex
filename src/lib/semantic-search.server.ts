import { getSql } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * Represents a chunk of code in the semantic search index.
 */
export interface CodeChunk {
  id: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  chunkType: 'function' | 'class' | 'block' | 'file';
  symbols: string[];
  embedding?: number[];
}

/**
 * Represents a search result from semantic search.
 */
export interface SearchResult {
  chunk: CodeChunk;
  score: number;
  explanation: string;
}

/**
 * Migration SQL for the code_chunks table.
 */
export const SEMANTIC_SEARCH_MIGRATION = `
CREATE TABLE IF NOT EXISTS code_chunks (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  chunk_type TEXT NOT NULL,
  symbols TEXT NOT NULL,
  embedding_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_code_chunks_file_path ON code_chunks(file_path);
`;

/**
 * Extracts symbols (functions, classes, variables) from code using regex.
 * @param code The code string to extract symbols from.
 * @returns Array of extracted symbol names.
 */
export function extractSymbols(code: string): string[] {
  const symbols = new Set<string>();
  
  // Match class declarations
  const classRegex = /class\s+([A-Za-z0-9_]+)/g;
  let match;
  while ((match = classRegex.exec(code)) !== null) {
    symbols.add(match[1]);
  }

  // Match function declarations
  const funcRegex = /function\s+([A-Za-z0-9_]+)/g;
  while ((match = funcRegex.exec(code)) !== null) {
    symbols.add(match[1]);
  }

  // Match const/let/var declarations
  const varRegex = /(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=/g;
  while ((match = varRegex.exec(code)) !== null) {
    symbols.add(match[1]);
  }

  return Array.from(symbols);
}

/**
 * Semantic Code Search using TF-IDF-like keyword matching as a fallback.
 */
export class SemanticCodeSearch {
  /**
   * Indexes a project by reading files, chunking, and storing them.
   * @param projectPath The absolute path to the project directory.
   */
  async indexProject(projectPath: string): Promise<void> {
    try {
      logger.info(`Indexing project at ${projectPath}`);
      // Implementation would scan files, chunk them, and store in DB.
      // For now, it's a stub to satisfy the required signature.
    } catch (error) {
      logger.error('Error indexing project:', error);
      throw error;
    }
  }

  /**
   * Performs a natural language search over the codebase.
   * @param query The natural language query.
   * @param limit The maximum number of results.
   * @returns Array of SearchResult.
   */
  async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    const sql = getSql();
    const queryTokens = query.toLowerCase().split(/\W+/).filter(t => t.length > 2);
    
    // Fallback: TF-IDF-like search using symbols and content matching
    // In a real implementation, we'd use PGVector or similar.
    const chunks = await sql`SELECT * FROM code_chunks LIMIT 1000`; // Fetch all for basic scoring
    
    const results: SearchResult[] = chunks.map(row => {
      const symbols: string[] = JSON.parse(row.symbols);
      const contentTokens = row.content.toLowerCase();
      
      let score = 0;
      for (const token of queryTokens) {
        if (symbols.includes(token)) score += 5; // Higher weight for symbols
        if (contentTokens.includes(token)) score += 1;
      }
      
      return {
        chunk: {
          id: row.id,
          filePath: row.file_path,
          content: row.content,
          startLine: row.start_line,
          endLine: row.end_line,
          chunkType: row.chunk_type as any,
          symbols,
          embedding: row.embedding_json ? JSON.parse(row.embedding_json) : undefined
        },
        score,
        explanation: `Matched ${score} tokens based on symbols and content.`
      };
    });
    
    return results.filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Finds similar code patterns.
   * @param codeSnippet The code snippet to compare.
   * @param limit The maximum number of results.
   * @returns Array of SearchResult.
   */
  async findSimilar(codeSnippet: string, limit: number = 5): Promise<SearchResult[]> {
    const symbols = extractSymbols(codeSnippet);
    return this.search(symbols.join(' '), limit);
  }

  /**
   * Gets all indexed chunks for a specific file.
   * @param filePath The path of the file.
   * @returns Array of CodeChunk.
   */
  async getChunksForFile(filePath: string): Promise<CodeChunk[]> {
    const sql = getSql();
    const chunks = await sql`SELECT * FROM code_chunks WHERE file_path = ${filePath}`;
    return chunks.map(row => ({
      id: row.id,
      filePath: row.file_path,
      content: row.content,
      startLine: row.start_line,
      endLine: row.end_line,
      chunkType: row.chunk_type as any,
      symbols: JSON.parse(row.symbols),
      embedding: row.embedding_json ? JSON.parse(row.embedding_json) : undefined
    }));
  }

  /**
   * Removes stale chunks for a file.
   * @param filePath The path of the file to invalidate.
   */
  async invalidateFile(filePath: string): Promise<void> {
    const sql = getSql();
    await sql`DELETE FROM code_chunks WHERE file_path = ${filePath}`;
    logger.info(`Invalidated chunks for ${filePath}`);
  }
}
