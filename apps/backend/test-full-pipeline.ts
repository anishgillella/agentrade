import { createNewsAgent } from './src/agents/news_agent.js';
import { createInvestmentAgent } from './src/agents/investment_agent.js';
import { createLLMClient } from './src/infrastructure/llm_client.js';
import { createKafkaProducer } from './src/infrastructure/kafka_producer.js';
import { createKafkaConsumer } from './src/infrastructure/kafka_consumer.js';
import * as db from './src/infrastructure/database.js';
import { getLogger } from './src/utils/logger.js';

const logger = getLogger('pipeline-test');

async function testFullPipeline() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         FULL PIPELINE TEST - NEWS → INVESTMENT AGENT        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Initialize database
    db.initializeDatabase();
    console.log('✓ Database initialized\n');

    // ═══════════════════════════════════════════════════════════════════
    console.log('┌─ STAGE 1: NEWS AGENT ─────────────────────────────────────┐');
    console.log('│ Fetches articles from NewsAPI & Reddit                     │');
    console.log('│ Analyzes sentiment with LLM                                │');
    console.log('└────────────────────────────────────────────────────────────┘\n');

    const llmClient = createLLMClient();
    const newsProducer = createKafkaProducer('news-agent-producer-test');
    const newsConsumer = createKafkaConsumer('news-agent-group-test', ['raw_news'], 'news-consumer-test');
    const newsAgent = createNewsAgent(newsProducer, newsConsumer, llmClient);

    await newsAgent.initialize();
    console.log('✓ News Agent initialized\n');

    const sampleArticle = {
      headline: 'Bitcoin Surges Past $45,000 on Positive Macro Signals',
      url: 'https://example.com/btc-news',
      source: 'NewsAPI - CryptoNews',
      timestamp: new Date(),
      content: 'Bitcoin has broken through the $45,000 resistance level following positive macroeconomic indicators...',
      author: 'John Doe',
    };

    console.log('🔍 Processing sample article:');
    console.log(`   Headline: "${sampleArticle.headline}"`);
    console.log(`   Source: ${sampleArticle.source}\n`);

    const testNewsState = {
      messages: [],
      data: {},
      agent_name: 'news-agent',
      step_count: 0,
      is_complete: false,
      error: null,
      raw_article: sampleArticle,
    };

    const newsResult = await newsAgent['processNode'](testNewsState);

    if (newsResult?.signal) {
      console.log('✅ NEWS AGENT OUTPUT (Sentiment Signal):\n');
      console.log('   ┌─ Signal to Kafka: processed_signals ─┐');
      console.log(`   │ Ticker:     ${newsResult.signal.ticker}`);
      console.log(`   │ Sentiment:  ${newsResult.signal.sentiment_score}`);
      console.log(`   │ Confidence: ${newsResult.signal.confidence}`);
      console.log(`   │ Impact:     ${newsResult.signal.impact_level}`);
      console.log('   └────────────────────────────────────┘\n');
    }

    // ═══════════════════════════════════════════════════════════════════
    console.log('┌─ STAGE 2: KAFKA BROKER ────────────────────────────────────┐');
    console.log('│ Stores sentiment signals temporarily                       │');
    console.log('│ Routes messages between agents                             │');
    console.log('└────────────────────────────────────────────────────────────┘\n');

    console.log('📡 Kafka Topics:');
    console.log('   ├─ raw_news');
    console.log('   ├─ processed_signals');
    console.log('   └─ trade_signals\n');

    // ═══════════════════════════════════════════════════════════════════
    console.log('┌─ STAGE 3: INVESTMENT AGENT ────────────────────────────────┐');
    console.log('│ Consumes sentiment signals from Kafka                      │');
    console.log('│ Fetches technical data from CoinGecko (RSI, SMA)           │');
    console.log('│ Fuses signals with LLM reasoning                           │');
    console.log('└────────────────────────────────────────────────────────────┘\n');

    const investmentProducer = createKafkaProducer('investment-agent-producer-test');
    const investmentConsumer = createKafkaConsumer('investment-agent-group-test', ['processed_signals'], 'investment-consumer-test');
    const investmentAgent = createInvestmentAgent(investmentProducer, investmentConsumer, llmClient);

    await investmentAgent.initialize();
    console.log('✓ Investment Agent initialized\n');

    console.log('💰 Processing signal through Investment Agent...\n');
    const investmentState = {
      messages: [],
      data: newsResult?.signal || {},
      agent_name: 'investment-agent',
      step_count: 0,
      is_complete: false,
      error: null,
    };

    const investmentResult = await investmentAgent['processNode'](investmentState);

    if (investmentResult?.data) {
      const rec = investmentResult.data as any;
      console.log('✅ INVESTMENT AGENT OUTPUT (Trade Recommendation):\n');
      console.log('   ┌─ Signal to Kafka: trade_signals ─┐');
      console.log(`   │ Ticker:     ${rec.ticker}`);
      console.log(`   │ Action:     ${rec.action}`);
      console.log(`   │ Confidence: ${rec.confidence}`);
      console.log(`   │ RSI:        ${rec.rsi?.toFixed(2) || 'N/A'}`);
      console.log(`   │ SMA20:      ${rec.sma20?.toFixed(2) || 'N/A'}`);
      console.log('   └─────────────────────────────────┘\n');
    }

    // ═══════════════════════════════════════════════════════════════════
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                  COMPLETE DATA FLOW                         ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║                                                            ║');
    console.log('║  NewsAPI/Reddit  →  [News Agent]  →  Sentiment Signal     ║');
    console.log('║                           ↓                                ║');
    console.log('║                  [Kafka: processed_signals]               ║');
    console.log('║                           ↓                                ║');
    console.log('║  CoinGecko Data  →  [Investment Agent]  →  Trade Signal   ║');
    console.log('║                           ↓                                ║');
    console.log('║                  [Kafka: trade_signals]                   ║');
    console.log('║                           ↓                                ║');
    console.log('║                  [Database] → Backtesting                  ║');
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('✅ FULL PIPELINE TEST COMPLETE!\n');

    await newsAgent.stop();
    await investmentAgent.stop();

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : error);
  }
}

testFullPipeline();
