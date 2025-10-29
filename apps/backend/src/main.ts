/**
 * Main CLI entry point - Start agents or orchestrator from command line
 * Usage:
 *   npm run start:orchestrator                          - Start full orchestrator
 *   npm run start -- orchestrator --personality buffett - Start with specific personality
 *   npm run start:news                                  - Start only News Agent
 *   npm run start:investment                            - Start only Investment Agent
 */

import { createNewsAgent } from './agents/news_agent.js';
import { createLLMClient } from './infrastructure/llm_client.js';
import { createKafkaProducer } from './infrastructure/kafka_producer.js';
import { createKafkaConsumer } from './infrastructure/kafka_consumer.js';
import { getLogger } from './utils/logger.js';
import * as db from './infrastructure/database.js';
import { createInvestmentAgent } from './agents/investment_agent.js';
import { AgentOrchestrator } from './orchestrator/agent_orchestrator.js';
import { startAPIServer } from './api.js';

const logger = getLogger('main');

// Parse CLI arguments
const args = process.argv.slice(2);
const AGENT_TYPE = args[0] || 'orchestrator';
const PERSONALITY_MODE = args.includes('--personality')
  ? args[args.indexOf('--personality') + 1] || 'buffett'
  : process.env.PERSONALITY_MODE || 'buffett';

async function startOrchestrator(personalityMode: string = 'buffett') {
  try {
    logger.info(`🚀 Starting Agent Orchestrator with personality: ${personalityMode}`);

    // Start API server first
    logger.info('Starting API server...');
    await startAPIServer();

    const llmClient = createLLMClient();
    const producer = createKafkaProducer('orchestrator-producer');
    const consumer = createKafkaConsumer('orchestrator-group', ['raw_news'], 'orchestrator-consumer');
    
    const orchestrator = new AgentOrchestrator(
      producer,
      consumer,
      llmClient,
      personalityMode as any
    );

    // Initialize orchestrator
    await orchestrator.initialize();
    logger.info('✓ Orchestrator initialized');

    // Start orchestrator
    await orchestrator.start();

    logger.info('✅ Agent Orchestrator running');
    logger.info('📊 Workflow: News → Investment → Personality → Database');
    logger.info(`💡 Personality Mode: ${personalityMode}`);

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down Agent Orchestrator gracefully...');
      await orchestrator.stop();
      logger.info('✓ Orchestrator stopped');
      db.closeDatabase();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start orchestrator', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    process.exit(1);
  }
}

async function startAgent(type: string) {
  try {
    logger.info(`Starting agent: ${type}`);

    switch (type) {
      case 'news-agent':
      case 'news':
        await startNewsAgent();
        break;
      case 'investment-agent':
      case 'investment':
        await startInvestmentAgent();
        break;
      case 'personality-agent':
      case 'personality':
        logger.error('Use "orchestrator" mode to run Personality Agent with other agents');
        console.log('\nUsage:');
        console.log('  npm run start -- orchestrator                            (Start full orchestrator)');
        console.log('  npm run start -- orchestrator --personality buffett      (With specific personality)');
        process.exit(1);
        break;
      case 'orchestrator':
        await startOrchestrator(PERSONALITY_MODE);
        break;
      default:
        logger.error(`Unknown agent type: ${type}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    logger.error('Failed to start agent', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    process.exit(1);
  }
}

async function startNewsAgent() {
  try {
    logger.info('🚀 Starting News Agent...');

    const llmClient = createLLMClient();
    const producer = createKafkaProducer('news-agent-producer');
    const consumer = createKafkaConsumer('news-agent-group', ['raw_news'], 'news-agent-consumer');
    const newsAgent = createNewsAgent(producer, consumer, llmClient);

    // Initialize database
    db.initializeDatabase();
    logger.info('✓ Database initialized');

    // Initialize
    await newsAgent.initialize();
    logger.info('✓ News Agent initialized');

    // Start fetching news every 2 minutes
    logger.info('✓ Starting news fetch loop (every 2 minutes)');
    
    setInterval(async () => {
      try {
        await newsAgent.fetchAndQueueNews();
      } catch (error) {
        logger.error('Error fetching news', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }, 2 * 60 * 1000); // 2 minutes

    // Also fetch immediately on startup
    await newsAgent.fetchAndQueueNews();

    // Start consuming messages (though News Agent mainly produces to raw_news)
    await newsAgent.start();

    logger.info('✅ News Agent running and ready to process articles');
    logger.info('📰 Fetching news every 2 minutes from NewsAPI and Reddit');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down News Agent gracefully...');
      await newsAgent.stop();
      logger.info('✓ News Agent stopped');
      db.closeDatabase();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start News Agent', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw error;
  }
}

async function startInvestmentAgent() {
  try {
    logger.info('🚀 Starting Investment Agent...');

    const llmClient = createLLMClient();
    const producer = createKafkaProducer('investment-agent-producer');
    const consumer = createKafkaConsumer('investment-agent-group', ['investment_data'], 'investment-agent-consumer');
    const investmentAgent = createInvestmentAgent(producer, consumer, llmClient);

    // Initialize database
    db.initializeDatabase();
    logger.info('✓ Database initialized');

    // Initialize
    await investmentAgent.initialize();
    logger.info('✓ Investment Agent initialized');

    // Start consuming messages
    await investmentAgent.start();

    logger.info('✅ Investment Agent running and ready to process investment data');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down Investment Agent gracefully...');
      await investmentAgent.stop();
      logger.info('✓ Investment Agent stopped');
      db.closeDatabase();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start Investment Agent', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw error;
  }
}

function printUsage() {
  console.log('\n=== 📋 AI Trading System - CLI Usage ===\n');
  console.log('Orchestrator (Full Workflow):');
  console.log('  npm run start -- orchestrator                            (Start with default Buffett mode)');
  console.log('  npm run start -- orchestrator --personality buffett      (Conservative - long-term value)');
  console.log('  npm run start -- orchestrator --personality soros        (Aggressive - momentum plays)');
  console.log('  npm run start -- orchestrator --personality cathie       (Innovation-focused - growth)');
  console.log('  npm run start -- orchestrator --personality contrarian   (Against crowd - value plays)\n');
  console.log('Environment Variables:');
  console.log('  PERSONALITY_MODE=buffett|soros|cathie|contrarian        (Sets default personality)\n');
  console.log('Individual Agents (Legacy):');
  console.log('  npm run start:news                  (Start News Agent only)');
  console.log('  npm run start:investment            (Start Investment Agent only)\n');
}

// Start the requested agent or orchestrator
startAgent(AGENT_TYPE);
