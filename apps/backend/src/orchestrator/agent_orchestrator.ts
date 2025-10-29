/**
 * Agent Orchestrator - Coordinates all agents in a fixed workflow
 * Workflow: News Agent → Investment Agent → Personality Agent → Database
 */

import { randomUUID } from 'crypto';
import { getLogger } from '../utils/logger.js';
import { AgentError, ErrorCodes } from '../utils/errors.js';
import { LLMClient } from '../infrastructure/llm_client.js';
import { KafkaProducer } from '../infrastructure/kafka_producer.js';
import { KafkaConsumer, MessageHandler } from '../infrastructure/kafka_consumer.js';
import { NewsAgent } from '../agents/news_agent.js';
import { InvestmentAgent } from '../agents/investment_agent.js';
import { PersonalityAgent } from '../agents/personality_agent.js';
import * as db from '../infrastructure/database.js';

const logger = getLogger('orchestrator');

// Simple UUID generator function
function generateUUID(): string {
  return randomUUID();
}

type PersonalityMode = 'buffett' | 'soros' | 'cathie' | 'contrarian';

/**
 * Workflow state tracking
 */
interface WorkflowState {
  workflowId: string;
  startTime: Date;
  newsAgentResult?: any;
  investmentAgentResult?: any;
  personalityAgentResult?: any;
  status: 'running' | 'completed' | 'failed';
  error?: string;
}

/**
 * Agent Orchestrator - manages workflow coordination
 */
export class AgentOrchestrator {
  private name: string = 'orchestrator';
  private personalityMode: PersonalityMode;
  private isRunning: boolean = false;

  private producer: KafkaProducer;
  private consumer: KafkaConsumer;

  private newsAgent: NewsAgent;
  private investmentAgent: InvestmentAgent;
  private personalityAgent: PersonalityAgent;

  private activeWorkflows: Map<string, WorkflowState> = new Map();

  constructor(
    producer: KafkaProducer,
    consumer: KafkaConsumer,
    llmClient: LLMClient,
    personalityMode: PersonalityMode = 'buffett'
  ) {
    this.producer = producer;
    this.consumer = consumer;

    // Create agent instances
    this.newsAgent = new NewsAgent(producer, consumer, llmClient);
    this.investmentAgent = new InvestmentAgent(producer, consumer, llmClient);
    this.personalityAgent = new PersonalityAgent(
      producer,
      consumer,
      llmClient,
      personalityMode
    );
    this.personalityMode = personalityMode;

    logger.info('AgentOrchestrator initialized', {
      personalityMode: this.personalityMode,
    });
  }

  /**
   * Initialize all agents and Kafka connections
   */
  async initialize(): Promise<void> {
    try {
      logger.info('🚀 Initializing Agent Orchestrator...');

      // Initialize database
      db.initializeDatabase();
      logger.info('✓ Database initialized');

      // Initialize producer
      await this.producer.connect();
      logger.info('✓ Kafka Producer connected');

      // Initialize consumer for raw_news topic
      await this.consumer.connect();
      logger.info('✓ Kafka Consumer connected');

      // Initialize agents
      await this.newsAgent.initialize();
      logger.info('✓ News Agent initialized');

      await this.investmentAgent.initialize();
      logger.info('✓ Investment Agent initialized');

      await this.personalityAgent.initialize();
      logger.info('✓ Personality Agent initialized');

      logger.info('✅ Agent Orchestrator fully initialized');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to initialize orchestrator', { error: message });
      throw new AgentError(
        ErrorCodes.AGENT_INITIALIZATION_ERROR,
        `Failed to initialize orchestrator: ${message}`,
        500,
        { error: message }
      );
    }
  }

  /**
   * Start the orchestrator - subscribe to raw_news and coordinate workflow
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Orchestrator is already running');
      return;
    }

    try {
      logger.info('🚀 Starting Agent Orchestrator...');
      this.isRunning = true;

      // Subscribe to raw_news topic
      await this.consumer.subscribe();
      logger.info('✓ Subscribed to topics', { topics: ['raw_news'] });

      // Create message handler
      const messageHandler: MessageHandler = async (
        topic: string,
        key: string,
        value: Record<string, unknown>,
        partition: number,
        offset: string
      ) => {
        await this.handleNewsMessage(topic, key, value, partition, offset);
      };

      // Start consuming
      await this.consumer.start(messageHandler);
      logger.info('✅ Agent Orchestrator started and consuming from raw_news');
    } catch (error) {
      this.isRunning = false;
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to start orchestrator', { error: message });
      throw new AgentError(
        ErrorCodes.AGENT_START_ERROR,
        `Failed to start orchestrator: ${message}`,
        500,
        { error: message }
      );
    }
  }

  /**
   * Stop the orchestrator gracefully
   */
  async stop(): Promise<void> {
    try {
      logger.info('Shutting down Agent Orchestrator...');
      this.isRunning = false;

      await this.consumer.shutdown();
      logger.debug('Consumer shutdown');

      await this.producer.disconnect();
      logger.debug('Producer disconnected');

      logger.info('✓ Agent Orchestrator stopped');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error stopping orchestrator', { error: message });
      throw error;
    }
  }

  /**
   * Handle incoming news message and execute workflow
   */
  private async handleNewsMessage(
    _topic: string,
    _key: string,
    value: Record<string, unknown>,
    _partition: number,
    _offset: string
  ): Promise<void> {
    const workflowId = generateUUID();
    const workflow: WorkflowState = {
      workflowId,
      startTime: new Date(),
      status: 'running',
    };

    try {
      logger.info('📨 Received news message, starting workflow', {
        workflowId,
        topic: _topic,
      });

      this.activeWorkflows.set(workflowId, workflow);

      // Step 1: Process with News Agent
      logger.debug('Step 1: Processing with News Agent', { workflowId });
      const newsStartTime = Date.now();
      let newsResult: any;
      try {
        newsResult = await this.processWithNewsAgent(value);
        const newsExecutionTime = Date.now() - newsStartTime;

        // Log execution
        await this.logExecution({
          workflowId,
          agentName: 'news-agent',
          agentType: 'news',
          input: value,
          output: newsResult,
          status: 'success',
          executionTime: newsExecutionTime,
        });

        workflow.newsAgentResult = newsResult;
        logger.info('✓ News Agent completed', {
          workflowId,
          duration: `${newsExecutionTime}ms`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('❌ News Agent failed', { workflowId, error: message });
        await this.logExecution({
          workflowId,
          agentName: 'news-agent',
          agentType: 'news',
          input: value,
          output: null,
          status: 'failed',
          error: message,
          executionTime: Date.now() - newsStartTime,
        });
        throw error;
      }

      // Step 2: Process with Investment Agent
      logger.debug('Step 2: Processing with Investment Agent', { workflowId });
      const investmentStartTime = Date.now();
      let investmentResult: any;
      try {
        investmentResult = await this.processWithInvestmentAgent(newsResult);
        const investmentExecutionTime = Date.now() - investmentStartTime;

        await this.logExecution({
          workflowId,
          agentName: 'investment-agent',
          agentType: 'investment',
          input: newsResult,
          output: investmentResult,
          status: 'success',
          executionTime: investmentExecutionTime,
        });

        workflow.investmentAgentResult = investmentResult;
        logger.info('✓ Investment Agent completed', {
          workflowId,
          duration: `${investmentExecutionTime}ms`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('❌ Investment Agent failed', { workflowId, error: message });
        await this.logExecution({
          workflowId,
          agentName: 'investment-agent',
          agentType: 'investment',
          input: newsResult,
          output: null,
          status: 'failed',
          error: message,
          executionTime: Date.now() - investmentStartTime,
        });
        // Continue to personality agent even if investment fails
      }

      // Step 3: Process with Personality Agent
      logger.debug('Step 3: Processing with Personality Agent', { workflowId });
      const personalityStartTime = Date.now();
      let personalityResult: any;
      try {
        personalityResult = await this.processWithPersonalityAgent(
          investmentResult || newsResult
        );
        const personalityExecutionTime = Date.now() - personalityStartTime;

        await this.logExecution({
          workflowId,
          agentName: `personality-agent-${this.personalityMode}`,
          agentType: 'personality',
          input: investmentResult || newsResult,
          output: personalityResult,
          status: 'success',
          executionTime: personalityExecutionTime,
          personalityMode: this.personalityMode,
        });

        workflow.personalityAgentResult = personalityResult;
        logger.info('✓ Personality Agent completed', {
          workflowId,
          duration: `${personalityExecutionTime}ms`,
          personalityMode: this.personalityMode,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('❌ Personality Agent failed', {
          workflowId,
          error: message,
        });
        await this.logExecution({
          workflowId,
          agentName: `personality-agent-${this.personalityMode}`,
          agentType: 'personality',
          input: investmentResult || newsResult,
          output: null,
          status: 'failed',
          error: message,
          executionTime: Date.now() - personalityStartTime,
          personalityMode: this.personalityMode,
        });
        personalityResult = investmentResult || newsResult; // Use previous result
      }

      // Step 4: Store final decision
      logger.debug('Step 4: Storing final decision', { workflowId });
      await this.storeFinalDecision(
        workflowId,
        personalityResult,
        workflow
      );

      workflow.status = 'completed';
      logger.info('✅ Workflow completed successfully', {
        workflowId,
        duration: `${Date.now() - workflow.startTime.getTime()}ms`,
      });
    } catch (error) {
      workflow.status = 'failed';
      workflow.error = error instanceof Error ? error.message : String(error);
      logger.error('❌ Workflow failed', {
        workflowId,
        error: workflow.error,
        duration: `${Date.now() - workflow.startTime.getTime()}ms`,
      });
    } finally {
      // Clean up
      setTimeout(() => {
        this.activeWorkflows.delete(workflowId);
      }, 60000); // Keep for 1 minute
    }
  }

  /**
   * Process with News Agent
   */
  private async processWithNewsAgent(input: any): Promise<any> {
    // News agent processes raw news and returns analyzed signals
    // For now, we'll simulate by calling it directly
    return {
      ...input,
      processed_by: 'news_agent',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Process with Investment Agent
   */
  private async processWithInvestmentAgent(input: any): Promise<any> {
    // Investment agent fuses signals and returns trade recommendation
    return {
      ...input,
      processed_by: 'investment_agent',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Process with Personality Agent
   */
  private async processWithPersonalityAgent(input: any): Promise<any> {
    // Personality agent applies investor archetype reasoning
    return {
      ...input,
      processed_by: 'personality_agent',
      personality_mode: this.personalityMode,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Store final decision to database
   */
  private async storeFinalDecision(
    workflowId: string,
    decision: any,
    _workflow: WorkflowState
  ): Promise<void> {
    try {
      // Store article if it exists
      if (decision?.article) {
        db.storeArticle({
          id: decision.article.id || generateUUID(),
          headline: decision.article.headline || 'Unknown',
          url: decision.article.url || '',
          source: decision.article.source || 'unknown',
          timestamp: decision.article.timestamp || new Date(),
          content: decision.article.content || '',
          author: decision.article.author || '',
        });
        logger.info('✓ Article stored to SQL database', {
          workflowId,
          articleId: decision.article.id,
          headline: decision.article.headline?.substring(0, 50),
        });
      }

      // Store as signal if it has ticker
      if (decision && decision.ticker) {
        db.storeSignal({
          id: generateUUID(),
          ticker: decision.ticker,
          sentiment_score: decision.sentiment_score || 0,
          sentiment_confidence: decision.confidence || 0.5,
          impact_level: decision.impact_level || 'medium',
          summary: decision.summary || 'Orchestrated decision',
          reasoning: decision.reasoning || '',
          is_duplicate: false,
        });
        logger.info('✓ Trading signal stored to SQL database', {
          workflowId,
          ticker: decision.ticker,
          sentiment: decision.sentiment_score,
          confidence: decision.confidence,
        });
      }

      logger.debug('Final decision stored to database', { workflowId });
    } catch (error) {
      logger.error('Failed to store final decision', {
        workflowId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Log agent execution for audit trail
   */
  private async logExecution(params: {
    workflowId: string;
    agentName: string;
    agentType: 'news' | 'investment' | 'personality';
    input: any;
    output: any;
    status: 'success' | 'failed' | 'skipped';
    error?: string;
    executionTime: number;
    personalityMode?: PersonalityMode;
  }): Promise<void> {
    try {
      db.storeExecution({
        id: generateUUID(),
        execution_timestamp: new Date(),
        workflow_id: params.workflowId,
        agent_name: params.agentName,
        agent_type: params.agentType,
        input_data: params.input,
        output_data: params.output,
        status: params.status,
        error_message: params.error,
        execution_time_ms: params.executionTime,
        personality_mode: params.personalityMode,
      });
    } catch (error) {
      logger.error('Failed to log execution', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get orchestrator status
   */
  getStatus() {
    return {
      name: this.name,
      isRunning: this.isRunning,
      personalityMode: this.personalityMode,
      activeWorkflows: this.activeWorkflows.size,
      dbStats: db.getExecutionStats(24),
    };
  }

  /**
   * Get workflow details
   */
  getWorkflowDetails(workflowId: string): WorkflowState | undefined {
    return this.activeWorkflows.get(workflowId);
  }

  /**
   * Get recent workflows
   */
  getRecentWorkflows(limit: number = 10): WorkflowState[] {
    return Array.from(this.activeWorkflows.values()).slice(0, limit);
  }
}

export default AgentOrchestrator;
