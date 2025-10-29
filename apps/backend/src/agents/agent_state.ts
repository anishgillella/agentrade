/**
 * Shared agent state types for LangGraph state graphs
 */

/**
 * Base agent state that all agents use
 * Manages state flow through the graph
 */
export interface AgentState {
  // Message history
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
  }>;

  // Current processing data
  data: Record<string, unknown>;

  // Metadata
  agent_name: string;
  step_count: number;
  is_complete: boolean;
  error: string | null;

  // Kafka metadata
  kafka_key?: string;
  kafka_topic?: string;
  kafka_partition?: number;
  kafka_offset?: number;
}

/**
 * News Agent specific state
 */
export interface NewsAgentState extends AgentState {
  // Raw input
  raw_article?: {
    headline: string;
    url: string;
    source: string;
    timestamp: Date;
    content?: string;
    author?: string;
  };

  // Processing stages
  is_duplicate?: boolean;
  event_id?: string;
  event_summary?: string;
  ticker?: string;
  affected_entities?: string[];

  // Sentiment analysis
  sentiment_score?: number; // -1.0 to 1.0
  sentiment_confidence?: number; // 0.0 to 1.0
  impact_level?: 'high' | 'medium' | 'low';
  impact_reasoning?: string;

  // Output signal
  signal?: {
    ticker: string;
    sentiment_score: number;
    confidence: number;
    impact_level: string;
    summary: string;
    reasoning: string;
    timestamp: Date;
  };
}

/**
 * Investment Agent specific state
 */
export interface InvestmentAgentState extends AgentState {
  // Input signals
  news_signals?: Array<{
    ticker: string;
    sentiment_score: number;
    confidence: number;
    impact_level: string;
  }>;

  // Quantitative data
  quant_data?: {
    ticker: string;
    price: number;
    rsi: number;
    sma_short: number;
    sma_long: number;
    volume: number;
    volume_ma: number;
    volatility: number;
  };

  // Signal fusion reasoning
  signal_alignment?: string;
  correlation_score?: number;

  // Trade recommendation
  recommendation?: {
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    position_size?: number;
    reasoning: string;
    risk_score: number;
    timestamp: Date;
  };
}

/**
 * Personality Agent specific state
 */
export interface PersonalityAgentState extends AgentState {
  // Input trade signal
  original_trade?: {
    ticker: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    reasoning: string;
  };

  // Persona context
  persona_mode?: 'buffett' | 'soros' | 'cathie' | 'contrarian';
  persona_context?: string;

  // Persona-specific reasoning
  persona_reasoning?: string;
  confidence_adjustment?: number;
  adjustment_rationale?: string;

  // Final decision
  final_decision?: {
    action: 'BUY' | 'SELL' | 'HOLD' | 'VETO';
    confidence_final: number;
    persona_mode: string;
    adjustments_made: string;
    timestamp: Date;
  };
}

export type SpecificAgentState = NewsAgentState | InvestmentAgentState | PersonalityAgentState;
