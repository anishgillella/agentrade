import 'dotenv/config.js';
import { getRAGPipeline } from './src/infrastructure/rag_pipeline.js';

async function testRAG() {
  console.log('\n🧪 Testing RAG Pipeline Setup...\n');
  
  console.log('Environment Variables:');
  console.log(`  HF_TOKEN: ${process.env.HF_TOKEN ? '✓ Set' : '✗ Not set'}`);
  console.log(`  PINECONE_API_KEY: ${process.env.PINECONE_API_KEY ? '✓ Set' : '✗ Not set'}`);
  
  const rag = getRAGPipeline('all-mpnet-base-v2');
  console.log('\n✅ RAG Pipeline initialized with all-mpnet-base-v2 model');
  
  const stats = rag.getStats();
  console.log('\nRAG Pipeline Configuration:');
  console.log(`  Model: ${stats.embeddingModel}`);
  console.log(`  Dimensions: ${stats.embeddingDimensions}`);
  console.log(`  Documents Stored: ${stats.documentsStored}`);
  console.log(`  Model Description: ${stats.modelConfig?.description}`);
  
  console.log('\n✅ RAG Setup Complete!');
}

testRAG().catch(console.error);
