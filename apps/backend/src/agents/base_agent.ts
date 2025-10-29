/**
 * Base Agent Class - Abstract foundation for all LLM agents using LangGraph
 * Provides Kafka I/O, LLM interaction, and state management
 */

import { getLogger } from '../utils/logger.js';
import { AgentError, ErrorCodes } from '../utils/errors.js';
import { LLMClient } from '../infrastructure/llm_client.js';
import { KafkaProducer } from '../infrastructure/kafka_producer.js';
import { KafkaConsumer, MessageHandler } from '../infrastructure/kafka_consumer.js';
import { AgentState, SpecificAgentState } from './agent_state.js';

const logger = getLogger('base-agent');

/**
 * Base Agent Configuration
 */
export interface BaseAgentConfig {
  name: string;
  inputTopic: string;
  outputTopic: string;
  systemPrompt: string;
  maxSteps?: number;
  timeout?: number;
}

/**
 * Abstract Base Agent using LangGraph concepts for state management
 * All specific agents (News, Investment, Personality) extend this
 */
export abstract class BaseAgent {
  protected name: string;
  protected inputTopic: string;
  protected outputTopic: string;
  protected systemPrompt: string;
  protected maxSteps: number;
  protected timeout: number;

  protected producer: KafkaProducer;
  protected consumer: KafkaConsumer;
  protected llmClient: LLMClient;

  protected isRunning: boolean = false;
  protected messageBuffer: AgentState[] = [];

  constructor(
    config: BaseAgentConfig,
    producer: KafkaProducer,
    consumer: KafkaConsumer,
    llmClient: LLMClient
  ) {
    this.name = config.name;
    this.inputTopic = config.inputTopic;
    this.outputTopic = config.outputTopic;
    this.systemPrompt = config.systemPrompt;
    this.maxSteps = config.maxSteps || 10;
    this.timeout = config.timeout || 30000;

    this.producer = producer;
    this.consumer = consumer;
    this.llmClient = llmClient;

    logger.info(`BaseAgent initialized: ${this.name}`, {
      inputTopic: this.inputTopic,
      outputTopic: this.outputTopic,
      maxSteps: this.maxSteps,
    });
  }

  /**
   * Initialize the agent
   * Sets up Kafka producer/consumer
   */
  async initialize(): Promise<void> {
    try {
      logger.info(`Initializing agent: ${this.name}`);

      // Connect Kafka producer
      await this.producer.connect();
      logger.debug(`Producer connected for ${this.name}`);

      // Connect Kafka consumer
      await this.consumer.connect();
      await this.consumer.subscribe();
      logger.debug(`Consumer connected and subscribed to ${this.inputTopic}`);

      logger.info(`Agent initialized successfully: ${this.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to initialize agent ${this.name}`, { error: message });
      throw new AgentError(
        ErrorCodes.AGENT_INITIALIZATION_ERROR,
        `Failed to initialize agent ${this.name}: ${message}`,
        500,
        { agent: this.name, error: message }
      );
    }
  }

  /**
   * Start the agent - begins consuming from Kafka
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn(`Agent ${this.name} is already running`);
      return;
    }

    try {
      logger.info(`Starting agent: ${this.name}`);
      this.isRunning = true;

      // Create message handler
      const messageHandler: MessageHandler = async (
        topic: string,
        key: string,
        value: Record<string, unknown>,
        partition: number,
        offset: string
      ) => {
        await this.handleMessage(topic, key, value, partition, offset);
      };

      // Start consuming
      await this.consumer.start(messageHandler);
      logger.info(`Agent started and consuming from ${this.inputTopic}: ${this.name}`);
    } catch (error) {
      this.isRunning = false;
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to start agent ${this.name}`, { error: message });
      throw new AgentError(
        ErrorCodes.AGENT_START_ERROR,
        `Failed to start agent ${this.name}: ${message}`,
        500,
        { agent: this.name, error: message }
      );
    }
  }

  /**
   * Stop the agent - gracefully shutdown
   */
  async stop(): Promise<void> {
    try {
      logger.info(`Stopping agent: ${this.name}`);
      this.isRunning = false;

      await this.consumer.shutdown();
      logger.debug(`Consumer shutdown for ${this.name}`);

      await this.producer.disconnect();
      logger.debug(`Producer disconnected for ${this.name}`);

      logger.info(`Agent stopped: ${this.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error stopping agent ${this.name}`, { error: message });
      throw new AgentError(
        ErrorCodes.AGENT_STOP_ERROR,
        `Error stopping agent ${this.name}: ${message}`,
        500,
        { agent: this.name, error: message }
      );
    }
  }

  /**
   * Handle incoming Kafka message
   */
  protected async handleMessage(
    topic: string,
    key: string,
    value: Record<string, unknown>,
    partition: number,
    offset: string
  ): Promise<void> {
    try {
      if (!value) {
        logger.warn(`Empty message value from ${topic}`);
        return;
      }

      const data = value as Record<string, unknown>;

      logger.debug(`Processing message from ${topic}`, {
        key,
        partition,
      });

      // Initialize agent state
      const state: AgentState = {
        messages: [],
        data,
        agent_name: this.name,
        step_count: 0,
        is_complete: false,
        error: null,
        kafka_key: key,
        kafka_topic: topic,
        kafka_partition: partition,
        kafka_offset: parseInt(offset, 10),
      };

      // Process through graph/reasoning
      const result = await this.processState(state);

      // Emit output to Kafka
      if (result && !result.error) {
        await this.emitOutput(key, result.data);
        logger.debug(`Message processed successfully for ${this.name}`);
      } else {
        logger.error(`Error processing message for ${this.name}`, {
          error: result?.error,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to handle message for ${this.name}`, { error: message });
    }
  }

  /**
   * Process state through reasoning loops
   */
  protected async processState(state: AgentState): Promise<AgentState> {
    try {
      // Call the abstract process node (implemented by specific agents)
      const result = await this.processNode(state);
      return result || state;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ...state,
        error: message,
        is_complete: true,
      };
    }
  }

  /**
   * Abstract process node - implemented by specific agents
   * This is where LangGraph-style reasoning loops are defined
   */
  protected abstract processNode(state: AgentState): Promise<AgentState | SpecificAgentState | null>;

  /**
   * Emit processed output to Kafka
   */
  protected async emitOutput(key: string, value: Record<string, unknown>): Promise<void> {
    try {
      await this.producer.send(this.outputTopic, {
        key,
        value,
        timestamp: Date.now(),
      });

      logger.debug(`Output emitted to ${this.outputTopic}`, { key });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to emit output for ${this.name}`, {
        topic: this.outputTopic,
        error: message,
      });
      throw error;
    }
  }

  /**
   * Invoke LLM with agent system prompt
   */
  protected async invokeLLM(
    prompt: string,
    additionalSystemPrompt?: string
  ): Promise<string> {
    try {
      const systemPrompt = additionalSystemPrompt
        ? `${this.systemPrompt}\n\n${additionalSystemPrompt}`
        : this.systemPrompt;

      const response = await this.llmClient.invoke(prompt, systemPrompt);
      return response.content;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`LLM invocation failed for ${this.name}`, { error: message });
      throw error;
    }
  }

  /**
   * Stream LLM response
   */
  protected async *streamLLM(
    prompt: string,
    additionalSystemPrompt?: string
  ): AsyncGenerator<string> {
    try {
      const systemPrompt = additionalSystemPrompt
        ? `${this.systemPrompt}\n\n${additionalSystemPrompt}`
        : this.systemPrompt;

      yield* this.llmClient.streamInvoke(prompt, systemPrompt);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`LLM streaming failed for ${this.name}`, { error: message });
      throw error;
    }
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      name: this.name,
      isRunning: this.isRunning,
      inputTopic: this.inputTopic,
      outputTopic: this.outputTopic,
      messageBufferSize: this.messageBuffer.length,
    };
  }
}

export default BaseAgent;
