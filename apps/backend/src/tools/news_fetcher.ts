/**
 * News Fetcher - Integrates with NewsAPI and Reddit
 */

import axios from 'axios';
import { getLogger } from '../utils/logger.js';
import AppConfig from '../config/settings.js';

const logger = getLogger('news-fetcher');

export interface RawArticle {
  headline: string;
  url: string;
  source: string;
  timestamp: Date;
  content?: string;
  author?: string;
}

export async function fetchNewsAPIArticles(
  query: string = 'cryptocurrency',
  limit: number = 10
): Promise<RawArticle[]> {
  try {
    const apiKey = AppConfig.newsSources.newsapi.key;
    if (!apiKey) {
      logger.warn('NewsAPI key not configured');
      return [];
    }

    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: { q: query, sortBy: 'publishedAt', language: 'en', apiKey, pageSize: Math.min(limit, 100) },
      timeout: 10000,
    });

    return (response.data.articles || []).map((article: any) => ({
      headline: article.title,
      url: article.url,
      source: `NewsAPI - ${article.source.name}`,
      timestamp: new Date(article.publishedAt),
      content: article.description || article.content,
      author: article.author,
    }));
  } catch (error) {
    logger.error('NewsAPI fetch failed', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

export async function fetchRedditPosts(
  subreddits: string[] = ['cryptocurrency', 'Bitcoin'],
  limit: number = 10
): Promise<RawArticle[]> {
  try {
    const clientId = AppConfig.newsSources.reddit.clientId;
    const clientSecret = AppConfig.newsSources.reddit.clientSecret;
    if (!clientId || !clientSecret) {
      logger.warn('Reddit credentials not configured');
      return [];
    }

    const authResponse = await axios.post(
      'https://www.reddit.com/api/v1/access_token',
      new URLSearchParams({ grant_type: 'client_credentials' }),
      {
        auth: { username: clientId, password: clientSecret },
        headers: { 'User-Agent': 'ai-trading-system/1.0' },
      }
    );

    const token = authResponse.data.access_token;
    const articles: RawArticle[] = [];

    for (const subreddit of subreddits) {
      const posts = await axios.get(`https://oauth.reddit.com/r/${subreddit}/hot`, {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'ai-trading-system/1.0' },
        params: { limit: Math.min(limit, 100) },
      });

      (posts.data.data?.children || []).forEach((child: any) => {
        const post = child.data;
        articles.push({
          headline: post.title,
          url: `https://reddit.com${post.url}`,
          source: `Reddit - r/${post.subreddit}`,
          timestamp: new Date(post.created_utc * 1000),
          content: post.selftext,
          author: post.author,
        });
      });
    }

    return articles;
  } catch (error) {
    logger.error('Reddit fetch failed', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

export async function fetchAllNews(options: { newsApiQuery?: string; newsApiLimit?: number; redditLimit?: number } = {}): Promise<RawArticle[]> {
  const [newsApi, reddit] = await Promise.all([
    fetchNewsAPIArticles(options.newsApiQuery || 'cryptocurrency', options.newsApiLimit || 10),
    fetchRedditPosts(['cryptocurrency', 'Bitcoin', 'ethereum'], options.redditLimit || 10),
  ]);
  const all = [...newsApi, ...reddit];
  all.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  logger.info('Fetched news', { newsApi: newsApi.length, reddit: reddit.length, total: all.length });
  return all;
}

export default { fetchNewsAPIArticles, fetchRedditPosts, fetchAllNews };
