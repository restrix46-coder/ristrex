import { logger } from '@/lib/logger.server';

export interface ContextConfig {
  maxTokens: number;
  strategy: 'recency' | 'relevance' | 'hybrid';
  includeFiles: string[];
  excludePatterns: string[];
}

export interface BuiltContext {
  systemPrompt: string;
  messages: any[];
  tokenCount: number;
  filesIncluded: string[];
  filesExcluded: string[];
  compressionRatio: number;
}

export class ContextBuilder {
  /**
   * Assembles optimal context within the given token budget.
   * يجمع السياق الأمثل ضمن ميزانية الرموز (tokens) المحددة.
   */
  async buildContext(projectId: string, task: string, config: ContextConfig): Promise<BuiltContext> {
    logger.info('Building context...', { projectId, strategy: config.strategy });
    
    const allFiles = config.includeFiles.map(file => ({ path: file, content: 'Mock content for ' + file }));
    const relevantFiles = this.selectRelevantFiles(task, allFiles, config.maxTokens / 2);
    
    const rawContext = relevantFiles.map(f => `${f.path}:\n${f.content}`).join('\n\n');
    const tokenCount = this.estimateTokens(rawContext);
    
    let finalContext = rawContext;
    let compressionRatio = 1.0;
    
    if (tokenCount > config.maxTokens) {
      finalContext = await this.compressContext(rawContext, config.maxTokens);
      compressionRatio = this.estimateTokens(finalContext) / tokenCount;
    }

    return {
      systemPrompt: 'You are an AI assistant with the following context.',
      messages: [{ role: 'user', content: `Task: ${task}\n\nContext:\n${finalContext}` }],
      tokenCount: this.estimateTokens(finalContext),
      filesIncluded: relevantFiles.map(f => f.path),
      filesExcluded: allFiles.filter(f => !relevantFiles.includes(f)).map(f => f.path),
      compressionRatio
    };
  }

  /**
   * Ranks files by relevance to the task.
   * يصنف الملفات حسب صلتها بالمهمة.
   */
  selectRelevantFiles(task: string, allFiles: Array<{path: string, content: string}>, maxTokens: number): Array<{path: string, content: string}> {
    // Mock relevance sorting (e.g., keyword matching or embeddings)
    const sorted = [...allFiles].sort((a, b) => b.content.length - a.content.length);
    const selected = [];
    let currentTokens = 0;
    
    for (const file of sorted) {
      const tokens = this.estimateTokens(file.content);
      if (currentTokens + tokens <= maxTokens) {
        selected.push(file);
        currentTokens += tokens;
      }
    }
    return selected;
  }

  /**
   * Summarizes less-relevant parts to fit the token budget.
   * يلخص الأجزاء الأقل أهمية لتناسب ميزانية الرموز.
   */
  async compressContext(context: string, targetTokens: number): Promise<string> {
    logger.info('Compressing context...', { targetTokens });
    // In a real scenario, we might call an LLM to summarize
    return context.substring(0, targetTokens * 3) + '\n...[COMPRESSED]';
  }

  /**
   * Estimates token count based on character length.
   * يقدر عدد الرموز بناءً على طول الأحرف (حوالي حرف لكل 3.5 رمز).
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 3.5);
  }

  /**
   * Fills the token budget with the highest-priority items first.
   * يملأ ميزانية الرموز بالعناصر ذات الأولوية القصوى أولاً.
   */
  prioritizeContext(items: Array<{id: string, text: string, priority: number}>, budget: number): Array<{id: string, text: string}> {
    const sorted = [...items].sort((a, b) => b.priority - a.priority);
    const selected = [];
    let currentTokens = 0;

    for (const item of sorted) {
      const tokens = this.estimateTokens(item.text);
      if (currentTokens + tokens <= budget) {
        selected.push({ id: item.id, text: item.text });
        currentTokens += tokens;
      }
    }
    return selected;
  }
}
