/**
 * CoinGecko API Client - Fetches crypto price and market data
 * Free API: https://www.coingecko.com/en/api/
 * Attribution: Data provided by CoinGecko (https://www.coingecko.com)
 */

import axios from 'axios';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('coingecko-client');

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

/**
 * Market data for a cryptocurrency
 */
export interface CryptoMarketData {
  ticker: string;
  price: number;
  priceChangePercent24h: number;
  marketCap: number;
  volume24h: number;
  timestamp: Date;
}

/**
 * Historical OHLCV (Open, High, Low, Close, Volume) data
 */
export interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Fetch current market data for a cryptocurrency
 */
export async function getMarketData(ticker: string): Promise<CryptoMarketData | null> {
  try {
    const coinId = mapTickerToCoinId(ticker);
    
    const response = await axios.get(`${COINGECKO_API}/simple/price`, {
      params: {
        ids: coinId,
        vs_currency: 'usd',
        include_market_cap: true,
        include_24hr_vol: true,
        include_24hr_change: true,
      },
      timeout: 10000,
    });

    const data = response.data[coinId];
    if (!data) {
      logger.warn('No data for ticker', { ticker });
      return null;
    }

    return {
      ticker,
      price: data.usd,
      priceChangePercent24h: data.usd_24h_change,
      marketCap: data.usd_market_cap,
      volume24h: data.usd_24h_vol,
      timestamp: new Date(),
    };
  } catch (error) {
    logger.error('Failed to fetch market data', { ticker, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Fetch historical market chart data (for calculating indicators)
 */
export async function getHistoricalData(
  ticker: string,
  days: number = 30
): Promise<{ prices: Array<[number, number]>; volumes: Array<[number, number]> } | null> {
  try {
    const coinId = mapTickerToCoinId(ticker);

    const response = await axios.get(`${COINGECKO_API}/coins/${coinId}/market_chart`, {
      params: {
        vs_currency: 'usd',
        days,
        interval: 'daily',
      },
      timeout: 10000,
    });

    return {
      prices: response.data.prices,
      volumes: response.data.volumes,
    };
  } catch (error) {
    logger.error('Failed to fetch historical data', { ticker, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Map crypto ticker to CoinGecko coin ID
 */
function mapTickerToCoinId(ticker: string): string {
  const mapping: Record<string, string> = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    XRP: 'ripple',
    ADA: 'cardano',
    SOL: 'solana',
    DOGE: 'dogecoin',
    SHIB: 'shiba-inu',
    MATIC: 'matic-network',
    AVAX: 'avalanche-2',
    LINK: 'chainlink',
  };

  return mapping[ticker.toUpperCase()] || ticker.toLowerCase();
}

/**
 * Get list of supported cryptocurrencies
 */
export async function getSupportedCryptos(): Promise<string[]> {
  try {
    const response = await axios.get(`${COINGECKO_API}/coins/list`, {
      timeout: 10000,
    });

    return response.data.slice(0, 100).map((coin: any) => coin.symbol.toUpperCase());
  } catch (error) {
    logger.error('Failed to fetch supported cryptos', { error: error instanceof Error ? error.message : String(error) });
    return ['BTC', 'ETH', 'XRP', 'ADA', 'SOL']; // Fallback
  }
}

export default { getMarketData, getHistoricalData, getSupportedCryptos };
