/**
 * Technical Indicators - Calculate RSI, SMA, and other signals
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('indicators');

export interface IndicatorValues {
  rsi14: number;
  sma20: number;
  sma50: number;
  currentPrice: number;
  volumeTrend: number;
  priceAboveSMA: boolean;
}

/**
 * Calculate RSI (Relative Strength Index)
 * Values: 0-100. >70 overbought, <30 oversold
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  try {
    if (prices.length < period) {
      logger.warn('Not enough data for RSI calculation', { pricesLength: prices.length, period });
      return 50; // Neutral
    }

    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    const gains = changes.filter(c => c > 0).reduce((a, b) => a + b, 0);
    const losses = Math.abs(changes.filter(c => c < 0).reduce((a, b) => a + b, 0));

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    if (avgGain === 0) return 0;

    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    return Math.round(rsi * 100) / 100;
  } catch (error) {
    logger.error('RSI calculation failed', { error });
    return 50;
  }
}

/**
 * Calculate Simple Moving Average
 */
export function calculateSMA(prices: number[], period: number): number {
  try {
    if (prices.length < period) {
      logger.warn('Not enough data for SMA calculation', { pricesLength: prices.length, period });
      return prices[prices.length - 1] || 0;
    }

    const recentPrices = prices.slice(-period);
    const sum = recentPrices.reduce((a, b) => a + b, 0);
    const sma = sum / period;

    return Math.round(sma * 100) / 100;
  } catch (error) {
    logger.error('SMA calculation failed', { error });
    return 0;
  }
}

/**
 * Calculate volume trend (24h average vs current)
 * Positive = increasing volume, Negative = decreasing
 */
export function calculateVolumeTrend(volumes: number[]): number {
  try {
    if (volumes.length < 2) return 0;

    const recent = volumes.slice(-7); // Last 7 days
    const older = volumes.slice(-14, -7); // Previous 7 days

    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;

    if (avgOlder === 0) return 0;
    const trend = (avgRecent - avgOlder) / avgOlder;

    return Math.round(trend * 100) / 100;
  } catch (error) {
    logger.error('Volume trend calculation failed', { error });
    return 0;
  }
}

/**
 * Calculate all indicators from price history
 */
export function calculateIndicators(prices: number[], volumes: number[]): IndicatorValues {
  try {
    const currentPrice = prices[prices.length - 1];
    const rsi = calculateRSI(prices, 14);
    const sma20 = calculateSMA(prices, 20);
    const sma50 = calculateSMA(prices, 50);
    const volumeTrend = calculateVolumeTrend(volumes);
    const priceAboveSMA = currentPrice > sma20;

    const result: IndicatorValues = {
      rsi14: rsi,
      sma20,
      sma50,
      currentPrice,
      volumeTrend,
      priceAboveSMA,
    };

    logger.debug('Indicators calculated', result);
    return result;
  } catch (error) {
    logger.error('Failed to calculate indicators', { error });
    return {
      rsi14: 50,
      sma20: 0,
      sma50: 0,
      currentPrice: 0,
      volumeTrend: 0,
      priceAboveSMA: false,
    };
  }
}

/**
 * Generate technical analysis text for LLM
 */
export function generateTechnicalAnalysis(indicators: IndicatorValues): string {
  const rsiStatus = indicators.rsi14 > 70 ? 'overbought' : indicators.rsi14 < 30 ? 'oversold' : 'neutral';
  const trendStatus = indicators.priceAboveSMA ? 'above SMA20' : 'below SMA20';
  const volumeStatus = indicators.volumeTrend > 0 ? 'increasing' : 'decreasing';

  return `
Technical Analysis:
- RSI(14): ${indicators.rsi14.toFixed(2)} (${rsiStatus})
- Price: $${indicators.currentPrice.toFixed(2)}
- SMA20: $${indicators.sma20.toFixed(2)}, SMA50: $${indicators.sma50.toFixed(2)}
- Price is ${trendStatus}
- Volume trend: ${volumeStatus} (${(indicators.volumeTrend * 100).toFixed(1)}%)
`;
}

export default { calculateRSI, calculateSMA, calculateVolumeTrend, calculateIndicators, generateTechnicalAnalysis };
