/**
 * RAG Pipeline - Retrieval Augmented Generation
 * Combines vector search with LLM for context-aware decisions
 * 
 * Uses:
 * - HuggingFace Inference API for embeddings
 * - Pinecone for vector database
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('rag-pipeline');

// Get API keys from environment
const HF_API_KEY = process.env.HF_TOKEN;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'trading-signals';

// ════════════════════════════════════════════════════════════════════════════
// EMBEDDING MODELS (HuggingFace)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Recommended HuggingFace Embedding Models for Trading/Finance:
 * 
 * 1. all-mpnet-base-v2 (BEST for general use)
 *    - 768 dimensions
 *    - High quality, fast
 *    - Good for semantic search
 *    - ~70MB model size
 *
 * 2. all-MiniLM-L6-v2 (BEST for speed/cost)
 *    - 384 dimensions
 *    - Smaller, faster
 *    - Good accuracy/speed tradeoff
 *    - ~22MB model size
 *
 * 3. FinBERT (BEST for financial domain)
 *    - 768 dimensions
 *    - Fine-tuned on financial texts
 *    - Best for trading signals
 *    - Domain-specific
 *
 * 4. DPR (Dense Passage Retrieval)
 *    - Optimized for retrieval
 *    - Good for long documents
 *
 * RECOMMENDATION FOR TRADING:
 * → Use FinBERT for maximum accuracy on financial news
 * → Use all-mpnet-base-v2 as fallback (better general quality)
 * → Use all-MiniLM-L6-v2 for cost optimization
 */

export interface EmbeddingConfig {
  model: 'all-mpnet-base-v2' | 'all-MiniLM-L6-v2' | 'finbert';
  dimensions: number;
  description: string;
}

const EMBEDDING_MODELS: Record<string, EmbeddingConfig> = {
  'all-mpnet-base-v2': {
    model: 'all-mpnet-base-v2',
    dimensions: 768,
    description: 'High quality general embeddings (RECOMMENDED)',
  },
  'all-MiniLM-L6-v2': {
    model: 'all-MiniLM-L6-v2',
    dimensions: 384,
    description: 'Fast, lightweight embeddings',
  },
  'finbert': {
    model: 'finbert',
    dimensions: 768,
    description: 'Finance-optimized embeddings (BEST FOR TRADING)',
  },
};

// ════════════════════════════════════════════════════════════════════════════
// PINECONE CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════

export interface PineconeConfig {
  apiKey: string;
  environment: string;
  indexName: string;
  namespace?: string;
}

export interface VectorDocument {
  id: string;
  text: string;
  embedding: number[];
  metadata: {
    ticker: string;
    headline: string;
    source: string;
    timestamp: string;
    sentiment_score: number;
    url: string;
  };
}

// ════════════════════════════════════════════════════════════════════════════
// RAG PIPELINE CLASS
// ════════════════════════════════════════════════════════════════════════════

/**
 * RAG Pipeline for Trading Analysis
 * Retrieves similar past articles and uses them as context for current decisions
 */
export class RAGPipeline {
  private embeddingModel: string;
  private embeddingDimensions: number;
  private documentsInMemory: Map<string, VectorDocument> = new Map();

  constructor(
    embeddingModel: keyof typeof EMBEDDING_MODELS = 'all-mpnet-base-v2'
  ) {
    const config = EMBEDDING_MODELS[embeddingModel];
    this.embeddingModel = embeddingModel;
    this.embeddingDimensions = config.dimensions;

    logger.info('RAG Pipeline initialized', {
      model: embeddingModel,
      dimensions: config.dimensions,
      description: config.description,
    });
  }

  /**
   * Generate embeddings from text
   * In production: Call HuggingFace API or use local model
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      logger.debug('Generating embedding with HuggingFace', {
        model: this.embeddingModel,
        textLength: text.length,
      });

      // Call HuggingFace Inference API for real embeddings
      if (!HF_API_KEY) {
        logger.warn('HF_TOKEN not set, using mock embeddings');
        return this.generateMockEmbedding(text);
      }

      const response = await fetch(
        `https://api-inference.huggingface.co/pipeline/feature-extraction/${this.embeddingModel}`,
        {
          headers: {
            Authorization: `Bearer ${HF_API_KEY}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify({ inputs: text, truncate: true }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        logger.error('HuggingFace API error', { status: response.status, error });
        return this.generateMockEmbedding(text);
      }

      const embedding = await response.json();

      logger.debug('Embedding generated from HuggingFace', {
        dimensions: Array.isArray(embedding) ? embedding.length : 'unknown',
      });

      // HuggingFace returns array of arrays for single input, flatten it
      if (Array.isArray(embedding) && Array.isArray(embedding[0])) {
        return embedding[0] as number[];
      }
      return (embedding as number[]) || this.generateMockEmbedding(text);
    } catch (error) {
      logger.error('Failed to generate embedding', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.generateMockEmbedding(text);
    }
  }

  /**
   * Store document in vector database
   * In production: Store in Pinecone
   */
  async storeDocument(doc: VectorDocument): Promise<void> {
    try {
      // Store in-memory (fallback)
      this.documentsInMemory.set(doc.id, doc);

      // Store in Pinecone if API key available
      if (PINECONE_API_KEY) {
        try {
          const response = await fetch(
            `https://api.pinecone.io/v1/vectors/upsert`,
            {
              method: 'POST',
              headers: {
                'Api-Key': PINECONE_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                vectors: [
                  {
                    id: doc.id,
                    values: doc.embedding,
                    metadata: {
                      ticker: doc.metadata.ticker,
                      headline: doc.metadata.headline,
                      source: doc.metadata.source,
                      timestamp: doc.metadata.timestamp,
                      sentiment_score: doc.metadata.sentiment_score,
                      url: doc.metadata.url,
                      text_preview: doc.text.substring(0, 200),
                    },
                  },
                ],
                namespace: PINECONE_INDEX_NAME,
              }),
            }
          );

          if (!response.ok) {
            const error = await response.text();
            logger.warn('Pinecone store error', { status: response.status, error });
          } else {
            logger.info('Document stored in Pinecone', {
              documentId: doc.id,
              ticker: doc.metadata.ticker,
            });
          }
        } catch (pineconeError) {
          logger.warn('Failed to store in Pinecone', {
            error: pineconeError instanceof Error ? pineconeError.message : String(pineconeError),
          });
        }
      }

      logger.info('Document stored in vector DB', {
        documentId: doc.id,
        ticker: doc.metadata.ticker,
        headline: doc.metadata.headline.substring(0, 50),
        totalDocuments: this.documentsInMemory.size,
      });
    } catch (error) {
      logger.error('Failed to store document', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Retrieve similar documents (semantic search)
   * In production: Query Pinecone
   */
  async retrieveSimilarDocuments(
    embedding: number[],
    ticker: string,
    topK: number = 5
  ): Promise<VectorDocument[]> {
    try {
      logger.debug('Searching for similar documents', {
        ticker,
        topK,
        documentCount: this.documentsInMemory.size,
      });

      let results: VectorDocument[] = [];

      // Try Pinecone first if API key available
      if (PINECONE_API_KEY) {
        try {
          const response = await fetch(
            `https://api.pinecone.io/v1/query`,
            {
              method: 'POST',
              headers: {
                'Api-Key': PINECONE_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                vector: embedding,
                topK,
                includeMetadata: true,
                filter: { ticker: { $eq: ticker } },
                namespace: PINECONE_INDEX_NAME,
              }),
            }
          );

          if (response.ok) {
            const data = await response.json() as any;
            if (data.matches) {
              logger.info('Retrieved documents from Pinecone', {
                ticker,
                found: data.matches.length,
              });
              // Map Pinecone results back to VectorDocument
              results = data.matches.map((match: any) => ({
                id: match.id,
                text: match.metadata?.text_preview || '',
                embedding: match.values,
                metadata: match.metadata,
              }));
            }
          } else {
            logger.warn('Pinecone query error', { status: response.status });
          }
        } catch (pineconeError) {
          logger.warn('Failed to query Pinecone', {
            error: pineconeError instanceof Error ? pineconeError.message : String(pineconeError),
          });
        }
      }

      // Fallback to in-memory search if Pinecone fails or no results
      if (results.length === 0) {
        const similarities: Array<{ doc: VectorDocument; score: number }> = [];

        for (const doc of this.documentsInMemory.values()) {
          if (doc.metadata.ticker === ticker) {
            const score = this.cosineSimilarity(embedding, doc.embedding);
            similarities.push({ doc, score });
          }
        }

        results = similarities
          .sort((a, b) => b.score - a.score)
          .slice(0, topK)
          .map((s) => s.doc);

        logger.info('Retrieved documents from memory', {
          ticker,
          found: results.length,
        });
      }

      return results;
    } catch (error) {
      logger.error('Failed to retrieve similar documents', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Build context for LLM prompt using retrieved documents
   */
  buildContext(documents: VectorDocument[]): string {
    if (documents.length === 0) {
      return 'No relevant historical data found.';
    }

    let context = `## Historical Context (Past ${documents.length} similar articles):\n\n`;

    documents.forEach((doc, index) => {
      context += `### Article ${index + 1}\n`;
      context += `- **Headline**: ${doc.metadata.headline}\n`;
      context += `- **Source**: ${doc.metadata.source}\n`;
      context += `- **Time**: ${doc.metadata.timestamp}\n`;
      context += `- **Sentiment Score**: ${doc.metadata.sentiment_score.toFixed(2)}\n`;
      context += `- **Summary**: ${doc.text.substring(0, 200)}...\n\n`;
    });

    return context;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Generate mock embedding for MVP
   * In production: Remove this and call real API
   */
  private generateMockEmbedding(text: string): number[] {
    // Generate deterministic embedding based on text
    const hash = text
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);

    const embedding: number[] = [];
    for (let i = 0; i < this.embeddingDimensions; i++) {
      // Pseudo-random but deterministic
      const seed = hash + i * 73856093;
      embedding.push(Math.sin(seed) * 0.5 + Math.cos(seed) * 0.5);
    }
    return embedding;
  }

  /**
   * Get pipeline statistics
   */
  getStats() {
    return {
      embeddingModel: this.embeddingModel,
      embeddingDimensions: this.embeddingDimensions,
      documentsStored: this.documentsInMemory.size,
      modelConfig: EMBEDDING_MODELS[this.embeddingModel],
    };
  }
}

// Singleton instance
let ragPipeline: RAGPipeline | null = null;

/**
 * Get or create RAG pipeline
 */
export function getRAGPipeline(
  model: keyof typeof EMBEDDING_MODELS = 'all-mpnet-base-v2'
): RAGPipeline {
  if (!ragPipeline) {
    ragPipeline = new RAGPipeline(model);
  }
  return ragPipeline;
}

export default {
  getRAGPipeline,
  EMBEDDING_MODELS,
};
