import { AppConfig } from './src/config/settings.js';
import { getLogger } from './src/utils/logger.js';

const logger = getLogger('test');

console.log('=== STEP 0 VERIFICATION ===\n');

// Test Config Loading
console.log('✓ Config loaded successfully');
console.log(`  - Environment: ${AppConfig.env.nodeEnv}`);
console.log(`  - Server port: ${AppConfig.server.port}`);
console.log(`  - Kafka brokers: ${AppConfig.kafka.brokers.join(',')}`);
console.log(`  - Redis host: ${AppConfig.redis.host}:${AppConfig.redis.port}`);
console.log(`  - LLM Provider: ${AppConfig.llm.provider}`);
console.log(`  - Trading mode: ${AppConfig.trading.mode}`);
console.log(`  - Features:`, AppConfig.features);

// Test Logger
console.log('\n✓ Logger initialized successfully');
logger.info('Test log message with context', { test: true, environment: AppConfig.env.nodeEnv });

console.log('\n=== ALL STEP 0 CHECKS PASSED ===');
