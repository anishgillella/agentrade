import { z } from 'zod';
import { getLogger } from '../utils/logger.js';

// Load environment variables from .env file
import 'dotenv/config.js';

const logger = getLogger('config');

/**
 * Zod schema for environment variables validation
 * Ensures all required variables are present and correctly typed
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  
  // Server
  BACKEND_PORT: z.coerce.number().default(3000),
  BACKEND_URL: z.string().url().default('http://localhost:3000'),
  
  // Kafka
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_GROUP_ID: z.string().default('ai-trading-group'),
  
  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_DB: z.coerce.number().default(0),
  REDIS_PASSWORD: z.string().optional(),
  
  // Database
  SQLITE_DB_PATH: z.string().default('./data/trades.db'),
  LANCEDB_PATH: z.string().default('./data/lancedb'),
  
  // LLM
  LLM_PROVIDER: z.enum(['claude', 'openai']).default('claude'),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  
  // Trading
  TRADING_MODE: z.enum(['paper', 'live']).default('paper'),
  BINANCE_API_KEY: z.string().optional(),
  BINANCE_API_SECRET: z.string().optional(),
  BINANCE_TEST_NET: z.enum(['true', 'false']).default('true'),
  
  // News Sources
  REDDIT_CLIENT_ID: z.string().optional(),
  REDDIT_CLIENT_SECRET: z.string().optional(),
  REDDIT_USER_AGENT: z.string().optional(),
  TWITTER_API_KEY: z.string().optional(),
  TWITTER_API_SECRET: z.string().optional(),
  NEWSAPI_KEY: z.string().optional(),
  
  // Parallel API
  PARALLEL_API_KEY: z.string().optional(),
  
  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  
  // Feature Flags
  ENABLE_RESEARCH_AGENT: z.enum(['true', 'false']).default('false'),
  ENABLE_RL_LOOP: z.enum(['true', 'false']).default('false'),
  ENABLE_BACKTESTING: z.enum(['true', 'false']).default('true'),
});

type EnvConfig = z.infer<typeof EnvSchema>;

/**
 * Load and validate environment variables
 */
function loadConfig(): EnvConfig {
  try {
    const config = EnvSchema.parse(process.env);
    logger.info('Configuration loaded successfully');
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Configuration validation failed:', error.errors);
      throw new Error(`Invalid configuration: ${error.message}`);
    }
    throw error;
  }
}

// Load configuration on module import
const config = loadConfig();

/**
 * Application configuration object
 * Type-safe, validated, and centralized
 */
export const AppConfig = {
  env: {
    isDevelopment: config.NODE_ENV === 'development',
    isStaging: config.NODE_ENV === 'staging',
    isProduction: config.NODE_ENV === 'production',
    nodeEnv: config.NODE_ENV,
  },
  
  server: {
    port: config.BACKEND_PORT,
    url: config.BACKEND_URL,
  },
  
  kafka: {
    brokers: config.KAFKA_BROKERS.split(','),
    groupId: config.KAFKA_GROUP_ID,
    topics: {
      rawNews: 'raw_news',
      processedSignals: 'processed_signals',
      tradeSignals: 'trade_signals',
      validatedTrades: 'validated_trades',
      executedTrades: 'executed_trades',
      deadLetter: 'dead-letter-queue',
    },
  },
  
  redis: {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    db: config.REDIS_DB,
    password: config.REDIS_PASSWORD,
  },
  
  database: {
    sqlite: {
      path: config.SQLITE_DB_PATH,
    },
    lancedb: {
      path: config.LANCEDB_PATH,
    },
  },
  
  llm: {
    provider: config.LLM_PROVIDER,
    anthropic: {
      apiKey: config.ANTHROPIC_API_KEY,
    },
    openai: {
      apiKey: config.OPENAI_API_KEY,
    },
    openrouter: {
      apiKey: config.OPENROUTER_API_KEY,
    },
  },
  
  trading: {
    mode: config.TRADING_MODE,
    binance: {
      apiKey: config.BINANCE_API_KEY,
      apiSecret: config.BINANCE_API_SECRET,
      testNet: config.BINANCE_TEST_NET === 'true',
    },
  },
  
  newsSources: {
    reddit: {
      clientId: config.REDDIT_CLIENT_ID,
      clientSecret: config.REDDIT_CLIENT_SECRET,
    },
    twitter: {
      apiKey: config.TWITTER_API_KEY,
      apiSecret: config.TWITTER_API_SECRET,
    },
    newsapi: {
      key: config.NEWSAPI_KEY,
    },
  },
  
  parallel: {
    apiKey: config.PARALLEL_API_KEY,
  },
  
  logging: {
    level: config.LOG_LEVEL,
    format: config.LOG_FORMAT,
  },
  
  features: {
    researchAgent: config.ENABLE_RESEARCH_AGENT === 'true',
    rlLoop: config.ENABLE_RL_LOOP === 'true',
    backtesting: config.ENABLE_BACKTESTING === 'true',
  },
} as const;

export type AppConfigType = typeof AppConfig;

export default AppConfig;
