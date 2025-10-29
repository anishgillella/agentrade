import { getLogger } from './logger.js';

const logger = getLogger('errors');

/**
 * Error codes for the system
 * Used for categorizing errors and API responses
 */
export const ErrorCodes = {
  // Configuration errors
  CONFIG_ERROR: 'CONFIG_ERROR',
  MISSING_API_KEY: 'MISSING_API_KEY',
  
  // Kafka errors
  KAFKA_CONNECTION_ERROR: 'KAFKA_CONNECTION_ERROR',
  KAFKA_PRODUCER_ERROR: 'KAFKA_PRODUCER_ERROR',
  KAFKA_CONSUMER_ERROR: 'KAFKA_CONSUMER_ERROR',
  KAFKA_MESSAGE_VALIDATION_ERROR: 'KAFKA_MESSAGE_VALIDATION_ERROR',
  
  // LLM errors
  LLM_API_ERROR: 'LLM_API_ERROR',
  LLM_TIMEOUT_ERROR: 'LLM_TIMEOUT_ERROR',
  LLM_PARSING_ERROR: 'LLM_PARSING_ERROR',
  
  // Database errors
  DATABASE_CONNECTION_ERROR: 'DATABASE_CONNECTION_ERROR',
  DATABASE_QUERY_ERROR: 'DATABASE_QUERY_ERROR',
  
  // Business logic errors
  INVALID_SIGNAL: 'INVALID_SIGNAL',
  INVALID_TRADE: 'INVALID_TRADE',
  POSITION_SIZE_ERROR: 'POSITION_SIZE_ERROR',
  
  // Agent errors
  AGENT_ERROR: 'AGENT_ERROR',
  AGENT_NOT_RUNNING: 'AGENT_NOT_RUNNING',
  AGENT_INITIALIZATION_ERROR: 'AGENT_INITIALIZATION_ERROR',
  AGENT_START_ERROR: 'AGENT_START_ERROR',
  AGENT_STOP_ERROR: 'AGENT_STOP_ERROR',
  AGENT_PROCESSING_ERROR: 'AGENT_PROCESSING_ERROR',
  
  // Generic errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Base application error class
 * All errors in the system should extend this
 */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public statusCode: number = 500,
    public context?: Record<string, unknown>,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined,
    };
  }
}

/**
 * Configuration error
 */
export class ConfigError extends AppError {
  constructor(message: string, context?: Record<string, unknown>, originalError?: Error) {
    super(ErrorCodes.CONFIG_ERROR, message, 500, context, originalError);
    this.name = 'ConfigError';
  }
}

/**
 * Kafka-related errors
 */
export class KafkaError extends AppError {
  constructor(code: ErrorCode, message: string, context?: Record<string, unknown>, originalError?: Error) {
    super(code, message, 500, context, originalError);
    this.name = 'KafkaError';
  }
}

/**
 * LLM API errors
 */
export class LLMError extends AppError {
  constructor(code: ErrorCode, message: string, statusCode: number = 500, context?: Record<string, unknown>, originalError?: Error) {
    super(code, message, statusCode, context, originalError);
    this.name = 'LLMError';
  }
}

/**
 * Database errors
 */
export class DatabaseError extends AppError {
  constructor(code: ErrorCode, message: string, context?: Record<string, unknown>, originalError?: Error) {
    super(code, message, 500, context, originalError);
    this.name = 'DatabaseError';
  }
}

/**
 * Agent-related errors
 */
export class AgentError extends AppError {
  constructor(code: ErrorCode, message: string, statusCode: number = 500, context?: Record<string, unknown>, originalError?: Error) {
    super(code, message, statusCode, context, originalError);
    this.name = 'AgentError';
  }
}

/**
 * Validation errors (can be 400 status)
 */
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(ErrorCodes.INVALID_SIGNAL, message, 400, context);
    this.name = 'ValidationError';
  }
}

/**
 * Global error handler
 * Logs errors with context and returns standardized error response
 */
export function handleError(error: unknown): AppError {
  // Already an AppError
  if (error instanceof AppError) {
    logger.error(
      {
        code: error.code,
        message: error.message,
        context: error.context,
        stack: error.stack,
      },
      `AppError occurred: ${error.code}`
    );
    return error;
  }

  // Standard Error
  if (error instanceof Error) {
    logger.error(
      {
        message: error.message,
        stack: error.stack,
      },
      `Unhandled Error: ${error.message}`
    );
    
    return new AppError(
      ErrorCodes.UNKNOWN_ERROR,
      error.message,
      500,
      { originalMessage: error.message },
      error
    );
  }

  // Unknown error type
  logger.error({ error }, 'Unknown error type');
  return new AppError(
    ErrorCodes.UNKNOWN_ERROR,
    'An unexpected error occurred',
    500,
    { unknownError: String(error) }
  );
}

/**
 * Retry logic with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  context?: string
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        logger.warn(
          { attempt, delay, error: lastError.message, context },
          `Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new AppError(
    ErrorCodes.UNKNOWN_ERROR,
    `Failed after ${maxRetries} retries: ${lastError?.message}`,
    500,
    { context, retries: maxRetries },
    lastError
  );
}

export default {
  ErrorCodes,
  AppError,
  ConfigError,
  KafkaError,
  LLMError,
  DatabaseError,
  AgentError,
  ValidationError,
  handleError,
  retryWithBackoff,
};
