import { Kafka, Consumer, logLevel, EachMessagePayload } from 'kafkajs';
import { getLogger } from '../utils/logger.js';
import { KafkaError, ErrorCodes } from '../utils/errors.js';

const logger = getLogger('kafka-consumer');

/**
 * Message handler callback type
 */
export type MessageHandler = (
  topic: string,
  key: string,
  value: Record<string, unknown>,
  partition: number,
  offset: string
) => Promise<void>;

/**
 * Consumer configuration
 */
interface ConsumerConfig {
  brokers: string[];
  groupId: string;
  topics: string[];
  clientId: string;
  maxRetries?: number;
  connectionTimeout?: number;
  requestTimeout?: number;
  sessionTimeout?: number;
}

/**
 * Production-grade Kafka consumer
 * Handles message consumption, error handling, graceful shutdown, and processing
 */
export class KafkaConsumer {
  private kafka: Kafka;
  private consumer: Consumer;
  private isConnected: boolean = false;
  private isRunning: boolean = false;
  private messageHandler: MessageHandler | null = null;
  private topics: string[];

  constructor(config: ConsumerConfig) {
    this.topics = config.topics;

    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      connectionTimeout: config.connectionTimeout || 10000,
      requestTimeout: config.requestTimeout || 30000,
      logLevel: logLevel.ERROR,
      retry: {
        initialRetryTime: 100,
        retries: config.maxRetries || 3,
        maxRetryTime: 30000,
        multiplier: 2,
      },
    });

    this.consumer = this.kafka.consumer({
      groupId: config.groupId,
      sessionTimeout: config.sessionTimeout || 30000,
      heartbeatInterval: 3000,
      rebalanceTimeout: 60000,
    });

    logger.info('KafkaConsumer created', {
      brokers: config.brokers,
      groupId: config.groupId,
      topics: config.topics,
      clientId: config.clientId,
    });
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.debug('KafkaConsumer already connected');
      return;
    }

    try {
      await this.consumer.connect();
      this.isConnected = true;
      logger.info('KafkaConsumer connected successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to connect KafkaConsumer', { error: message });
      throw new KafkaError(
        ErrorCodes.KAFKA_CONNECTION_ERROR,
        `Failed to connect to Kafka: ${message}`,
        { topics: this.topics },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Subscribe to topics
   */
  async subscribe(): Promise<void> {
    if (!this.isConnected) {
      throw new KafkaError(
        ErrorCodes.KAFKA_CONSUMER_ERROR,
        'Consumer not connected. Call connect() first.',
        { topics: this.topics }
      );
    }

    try {
      await this.consumer.subscribe({
        topics: this.topics,
        fromBeginning: false,
      });
      logger.info('Subscribed to topics', { topics: this.topics });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to subscribe to topics', { error: message, topics: this.topics });
      throw new KafkaError(
        ErrorCodes.KAFKA_CONSUMER_ERROR,
        `Failed to subscribe to topics: ${message}`,
        { topics: this.topics },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Start consuming messages
   */
  async start(handler: MessageHandler): Promise<void> {
    if (!this.isConnected) {
      throw new KafkaError(
        ErrorCodes.KAFKA_CONSUMER_ERROR,
        'Consumer not connected. Call connect() and subscribe() first.',
        { topics: this.topics }
      );
    }

    if (this.isRunning) {
      logger.warn('Consumer already running');
      return;
    }

    this.messageHandler = handler;
    this.isRunning = true;

    logger.info('Starting message consumption', { topics: this.topics });

    try {
      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          await this.handleMessage(payload);
        },
        partitionsConsumedConcurrently: 3,
      });
    } catch (error) {
      this.isRunning = false;
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Consumer error', { error: message });
      throw new KafkaError(
        ErrorCodes.KAFKA_CONSUMER_ERROR,
        `Consumer error: ${message}`,
        { topics: this.topics },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;
    const key = message.key?.toString() || '';
    const offset = message.offset;

    try {
      const value = message.value ? JSON.parse(message.value.toString()) : {};

      logger.debug('Received message', {
        topic,
        partition,
        offset,
        key,
        valueSize: message.value?.length || 0,
      });

      if (this.messageHandler) {
        await this.messageHandler(topic, key, value, partition, offset);
      }

      logger.debug('Message processed successfully', {
        topic,
        offset,
        key,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Error processing message', {
        topic,
        partition,
        offset,
        key,
        error: errorMessage,
      });

      // Log but don't crash - consumer should continue running
      // In production, you might want to send to dead-letter queue
    }
  }

  /**
   * Disconnect consumer
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      logger.debug('KafkaConsumer not connected, skipping disconnect');
      return;
    }

    this.isRunning = false;

    try {
      await this.consumer.disconnect();
      this.isConnected = false;
      logger.info('KafkaConsumer disconnected successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error disconnecting KafkaConsumer', { error: message });
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down KafkaConsumer gracefully');
    await this.disconnect();
  }

  /**
   * Check if consumer is running
   */
  isRunning_(): boolean {
    return this.isRunning;
  }

  /**
   * Check if consumer is connected
   */
  isReady(): boolean {
    return this.isConnected;
  }

  /**
   * Get consumer metadata
   */
  getMetadata(): Record<string, unknown> {
    return {
      isConnected: this.isConnected,
      isRunning: this.isRunning,
      topics: this.topics,
    };
  }
}

/**
 * Factory function to create consumer from environment config
 */
export function createKafkaConsumer(
  groupId: string,
  topics: string[],
  clientId: string
): KafkaConsumer {
  const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',').map(b => b.trim());

  if (brokers.length === 0) {
    throw new KafkaError(
      ErrorCodes.KAFKA_CONNECTION_ERROR,
      'No Kafka brokers configured in KAFKA_BROKERS environment variable',
      { brokers: [] }
    );
  }

  return new KafkaConsumer({
    brokers,
    groupId,
    topics,
    clientId,
    maxRetries: parseInt(process.env.KAFKA_MAX_RETRIES || '3', 10),
    connectionTimeout: parseInt(process.env.KAFKA_CONNECTION_TIMEOUT || '10000', 10),
    requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT || '30000', 10),
    sessionTimeout: parseInt(process.env.KAFKA_SESSION_TIMEOUT || '30000', 10),
  });
}

export default KafkaConsumer;
