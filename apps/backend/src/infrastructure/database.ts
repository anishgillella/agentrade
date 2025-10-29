/**
 * Database layer - In-memory SQLite via sql.js for structured data
 * For MVP: stores in memory. In production: persist to disk
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('database');

interface ArticleRecord {
  id: string;
  headline: string;
  url: string;
  source: string;
  timestamp: string;
  content?: string;
  author?: string;
  created_at: string;
}

interface SignalRecord {
  id: string;
  article_id?: string;
  ticker: string;
  sentiment_score: number;
  sentiment_confidence: number;
  impact_level: string;
  summary: string;
  reasoning: string;
  is_duplicate: number;
  created_at: string;
}

interface AgentExecutionRecord {
  id: string;
  execution_timestamp: string;
  workflow_id: string;
  agent_name: string;
  agent_type: 'news' | 'investment' | 'personality';
  input_data: string; // JSON stringified
  output_data: string; // JSON stringified
  status: 'success' | 'failed' | 'skipped';
  error_message?: string;
  execution_time_ms: number;
  personality_mode?: string;
  created_at: string;
}

/**
 * Simple in-memory database for MVP
 */
class SimpleDatabase {
  private articles: Map<string, ArticleRecord> = new Map();
  private signals: Map<string, SignalRecord> = new Map();
  private executions: Map<string, AgentExecutionRecord> = new Map();

  async initialize(): Promise<void> {
    logger.info('Database initialized (in-memory)');
  }

  storeArticle(article: {
    id: string;
    headline: string;
    url: string;
    source: string;
    timestamp: Date;
    content?: string;
    author?: string;
  }): boolean {
    try {
      if (this.articles.has(article.id)) {
        return false; // Already exists
      }

      this.articles.set(article.id, {
        ...article,
        timestamp: article.timestamp.toISOString(),
        created_at: new Date().toISOString(),
      });

      logger.debug('Article stored', { id: article.id, headline: article.headline });
      return true;
    } catch (error) {
      logger.error('Failed to store article', { error });
      return false;
    }
  }

  storeSignal(signal: {
    id: string;
    article_id?: string;
    ticker: string;
    sentiment_score: number;
    sentiment_confidence: number;
    impact_level: string;
    summary: string;
    reasoning: string;
    is_duplicate?: boolean;
  }): boolean {
    try {
      this.signals.set(signal.id, {
        ...signal,
        is_duplicate: signal.is_duplicate ? 1 : 0,
        created_at: new Date().toISOString(),
      });

      logger.debug('Signal stored', { id: signal.id, ticker: signal.ticker });
      return true;
    } catch (error) {
      logger.error('Failed to store signal', { error });
      return false;
    }
  }

  getSignalsByTicker(ticker: string, hours: number = 24): SignalRecord[] {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    return Array.from(this.signals.values())
      .filter(s => s.ticker === ticker && s.created_at > cutoffTime)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  getRecentArticles(limit: number = 100): ArticleRecord[] {
    return Array.from(this.articles.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  getStats() {
    return {
      articles: this.articles.size,
      signals: this.signals.size,
    };
  }

  storeExecution(execution: {
    id: string;
    execution_timestamp: Date;
    workflow_id: string;
    agent_name: string;
    agent_type: 'news' | 'investment' | 'personality';
    input_data: any;
    output_data: any;
    status: 'success' | 'failed' | 'skipped';
    error_message?: string;
    execution_time_ms: number;
    personality_mode?: string;
  }): boolean {
    try {
      this.executions.set(execution.id, {
        id: execution.id,
        execution_timestamp: execution.execution_timestamp.toISOString(),
        workflow_id: execution.workflow_id,
        agent_name: execution.agent_name,
        agent_type: execution.agent_type,
        input_data: JSON.stringify(execution.input_data),
        output_data: JSON.stringify(execution.output_data),
        status: execution.status,
        error_message: execution.error_message,
        execution_time_ms: execution.execution_time_ms,
        personality_mode: execution.personality_mode,
        created_at: new Date().toISOString(),
      });

      logger.debug('Execution stored', { 
        id: execution.id, 
        agent: execution.agent_name,
        status: execution.status,
        duration: `${execution.execution_time_ms}ms`
      });
      return true;
    } catch (error) {
      logger.error('Failed to store execution', { error });
      return false;
    }
  }

  getExecutionsByWorkflow(workflowId: string): AgentExecutionRecord[] {
    return Array.from(this.executions.values())
      .filter(e => e.workflow_id === workflowId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  getExecutionsByAgent(agentType: 'news' | 'investment' | 'personality', hours: number = 24): AgentExecutionRecord[] {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    return Array.from(this.executions.values())
      .filter(e => e.agent_type === agentType && e.created_at > cutoffTime)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  getExecutionStats(hours: number = 24) {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const recentExecutions = Array.from(this.executions.values())
      .filter(e => e.created_at > cutoffTime);
    
    const stats = {
      total_executions: recentExecutions.length,
      successful: recentExecutions.filter(e => e.status === 'success').length,
      failed: recentExecutions.filter(e => e.status === 'failed').length,
      skipped: recentExecutions.filter(e => e.status === 'skipped').length,
      avg_execution_time_ms: recentExecutions.length > 0 
        ? recentExecutions.reduce((sum, e) => sum + e.execution_time_ms, 0) / recentExecutions.length 
        : 0,
      by_agent: {
        news: recentExecutions.filter(e => e.agent_type === 'news').length,
        investment: recentExecutions.filter(e => e.agent_type === 'investment').length,
        personality: recentExecutions.filter(e => e.agent_type === 'personality').length,
      }
    };
    return stats;
  }

  close(): void {
    logger.info('Database closed');
  }
}

let database: SimpleDatabase | null = null;

export function initializeDatabase(): SimpleDatabase {
  if (!database) {
    database = new SimpleDatabase();
    database.initialize();
  }
  return database;
}

export function getDatabase(): SimpleDatabase {
  if (!database) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return database;
}

export function storeArticle(article: any): boolean {
  return getDatabase().storeArticle(article);
}

export function storeSignal(signal: any): boolean {
  return getDatabase().storeSignal(signal);
}

export function getSignalsByTicker(ticker: string, hours?: number): SignalRecord[] {
  return getDatabase().getSignalsByTicker(ticker, hours);
}

export function getRecentArticles(limit?: number): ArticleRecord[] {
  return getDatabase().getRecentArticles(limit);
}

export function storeExecution(execution: any): boolean {
  return getDatabase().storeExecution(execution);
}

export function getExecutionsByWorkflow(workflowId: string): AgentExecutionRecord[] {
  return getDatabase().getExecutionsByWorkflow(workflowId);
}

export function getExecutionsByAgent(agentType: 'news' | 'investment' | 'personality', hours?: number): AgentExecutionRecord[] {
  return getDatabase().getExecutionsByAgent(agentType, hours);
}

export function getExecutionStats(hours?: number) {
  return getDatabase().getExecutionStats(hours);
}

export function closeDatabase(): void {
  if (database) {
    database.close();
    database = null;
  }
}

export default { initializeDatabase, getDatabase, storeArticle, storeSignal, getSignalsByTicker, getRecentArticles, storeExecution, getExecutionsByWorkflow, getExecutionsByAgent, getExecutionStats, closeDatabase };
