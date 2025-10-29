/**
 * Vector Store - Semantic similarity for deduplication
 * Stores article embeddings for similarity search
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('vector-store');

/**
 * Generate embedding from text using LLM
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // For MVP: Use simple text-based similarity hash instead of real embeddings
    // In production: Use OpenRouter's embedding model or separate embedding service
    
    const hash = simpleTextHash(text);
    logger.debug('Generated embedding hash', { textLength: text.length });
    
    return hash;
  } catch (error) {
    logger.error('Failed to generate embedding', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Simple text similarity hash for MVP
 * Returns array of numbers representing text features
 */
function simpleTextHash(text: string): number[] {
  const normalized = text.toLowerCase().trim();
  
  // Extract key entities (crypto symbols)
  const cryptoSymbols = extractCryptoSymbols(normalized);
  
  // Calculate simple statistics
  const wordCount = normalized.split(/\s+/).length;
  const avgWordLength = normalized.replace(/\s/g, '').length / Math.max(1, wordCount);
  
  // Create feature vector
  return [
    wordCount / 1000,  // Normalized word count
    avgWordLength / 10,  // Normalized avg word length
    cryptoSymbols.length / 10,  // Count of crypto mentions
    // Add more features as needed
  ];
}

/**
 * Extract cryptocurrency symbols from text
 */
function extractCryptoSymbols(text: string): string[] {
  const symbols = ['BTC', 'ETH', 'XRP', 'ADA', 'SOL', 'DOGE', 'SHIB', 'USDT', 'USDC', 'BNB'];
  return symbols.filter(sym => text.includes(sym.toLowerCase()));
}

/**
 * Calculate cosine similarity between two embedding vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Article with embedding
 */
export interface ArticleVector {
  id: string;
  headline: string;
  url: string;
  source: string;
  timestamp: Date;
  content?: string;
  embedding: number[];
}

/**
 * In-memory vector store for MVP
 * In production: Use LanceDB or Pinecone
 */
class VectorStore {
  private articles: Map<string, ArticleVector> = new Map();
  private similarityThreshold: number = 0.7;

  /**
   * Add article to vector store
   */
  async addArticle(article: ArticleVector): Promise<void> {
    this.articles.set(article.id, article);
    logger.debug('Article added to vector store', { id: article.id, totalArticles: this.articles.size });
  }

  /**
   * Find similar articles
   */
  async findSimilar(embedding: number[], limit: number = 5): Promise<ArticleVector[]> {
    const similarities: Array<{ article: ArticleVector; score: number }> = [];

    for (const article of this.articles.values()) {
      const score = cosineSimilarity(embedding, article.embedding);
      if (score >= this.similarityThreshold) {
        similarities.push({ article, score });
      }
    }

    return similarities
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.article);
  }

  /**
   * Check if article is duplicate
   */
  async isDuplicate(headline: string, embedding: number[]): Promise<boolean> {
    try {
      // Check exact headline match first
      for (const article of this.articles.values()) {
        if (article.headline.toLowerCase() === headline.toLowerCase()) {
          logger.debug('Duplicate found: exact headline match');
          return true;
        }
      }

      // Check semantic similarity
      const similar = await this.findSimilar(embedding, 1);
      if (similar.length > 0) {
        logger.debug('Potential duplicate found: semantic similarity', { 
          existingHeadline: similar[0].headline,
          newHeadline: headline 
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error checking for duplicates', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  /**
   * Get store statistics
   */
  getStats() {
    return {
      totalArticles: this.articles.size,
      similarityThreshold: this.similarityThreshold,
    };
  }

  /**
   * Clear old articles (keep only recent N)
   */
  cleanup(maxArticles: number = 1000): void {
    if (this.articles.size > maxArticles) {
      const articles = Array.from(this.articles.values())
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, maxArticles);

      this.articles.clear();
      articles.forEach(a => this.articles.set(a.id, a));
      
      logger.info('Vector store cleaned up', { remainingArticles: this.articles.size });
    }
  }
}

// Singleton instance
let vectorStore: VectorStore | null = null;

/**
 * Get or create vector store
 */
export function getVectorStore(): VectorStore {
  if (!vectorStore) {
    vectorStore = new VectorStore();
    logger.info('Vector store initialized');
  }
  return vectorStore;
}

export default { generateEmbedding, cosineSimilarity, getVectorStore };
