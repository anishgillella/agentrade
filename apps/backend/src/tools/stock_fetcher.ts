/**
 * Stock Fetcher - Integrates with AlphaVantage API for real-time stock data
 */

import axios from 'axios';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('stock-fetcher');

const API_KEY = 'MUFSY6OZFN5FNFOF'; // AlphaVantage API key
const API_URL = 'https://www.alphavantage.co/query';

// 10 diverse companies to track
const COMPANIES = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'GOOGL', name: 'Google' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'NVDA', name: 'Nvidia' },
  { symbol: 'META', name: 'Meta' },
  { symbol: 'NFLX', name: 'Netflix' },
  { symbol: 'CSCO', name: 'Cisco' },
  { symbol: 'INTC', name: 'Intel' },
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

export async function fetchStockQuote(symbol: string): Promise<StockData | null> {
  try {
    const response = await axios.get(API_URL, {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol,
        apikey: API_KEY,
      },
      timeout: 10000,
    });

    const quote = response.data['Global Quote'];
    if (!quote || !quote['05. price']) {
      logger.warn(`No quote data for ${symbol}`);
      return null;
    }

    const company = COMPANIES.find(c => c.symbol === symbol);
    const price = parseFloat(quote['05. price']);
    const change = parseFloat(quote['09. change']);
    const changePercent = parseFloat(quote['10. change percent']?.replace('%', '') || '0');
    const volume = parseInt(quote['06. volume'] || '0');

    return {
      symbol,
      company: company?.name || symbol,
      price,
      change,
      changePercent,
      volume,
      timestamp: new Date(),
      headline: `${symbol} Trading Update`,
      description: `${symbol} is trading at $${price} with ${changePercent > 0 ? '+' : ''}${changePercent}% change. Volume: ${volume.toLocaleString()}`,
    };
  } catch (error) {
    logger.error(`Failed to fetch quote for ${symbol}`, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return null;
  }
}

export async function fetchCompanyOverview(symbol: string): Promise<any> {
  try {
    const response = await axios.get(API_URL, {
      params: {
        function: 'OVERVIEW',
        symbol,
        apikey: API_KEY,
      },
      timeout: 10000,
    });

    const overview = response.data;
    return {
      symbol,
      name: overview['Name'],
      sector: overview['Sector'],
      marketCap: overview['MarketCapitalization'],
      pe: overview['PERatio'],
      eps: overview['EPS'],
      description: overview['Description'],
    };
  } catch (error) {
    logger.error(`Failed to fetch overview for ${symbol}`, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return null;
  }
}

export async function fetchAllStockData(): Promise<StockData[]> {
  logger.info('Fetching stock data for all companies');
  
  const results = await Promise.all(
    COMPANIES.map(company => fetchStockQuote(company.symbol))
  );

  const stockData = results.filter((data): data is StockData => data !== null);
  logger.info(`Fetched ${stockData.length} stock quotes`);
  return stockData;
}

export default { fetchStockQuote, fetchCompanyOverview, fetchAllStockData, COMPANIES };
