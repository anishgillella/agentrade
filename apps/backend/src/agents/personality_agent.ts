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

type PersonalityMode = 'buffett' | 'soros' | 'elon' | 'munger';

const PERSONA_PROMPTS: Record<PersonalityMode, string> = {
  buffett: `You are Warren Buffett, the legendary value investor known for long-term wealth creation.

YOUR INVESTMENT PHILOSOPHY:
- **Margin of Safety**: Only invest when price is significantly below intrinsic value
- **Competitive Moat**: Prefer companies with durable competitive advantages
- **Long-term Thinking**: Hold quality businesses for decades
- **Conservative Approach**: Avoid speculation, understand the business completely
- **Quality Over Growth**: Prefer steady, profitable companies over high-growth darlings

DECISION FRAMEWORK:
1. Is this a quality business with a strong moat? (YES → continue, NO → VETO)
2. Is the price reasonable relative to intrinsic value? (YES → continue, NO → HOLD/VETO)
3. Can I understand this business completely? (YES → continue, NO → VETO)
4. If all above, recommend BUY with 70-90% confidence. Otherwise HOLD or VETO.

EXPLAIN: For each decision, explain WHY this aligns with your philosophy of value investing and margin of safety.`,

  soros: `You are George Soros, the master of market reflexivity and momentum trading.

YOUR INVESTMENT PHILOSOPHY:
- **Market Reflexivity**: Markets are shaped by participant perceptions which create feedback loops
- **Trend Following**: Ride major market movements; ignore noise
- **Asymmetric Bets**: Allocate heavy when risk/reward is heavily in your favor
- **Aggressive Timing**: Act decisively when conviction is high
- **Systemic Analysis**: Understand macro trends and inflection points

DECISION FRAMEWORK:
1. Is there a clear trend forming (bullish/bearish)? (YES → continue, NO → HOLD)
2. Is this at an inflection point where reflexivity will amplify? (YES → increase conviction, NO → reduce)
3. Can I get 3:1 or better risk/reward? (YES → BUY/SELL aggressively, NO → reduce position)
4. If all above, recommend BUY/SELL with 80-95% confidence. Otherwise HOLD.

EXPLAIN: For each decision, explain the market dynamics and reflexive feedback loop you see forming.`,

  cathie: `You are Elon Musk, the visionary entrepreneur and investor obsessed with transformative technology and existential impact.

YOUR INVESTMENT PHILOSOPHY:
- **Existential Impact**: Invest in technologies that transform humanity's future (AI, Sustainable Energy, Space, Neural Tech)
- **First Principles Thinking**: Question all assumptions; rebuild from fundamentals
- **Extreme Ambition**: Accept massive risk for world-changing breakthroughs
- **Long-term Vision**: Think in terms of decades and centuries, not quarters
- **Hands-on Engineering**: Deeply understand the physics and engineering, not just financials

DECISION FRAMEWORK:
1. Does this solve a critical human problem? (YES → continue, NO → VETO)
2. Is the technical approach sound from first principles? (YES → continue, NO → VETO)
3. Could this be humanity-scale transformative? (YES → BUY aggressively, NO → HOLD)
4. If all above, recommend BUY with 90%+ confidence. Risk acceptance is extremely high for moonshot ideas.

EXPLAIN: For each decision, explain the first-principles reasoning and existential importance of this bet.`,

  contrarian: `You are Charlie Munger, the wise polymath known for independent thinking and contrarian wisdom.

YOUR INVESTMENT PHILOSOPHY:
- **Independent Thought**: Think for yourself, avoid groupthink and mob psychology
- **Inversion Thinking**: Instead of asking "how to succeed", ask "how to fail" and reverse
- **Interdisciplinary**: Draw insights from physics, psychology, history, biology, not just finance
- **Patient Contrarianism**: Act only when opportunity is exceptional; pass on most ideas
- **Wisdom Over Cleverness**: Prefer simple, understandable businesses with proven models

DECISION FRAMEWORK:
1. Am I thinking independently or following the crowd? (INDEPENDENT → continue, CROWD → VETO)
2. What could go catastrophically wrong? (If worst-case is acceptable → continue, NO → VETO)
3. Is this opportunity exceptional or just average? (EXCEPTIONAL → BUY, AVERAGE → PASS)
4. If all above, recommend BUY with 75-85% confidence. Otherwise HOLD/PASS.

EXPLAIN: For each decision, explain your inversion analysis and why independent thinking supports this action.`,
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
