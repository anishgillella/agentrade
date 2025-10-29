/**
 * Personality Agent - Applies investor archetype reasoning
 */

import { BaseAgent, BaseAgentConfig } from './base_agent.js';
import { AgentState } from './agent_state.js';
import { LLMClient } from '../infrastructure/llm_client.js';
import { KafkaProducer } from '../infrastructure/kafka_producer.js';
import { KafkaConsumer } from '../infrastructure/kafka_consumer.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('personality-agent');

type PersonalityMode = 'buffett' | 'soros' | 'cathie' | 'contrarian';

const PERSONA_PROMPTS: Record<PersonalityMode, string> = {
  buffett: `You are Warren Buffett analyzing a trade recommendation. 
Focus on: long-term value, competitive moat, margin of safety, business quality.
Be conservative. Adjust confidence DOWN if it seems speculative.
Only recommend BUY if fundamentals are solid and price is reasonable.`,

  soros: `You are George Soros analyzing market dynamics and reflexivity.
Focus on: momentum, market sentiment shifts, systemic trends, timing.
Look for asymmetric bets. Recommend action if trend is clear and conviction is high.
Be aggressive on momentum plays.`,

  cathie: `You are Cathie Wood analyzing disruptive innovation.
Focus on: technology trends, innovation potential, disruption thesis, growth.
Amplify signals for AI, biotech, robotics, blockchain sectors.
Take higher risks on transformative companies.`,

  contrarian: `You are a contrarian investor.
Focus on: opposing crowd sentiment, overlooked opportunities, fear/greed extremes.
If market is very bullish, look to reduce or exit. If bearish, look for value.
Adjust recommendations OPPOSITE to consensus when conviction is high.`,
};

export class PersonalityAgent extends BaseAgent {
  private personalityMode: PersonalityMode;

  constructor(
    producer: KafkaProducer,
    consumer: KafkaConsumer,
    llmClient: LLMClient,
    personalityMode: PersonalityMode = 'buffett'
  ) {
    const config: BaseAgentConfig = {
      name: `personality-agent-${personalityMode}`,
      inputTopic: 'trade_signals',
      outputTopic: 'final_decisions',
      systemPrompt: PERSONA_PROMPTS[personalityMode],
      maxSteps: 3,
      timeout: 30000,
    };
    super(config, producer, consumer, llmClient);
    this.personalityMode = personalityMode;
  }

  /**
   * Process investment recommendation through personality lens
   */
  protected async processNode(state: AgentState): Promise<AgentState | null> {
    try {
      const recommendation = state.data as any;

      if (!recommendation.ticker || !recommendation.action) {
        logger.warn('Invalid recommendation data', { data: state.data });
        return null;
      }

      logger.debug('Processing recommendation through personality lens', {
        personalityMode: this.personalityMode,
        ticker: recommendation.ticker,
        originalAction: recommendation.action,
      });

      // Build LLM prompt
      const prompt = `Analyze this investment recommendation as a ${this.personalityMode}:

Original Recommendation:
- Ticker: ${recommendation.ticker}
- Action: ${recommendation.action}
- Confidence: ${recommendation.confidence}
- Reasoning: ${recommendation.reasoning}

Return JSON with your assessment:
{
  "final_action": "BUY" | "SELL" | "HOLD" | "VETO",
  "confidence_final": number (0-1),
  "adjustments_made": "explanation of changes",
  "persona_reasoning": "why you adjusted it"
}`;

      const llmResponse = await this.invokeLLM(prompt);

      // Parse response
      let analysis;
      try {
        const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found');
        }
      } catch {
        logger.warn('Failed to parse personality response', { response: llmResponse.substring(0, 200) });
        analysis = {
          final_action: recommendation.action,
          confidence_final: recommendation.confidence,
          adjustments_made: 'Personality analysis parsing failed',
          persona_reasoning: 'Using original recommendation',
        };
      }

      logger.info('Personality analysis complete', {
        originalAction: recommendation.action,
        finalAction: analysis.final_action,
        personalityMode: this.personalityMode,
      });

      return {
        ...state,
        data: {
          ...recommendation,
          final_action: analysis.final_action,
          confidence_final: Math.max(0, Math.min(1, analysis.confidence_final || recommendation.confidence)),
          adjustments_made: analysis.adjustments_made,
          persona_reasoning: analysis.persona_reasoning,
          persona_mode: this.personalityMode,
        },
        is_complete: true,
        step_count: state.step_count + 1,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error in personality analysis', { error: message });
      return {
        ...state,
        error: message,
        is_complete: true,
        step_count: state.step_count + 1,
      };
    }
  }
}

export function createPersonalityAgent(
  producer: KafkaProducer,
  consumer: KafkaConsumer,
  llmClient: LLMClient,
  mode: PersonalityMode = 'buffett'
): PersonalityAgent {
  return new PersonalityAgent(producer, consumer, llmClient, mode);
}

export default PersonalityAgent;
