/**
 * News Agent - Processes raw news articles through LLM reasoning
 * Performs deduplication, sentiment analysis, and impact assessment
 */

import { BaseAgent, BaseAgentConfig } from './base_agent.js';
import { AgentState } from './agent_state.js';
import { LLMClient } from '../infrastructure/llm_client.js';
import { KafkaProducer } from '../infrastructure/kafka_producer.js';
import { KafkaConsumer } from '../infrastructure/kafka_consumer.js';
import { getLogger } from '../utils/logger.js';
import * as db from '../infrastructure/database.js';
import * as newsFetcher from '../tools/news_fetcher.js';
import * as vectorStore from '../infrastructure/vector_store.js';
import { NewsAgentState } from './agent_state.js';

const logger = getLogger('news-agent');

const SYSTEM_PROMPT = `You are a financial news analysis expert. Analyze cryptocurrency and trading news articles.
Your tasks:
1. Determine if articles describe the same event (deduplication)
2. Extract core event and affected ticker symbols
3. Analyze sentiment (bullish/bearish/neutral) with confidence score (-1 to 1)
4. Assess market impact (high/medium/low)
5. Provide reasoning for your analysis

Format responses as JSON with these fields:
- is_duplicate: boolean
- event_id: string (UUID or hash if not duplicate)
- ticker: string (main symbol affected, or "MULTI" for multiple)
- sentiment_score: number (-1 to 1)
- sentiment_confidence: number (0 to 1)
- impact_level: "high" | "medium" | "low"
- summary: string (2-3 sentence summary)
- reasoning: string`;

/**
 * Concrete News Agent implementation
 */
export class NewsAgent extends BaseAgent {
  private processedArticleIds: Set<string> = new Set();

  constructor(
    producer: KafkaProducer,
    consumer: KafkaConsumer,
    llmClient: LLMClient
  ) {
    const config: BaseAgentConfig = {
      name: 'news-agent',
      inputTopic: 'raw_news',
      outputTopic: 'processed_signals',
      systemPrompt: SYSTEM_PROMPT,
      maxSteps: 5,
      timeout: 30000,
    };
    super(config, producer, consumer, llmClient);
  }

  /**
   * Process news article through LLM reasoning
   */
  protected async processNode(state: AgentState): Promise<NewsAgentState | null> {
    try {
      const newsState = state as NewsAgentState;

      if (!newsState.raw_article) {
        logger.warn('No raw article in state');
        return null;
      }

      logger.debug('Processing article', { headline: newsState.raw_article.headline });

      // Store article in SQLite
      const articleStored = db.storeArticle({
        id: Buffer.from(newsState.raw_article.headline + newsState.raw_article.url).toString('base64').substring(0, 32),
        headline: newsState.raw_article.headline,
        url: newsState.raw_article.url,
        source: newsState.raw_article.source,
        timestamp: newsState.raw_article.timestamp,
        content: newsState.raw_article.content,
        author: newsState.raw_article.author,
      });

      if (!articleStored) {
        logger.warn('Article already stored', { headline: newsState.raw_article.headline });
      }

      // Generate embedding and check for duplicates
      const embedding = await vectorStore.generateEmbedding(newsState.raw_article.headline + " " + (newsState.raw_article.content || ""));
      const vs = vectorStore.getVectorStore();
      const isDuplicate = await vs.isDuplicate(newsState.raw_article.headline, embedding);

      if (isDuplicate) {
        logger.debug('Article is duplicate (semantic match)', { headline: newsState.raw_article.headline });
        return {
          ...newsState,
          is_duplicate: true,
          is_complete: true,
          step_count: state.step_count + 1,
        };
      }

      // Add to vector store
      await vs.addArticle({
        id: Buffer.from(newsState.raw_article.headline + newsState.raw_article.url).toString('base64').substring(0, 32),
        headline: newsState.raw_article.headline,
        url: newsState.raw_article.url,
        source: newsState.raw_article.source,
        timestamp: newsState.raw_article.timestamp,
        content: newsState.raw_article.content,
        embedding,
      });

      // Step 1: Analyze with LLM
      const articleJson = JSON.stringify(newsState.raw_article);
      const analysisPrompt = `Analyze this news article and return ONLY a JSON object (no other text before or after):
${articleJson}

Return JSON with these exact fields:
{
  "is_duplicate": false,
  "event_id": "event_123",
  "ticker": "BTC",
  "sentiment_score": 0.5,
  "sentiment_confidence": 0.8,
  "impact_level": "high",
  "summary": "Brief summary",
  "reasoning": "Why you think this"
}`;

      const analysisResponse = await this.invokeLLM(analysisPrompt);

      // Parse LLM response - try to extract JSON from response
      let analysis;
      try {
        // Try to find JSON in the response
        const jsonMatch = analysisResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch {
        logger.warn('Failed to parse LLM response as JSON', { response: analysisResponse.substring(0, 200) });
        analysis = {
          is_duplicate: false,
          event_id: Buffer.from(newsState.raw_article.headline).toString('base64').substring(0, 16),
          ticker: 'UNKNOWN',
          sentiment_score: 0,
          sentiment_confidence: 0.3,
          impact_level: 'low',
          summary: newsState.raw_article.headline,
          reasoning: 'Could not parse LLM analysis, using defaults',
        };
      }

      // Check if duplicate
      if (analysis.is_duplicate) {
        logger.debug('Article is duplicate', { headline: newsState.raw_article.headline });
        return {
          ...newsState,
          is_duplicate: true,
          is_complete: true,
          step_count: state.step_count + 1,
        };
      }

      // Build output signal
      const signal = {
        ticker: analysis.ticker || 'UNKNOWN',
        sentiment_score: Math.max(-1, Math.min(1, analysis.sentiment_score || 0)),
        confidence: Math.max(0, Math.min(1, analysis.sentiment_confidence || 0.5)),
        impact_level: analysis.impact_level || 'low',
        summary: analysis.summary || newsState.raw_article.headline,
        reasoning: analysis.reasoning || 'LLM analysis',
        timestamp: new Date(),
      };

      logger.info('Article processed', {
        ticker: signal.ticker,
        sentiment: signal.sentiment_score,
        impact: signal.impact_level,
      });

      // Store signal in SQLite
      db.storeSignal({
        id: Buffer.from(signal.ticker + signal.timestamp.toISOString()).toString('base64').substring(0, 32),
        article_id: Buffer.from(newsState.raw_article.headline + newsState.raw_article.url).toString('base64').substring(0, 32),
        ticker: signal.ticker,
        sentiment_score: signal.sentiment_score,
        sentiment_confidence: signal.confidence,
        impact_level: signal.impact_level,
        summary: signal.summary,
        reasoning: signal.reasoning,
        is_duplicate: false,
      });

      return {
        ...newsState,
        is_duplicate: false,
        event_id: analysis.event_id,
        ticker: signal.ticker,
        sentiment_score: signal.sentiment_score,
        sentiment_confidence: signal.confidence,
        impact_level: signal.impact_level,
        impact_reasoning: signal.reasoning,
        signal,
        is_complete: true,
        step_count: state.step_count + 1,
        data: {
          ...state.data,
          signal,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error processing news article', { error: message });
      return {
        ...state,
        error: message,
        is_complete: true,
        step_count: state.step_count + 1,
      } as NewsAgentState;
    }
  }

  /**
   * Fetch and queue raw news articles from external sources
   */
  async fetchAndQueueNews(): Promise<void> {
    try {
      logger.info('Fetching news from external sources');

      const articles = await newsFetcher.fetchAllNews({
        newsApiQuery: 'cryptocurrency bitcoin ethereum trading',
        newsApiLimit: 5,
        redditLimit: 5,
      });

      logger.info('Fetched articles', { count: articles.length });

      // Queue each article for processing
      for (const article of articles) {
        const articleId = Buffer.from(article.headline + article.url).toString('base64').substring(0, 32);

        if (!this.processedArticleIds.has(articleId)) {
          await this.emitOutput(articleId, {
            headline: article.headline,
            url: article.url,
            source: article.source,
            timestamp: article.timestamp.toISOString(),
            content: article.content,
            author: article.author,
          });

          this.processedArticleIds.add(articleId);
          logger.debug('Queued article for processing', { headline: article.headline });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to fetch and queue news', { error: message });
    }
  }
}

/**
 * Factory function to create news agent
 */
export function createNewsAgent(
  producer: KafkaProducer,
  consumer: KafkaConsumer,
  llmClient: LLMClient
): NewsAgent {
  return new NewsAgent(producer, consumer, llmClient);
}

export default NewsAgent;
