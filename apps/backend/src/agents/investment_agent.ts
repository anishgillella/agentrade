/**
 * Investment Agent - Fuses sentiment signals with technical indicators
 * Generates trade recommendations using LLM reasoning
 */

import { BaseAgent, BaseAgentConfig } from './base_agent.js';
import { AgentState } from './agent_state.js';
import { LLMClient } from '../infrastructure/llm_client.js';
import { KafkaProducer } from '../infrastructure/kafka_producer.js';
import { KafkaConsumer } from '../infrastructure/kafka_consumer.js';
import { getLogger } from '../utils/logger.js';
import * as db from '../infrastructure/database.js';
import * as coingecko from '../tools/coingecko_client.js';
import { calculateIndicators, generateTechnicalAnalysis } from '../tools/indicators.js';
import { getRAGPipeline } from '../infrastructure/rag_pipeline.js';

const logger = getLogger('investment-agent');

const SYSTEM_PROMPT = `You are a quantitative trading analyst. 
You analyze signals combining sentiment analysis and technical indicators.
You generate BUY/SELL/HOLD recommendations with confidence scores.

Consider:
1. Sentiment alignment with technical indicators
2. Risk/reward ratios
3. Market momentum
4. Volume confirmation
5. HISTORICAL CONTEXT: Use past similar articles to identify patterns and avoid false signals

Output JSON:
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": 0.0-1.0,
  "reasoning": "explanation including historical context if available",
  "risk_score": 0.0-1.0,
  "historical_analysis": "how past signals compare to current signal"
}`;

export interface TradeRecommendation {
  id: string;
  ticker: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  risk_score: number;
  sentiment_score: number;
  rsi: number;
  sma20: number;
  sma50: number;
  timestamp: Date;
}

/**
 * Investment Agent - extends BaseAgent
 */
export class InvestmentAgent extends BaseAgent {
  constructor(producer: KafkaProducer, consumer: KafkaConsumer, llmClient: LLMClient) {
    const config: BaseAgentConfig = {
      name: 'investment-agent',
      inputTopic: 'processed_signals',
      outputTopic: 'trade_signals',
      systemPrompt: SYSTEM_PROMPT,
      maxSteps: 5,
      timeout: 30000,
    };
    super(config, producer, consumer, llmClient);
  }

  /**
   * Process signal through signal fusion
   */
  protected async processNode(state: AgentState): Promise<AgentState | null> {
    try {
      const signal = state.data as any;

      if (!signal.ticker || signal.sentiment_score === undefined) {
        logger.warn('Invalid signal data', { data: state.data });
        return null;
      }

      logger.debug('Processing signal', { ticker: signal.ticker, sentiment: signal.sentiment_score });

      // Fetch market data and calculate indicators
      const historicalData = await coingecko.getHistoricalData(signal.ticker, 30);
      if (!historicalData) {
        logger.warn('Could not fetch historical data', { ticker: signal.ticker });
        return null;
      }

      const prices = historicalData.prices.map(p => p[1]);
      const volumes = historicalData.volumes.map(v => v[1]);
      const indicators = calculateIndicators(prices, volumes);

      // Generate technical analysis text
      const technicalText = generateTechnicalAnalysis(indicators);

      // RETRIEVE HISTORICAL CONTEXT FROM RAG PIPELINE
      logger.debug('Retrieving historical context from RAG pipeline', { ticker: signal.ticker });
      const ragPipeline = getRAGPipeline('all-mpnet-base-v2');
      const currentEmbedding = await ragPipeline.generateEmbedding(
        signal.headline || `${signal.ticker} trading signal`
      );
      const similarDocuments = await ragPipeline.retrieveSimilarDocuments(
        currentEmbedding,
        signal.ticker,
        5 // Top 5 similar articles
      );
      const historicalContext = ragPipeline.buildContext(similarDocuments);

      logger.info('Historical context retrieved', {
        ticker: signal.ticker,
        similarDocuments: similarDocuments.length,
      });

      // Build LLM prompt WITH HISTORICAL CONTEXT
      const analysisPrompt = `Analyze this trading signal and technical data:

Signal:
- Ticker: ${signal.ticker}
- Sentiment Score: ${signal.sentiment_score} (range: -1 to 1)
- Sentiment Confidence: ${signal.sentiment_confidence}
- Impact Level: ${signal.impact_level}

${technicalText}

${historicalContext}

Provide trade recommendation as JSON (no other text):
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": number,
  "reasoning": "explanation",
  "risk_score": number,
  "historical_analysis": "comparison with past signals"
}`;

      const llmResponse = await this.invokeLLM(analysisPrompt);

      // Parse LLM response
      let recommendation;
      try {
        const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          recommendation = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found');
        }
      } catch {
        logger.warn('Failed to parse LLM response', { response: llmResponse.substring(0, 200) });
        recommendation = {
          action: 'HOLD',
          confidence: 0.3,
          reasoning: 'LLM parsing failed',
          risk_score: 0.5,
        };
      }

      // Build trade recommendation
      const tradeRec: TradeRecommendation = {
        id: Buffer.from(signal.ticker + new Date().toISOString()).toString('base64').substring(0, 32),
        ticker: signal.ticker,
        action: recommendation.action || 'HOLD',
        confidence: Math.max(0, Math.min(1, recommendation.confidence || 0.5)),
        reasoning: recommendation.reasoning || 'Signal fusion complete',
        risk_score: Math.max(0, Math.min(1, recommendation.risk_score || 0.5)),
        sentiment_score: signal.sentiment_score,
        rsi: indicators.rsi14,
        sma20: indicators.sma20,
        sma50: indicators.sma50,
        timestamp: new Date(),
      };

      logger.info('Trade recommendation generated', {
        ticker: tradeRec.ticker,
        action: tradeRec.action,
        confidence: tradeRec.confidence,
      });

      // Store in database
      db.storeSignal({
        id: tradeRec.id,
        article_id: undefined,
        ticker: tradeRec.ticker,
        sentiment_score: tradeRec.sentiment_score,
        sentiment_confidence: tradeRec.confidence,
        impact_level: tradeRec.action,
        summary: `${tradeRec.action} recommendation for ${tradeRec.ticker}`,
        reasoning: tradeRec.reasoning,
      });

      return {
        ...state,
        data: tradeRec as any,
        is_complete: true,
        step_count: state.step_count + 1,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error in Investment Agent', { error: message });
      return {
        ...state,
        error: message,
        is_complete: true,
        step_count: state.step_count + 1,
      };
    }
  }
}

/**
 * Factory function
 */
export function createInvestmentAgent(
  producer: KafkaProducer,
  consumer: KafkaConsumer,
  llmClient: LLMClient
): InvestmentAgent {
  return new InvestmentAgent(producer, consumer, llmClient);
}

export default InvestmentAgent;
