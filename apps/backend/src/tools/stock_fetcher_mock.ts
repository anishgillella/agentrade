/**
 * Mock Stock Fetcher - Simulates AlphaVantage with realistic market data
 * 15 diverse companies with current market trends
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('stock-fetcher-mock');

// 15 diverse companies with current market conditions (Oct 2025)
const COMPANIES = [
  { symbol: 'AAPL', name: 'Apple', sector: 'Tech', trend: 'bullish', basePrice: 235.45 },
  { symbol: 'MSFT', name: 'Microsoft', sector: 'Tech', trend: 'bullish', basePrice: 438.92 },
  { symbol: 'NVDA', name: 'Nvidia', sector: 'AI/Chips', trend: 'very_bullish', basePrice: 142.67 },
  { symbol: 'TSLA', name: 'Tesla', sector: 'Auto/EV', trend: 'mixed', basePrice: 312.58 },
  { symbol: 'META', name: 'Meta', sector: 'Tech', trend: 'bullish', basePrice: 592.34 },
  { symbol: 'GOOGL', name: 'Google', sector: 'Tech', trend: 'bullish', basePrice: 193.21 },
  { symbol: 'AMZN', name: 'Amazon', sector: 'E-commerce', trend: 'bullish', basePrice: 201.45 },
  { symbol: 'NFLX', name: 'Netflix', sector: 'Media', trend: 'bullish', basePrice: 289.67 },
  { symbol: 'JPM', name: 'JP Morgan', sector: 'Finance', trend: 'neutral', basePrice: 228.92 },
  { symbol: 'XOM', name: 'Exxon', sector: 'Energy', trend: 'bearish', basePrice: 118.34 },
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', trend: 'neutral', basePrice: 160.23 },
  { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer', trend: 'neutral', basePrice: 169.45 },
  { symbol: 'AMD', name: 'Advanced Micro', sector: 'Semiconductors', trend: 'bullish', basePrice: 195.78 },
  { symbol: 'COIN', name: 'Coinbase', sector: 'Crypto', trend: 'very_bullish', basePrice: 178.92 },
  { symbol: 'SOFI', name: 'SoFi', sector: 'Fintech', trend: 'bullish', basePrice: 31.45 },
];

export interface StockData {
  symbol: string;
  company: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: Date;
  headline: string;
  description: string;
}

/**
 * Generate realistic mock price change based on trend
 */
function getRealisticPriceChange(basePrice: number, trend: string): { price: number; changePercent: number } {
  let changePercent = 0;

  switch (trend) {
    case 'very_bullish':
      changePercent = (Math.random() * 6) + 2; // +2% to +8%
      break;
    case 'bullish':
      changePercent = (Math.random() * 4) - 1; // -1% to +3%
      break;
    case 'neutral':
      changePercent = (Math.random() * 2) - 1; // -1% to +1%
      break;
    case 'mixed':
      changePercent = (Math.random() * 4) - 2; // -2% to +2%
      break;
    case 'bearish':
      changePercent = (Math.random() * 3) - 3; // -3% to 0%
      break;
  }

  const price = basePrice * (1 + changePercent / 100);
  return { price: parseFloat(price.toFixed(2)), changePercent };
}

/**
 * Fetch mock stock quote for a ticker
 */
export async function fetchStockQuote(symbol: string): Promise<StockData | null> {
  try {
    const company = COMPANIES.find(c => c.symbol === symbol);
    if (!company) {
      logger.warn(`Company not found: ${symbol}`);
      return null;
    }

    const { price, changePercent } = getRealisticPriceChange(company.basePrice, company.trend);
    const change = price - company.basePrice;
    const volume = Math.floor(Math.random() * 500000000) + 50000000; // 50M to 500M

    const sentiment = changePercent > 0 ? 'bullish' : 'bearish';
    const impact = Math.abs(changePercent) > 4 ? 'high' : Math.abs(changePercent) > 2 ? 'medium' : 'low';

    return {
      symbol,
      company: company.name,
      price,
      change,
      changePercent,
      volume,
      timestamp: new Date(),
      headline: `${symbol} Trading Update`,
      description: `${symbol} is trading at $${price} with ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}% change. ${sentiment.toUpperCase()} sentiment detected with ${impact.toUpperCase()} impact. Volume: ${(volume / 1000000).toFixed(0)}M shares.`,
    };
  } catch (error) {
    logger.error(`Failed to fetch quote for ${symbol}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Fetch company overview
 */
export async function fetchCompanyOverview(symbol: string): Promise<any> {
  try {
    const company = COMPANIES.find(c => c.symbol === symbol);
    if (!company) {
      return null;
    }

    return {
      symbol,
      name: company.name,
      sector: company.sector,
      trend: company.trend,
      marketCap: `$${(Math.random() * 2000 + 100).toFixed(0)}B`,
      pe: (Math.random() * 30 + 10).toFixed(1),
      eps: (Math.random() * 5 + 1).toFixed(2),
      description: `${company.name} (${symbol}) - ${company.sector} sector company with ${company.trend} market trend.`,
    };
  } catch (error) {
    logger.error(`Failed to fetch overview for ${symbol}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Fetch all stock data for 15 companies
 */
export async function fetchAllStockData(): Promise<StockData[]> {
  logger.info('📊 Fetching mock stock data for all 15 companies');

  const results = await Promise.all(
    COMPANIES.map(company => fetchStockQuote(company.symbol))
  );

  const stockData = results.filter((data): data is StockData => data !== null);
  logger.info(`✓ Fetched ${stockData.length} mock stock quotes`, {
    companies: COMPANIES.map(c => `${c.symbol}(${c.trend})`).join(', '),
  });

  return stockData;
}

export { COMPANIES };
export default { fetchStockQuote, fetchCompanyOverview, fetchAllStockData, COMPANIES };
