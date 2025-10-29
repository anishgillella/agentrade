import { Kafka, Producer, logLevel } from 'kafkajs';
import { getLogger } from '../utils/logger.js';
import { KafkaError, ErrorCodes, retryWithBackoff } from '../utils/errors.js';

const logger = getLogger('kafka-producer');

export interface KafkaMessage<T = Record<string, unknown>> {
  key: string;
  value: T;
  headers?: Record<string, string>;
  timestamp?: number;
}

interface ProducerConfig {
  brokers: string[];
  clientId: string;
  maxRetries?: number;
  connectionTimeout?: number;
  requestTimeout?: number;
}

export class KafkaProducer {
  private kafka: Kafka;
  private producer: Producer;
  private maxRetries: number;
  private isConnected: boolean = false;

  constructor(config: ProducerConfig) {
    this.maxRetries = config.maxRetries || 3;

    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      connectionTimeout: config.connectionTimeout || 10000,
      requestTimeout: config.requestTimeout || 30000,
      logLevel: logLevel.ERROR,
      retry: {
        initialRetryTime: 100,
        retries: this.maxRetries,
        maxRetryTime: 30000,
        multiplier: 2,
      },
    });

    this.producer = this.kafka.producer({
      transactionTimeout: 30000,
      maxInFlightRequests: 5,
      idempotent: true,
    });

    logger.info('KafkaProducer created', {
      brokers: config.brokers,
      clientId: config.clientId,
      maxRetries: this.maxRetries,
    });
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.debug('KafkaProducer already connected');
      return;
    }

    try {
      await this.producer.connect();
      this.isConnected = true;
      logger.info('KafkaProducer connected successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to connect KafkaProducer', { error: message });
      throw new KafkaError(
        ErrorCodes.KAFKA_CONNECTION_ERROR,
        `Failed to connect to Kafka: ${message}`,
        { component: 'KafkaProducer' },
        error instanceof Error ? error : undefined
      );
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      logger.debug('KafkaProducer not connected, skipping disconnect');
      return;
    }

    try {
      await this.producer.disconnect();
      this.isConnected = false;
      logger.info('KafkaProducer disconnected successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error disconnecting KafkaProducer', { error: message });
    }
  }

  async send<T>(topic: string, message: KafkaMessage<T>): Promise<void> {
    if (!this.isConnected) {
      throw new KafkaError(
        ErrorCodes.KAFKA_PRODUCER_ERROR,
        'Producer not connected. Call connect() first.',
        { topic }
      );
    }

    logger.debug('Sending message to Kafka', { topic, key: message.key });

    return retryWithBackoff(
      async () => {
        try {
          const recordValue = JSON.stringify(message.value);

          await this.producer.send({
            topic,
            messages: [
              {
                key: message.key,
                value: recordValue,
                headers: message.headers,
                timestamp: message.timestamp ? String(message.timestamp) : undefined,
              },
            ],
          });

          logger.debug('Message sent successfully', { topic, key: message.key });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new KafkaError(
            ErrorCodes.KAFKA_PRODUCER_ERROR,
            `Failed to send message: ${errorMessage}`,
            { topic },
            error instanceof Error ? error : undefined
          );
        }
      },
      this.maxRetries,
      1000,
      `kafka-produce-${topic}`
    );
  }

  async sendBatch<T>(topic: string, messages: KafkaMessage<T>[]): Promise<void> {
    if (!this.isConnected) {
      throw new KafkaError(
        ErrorCodes.KAFKA_PRODUCER_ERROR,
        'Producer not connected',
        { topic, count: messages.length }
      );
    }

    if (messages.length === 0) return;

    return retryWithBackoff(
      async () => {
        try {
          const kafkaMessages = messages.map(msg => ({
            key: msg.key,
            value: JSON.stringify(msg.value),
            headers: msg.headers,
            timestamp: msg.timestamp ? String(msg.timestamp) : undefined,
          }));

          await this.producer.send({ topic, messages: kafkaMessages });

          logger.debug('Batch sent', { topic, count: messages.length });
        } catch (error) {
          throw error;
        }
      },
      this.maxRetries,
      1000,
      `kafka-batch-${topic}`
    );
  }

  isReady(): boolean {
    return this.isConnected;
  }

  getMetadata(): Record<string, unknown> {
    return { isConnected: this.isConnected };
  }
}

export function createKafkaProducer(clientId: string): KafkaProducer {
  const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',').map(b => b.trim());

  if (brokers.length === 0) {
    throw new KafkaError(
      ErrorCodes.KAFKA_CONNECTION_ERROR,
      'No Kafka brokers configured',
      { brokers: [] }
    );
  }

  return new KafkaProducer({ brokers, clientId });
}

export default KafkaProducer;
