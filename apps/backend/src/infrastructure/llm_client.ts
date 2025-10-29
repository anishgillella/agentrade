import axios, { AxiosInstance } from 'axios';
import { getLogger } from '../utils/logger.js';
import { LLMError, ErrorCodes, retryWithBackoff } from '../utils/errors.js';
import AppConfig from '../config/settings.js';

const logger = getLogger('llm-client');

/**
 * LLM response structure
 */
export interface LLMResponse {
  content: string;
  tokens: {
    input: number;
    output: number;
  };
  model: string;
  timestamp: Date;
}

/**
 * LLM tool definition
 */
export interface LLMTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * LLM tool call in response
 */
export interface ToolCall {
  id: string;
  type: 'tool_use';
  name: string;
  input: Record<string, unknown>;
}

/**
 * Configuration for LLM client
 */
interface LLMConfig {
  apiKey: string;
  model?: string;
  maxRetries?: number;
  timeout?: number;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Production-grade LLM client for OpenRouter
 * Supports Claude and other models via OpenRouter API
 */
export class LLMClient {
  private client: AxiosInstance;
  private apiKey: string;
  private model: string;
  private maxRetries: number;
  private temperature: number;
  private maxTokens: number;

  constructor(config: LLMConfig) {
    if (!config.apiKey) {
      throw new LLMError(
        ErrorCodes.MISSING_API_KEY,
        'OPENROUTER_API_KEY environment variable is required',
        500,
        { field: 'OPENROUTER_API_KEY' }
      );
    }

    this.apiKey = config.apiKey;
    this.model = config.model || 'openai/gpt-4o-mini';
    this.maxRetries = config.maxRetries || 3;
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens || 2048;

    this.client = axios.create({
      baseURL: 'https://openrouter.ai/api/v1',
      timeout: config.timeout || 30000,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://ai-trading-system.local',
        'X-Title': 'AI Trading System',
        'Content-Type': 'application/json',
      },
    });

    logger.info('LLMClient initialized', {
      model: this.model,
      maxRetries: this.maxRetries,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
    });
  }

  /**
   * Send a simple text prompt to LLM
   */
  async invoke(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    logger.debug('LLM invoke called', { prompt: prompt.substring(0, 100), model: this.model });

    return retryWithBackoff(
      async () => {
        try {
          const response = await this.client.post('/chat/completions', {
            model: this.model,
            messages: [
              ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
              { role: 'user', content: prompt },
            ],
            temperature: this.temperature,
            max_tokens: this.maxTokens,
          });

          const content = response.data.choices[0]?.message?.content;
          if (!content) {
            throw new Error('No content in LLM response');
          }

          const result: LLMResponse = {
            content,
            tokens: {
              input: response.data.usage?.prompt_tokens || 0,
              output: response.data.usage?.completion_tokens || 0,
            },
            model: this.model,
            timestamp: new Date(),
          };

          logger.debug('LLM response received', {
            model: this.model,
            inputTokens: result.tokens.input,
            outputTokens: result.tokens.output,
          });

          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          
          if (message.includes('429')) {
            throw new LLMError(
              ErrorCodes.LLM_TIMEOUT_ERROR,
              'Rate limited by LLM API',
              429,
              { error: message },
              error instanceof Error ? error : undefined
            );
          }

          if (message.includes('401') || message.includes('403')) {
            throw new LLMError(
              ErrorCodes.MISSING_API_KEY,
              'Invalid or expired API key',
              401,
              { error: message },
              error instanceof Error ? error : undefined
            );
          }

          throw new LLMError(
            ErrorCodes.LLM_API_ERROR,
            `LLM API error: ${message}`,
            500,
            { error: message },
            error instanceof Error ? error : undefined
          );
        }
      },
      this.maxRetries,
      1000,
      'llm-invoke'
    );
  }

  /**
   * Send prompt with tools (for structured outputs)
   */
  async invokeWithTools(
    prompt: string,
    tools: LLMTool[],
    systemPrompt?: string
  ): Promise<LLMResponse> {
    logger.debug('LLM invokeWithTools called', {
      prompt: prompt.substring(0, 100),
      tools: tools.map(t => t.name),
    });

    return retryWithBackoff(
      async () => {
        try {
          const response = await this.client.post('/chat/completions', {
            model: this.model,
            messages: [
              ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
              { role: 'user', content: prompt },
            ],
            tools: tools.map(tool => ({
              type: 'function',
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema,
              },
            })),
            temperature: this.temperature,
            max_tokens: this.maxTokens,
          });

          // Extract tool calls or regular content
          const message = response.data.choices[0]?.message;
          let content = message?.content || '';

          // Handle tool calls
          if (message?.tool_calls && message.tool_calls.length > 0) {
            content = JSON.stringify(message.tool_calls);
          }

          const result: LLMResponse = {
            content,
            tokens: {
              input: response.data.usage?.prompt_tokens || 0,
              output: response.data.usage?.completion_tokens || 0,
            },
            model: this.model,
            timestamp: new Date(),
          };

          logger.debug('LLM response with tools received', {
            toolCalls: message?.tool_calls?.length || 0,
            tokens: result.tokens,
          });

          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new LLMError(
            ErrorCodes.LLM_API_ERROR,
            `LLM API error with tools: ${message}`,
            500,
            { error: message, tools: tools.map(t => t.name) },
            error instanceof Error ? error : undefined
          );
        }
      },
      this.maxRetries,
      1000,
      'llm-invoke-with-tools'
    );
  }

  /**
   * Stream response from LLM (for real-time reasoning)
   */
  async *streamInvoke(prompt: string, systemPrompt?: string): AsyncGenerator<string> {
    logger.debug('LLM streamInvoke called', { prompt: prompt.substring(0, 100) });

    try {
      const response = await this.client.post(
        '/chat/completions',
        {
          model: this.model,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt },
          ],
          temperature: this.temperature,
          max_tokens: this.maxTokens,
          stream: true,
        },
        {
          responseType: 'stream',
        }
      );

      const stream = response.data;

      for await (const chunk of stream) {
        const lines = chunk.toString().split('\n').filter((line: string) => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              logger.debug('LLM stream completed');
              return;
            }

            try {
              const json = JSON.parse(data);
              const content = json.choices?.[0]?.delta?.content;
              
              if (content) {
                yield content;
              }
            } catch (parseError) {
              logger.warn('Failed to parse stream chunk', { data });
            }
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('LLM stream error', { error: message });
      throw new LLMError(
        ErrorCodes.LLM_API_ERROR,
        `LLM stream error: ${message}`,
        500,
        { error: message },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get model info
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      model: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      maxRetries: this.maxRetries,
    };
  }
}

/**
 * Factory function to create LLM client from environment
 */
export function createLLMClient(): LLMClient {
  const apiKey = AppConfig.llm.openrouter.apiKey;
  
  if (!apiKey) {
    throw new LLMError(
      ErrorCodes.MISSING_API_KEY,
      'OPENROUTER_API_KEY environment variable is not set',
      500,
      { variable: 'OPENROUTER_API_KEY' }
    );
  }

  return new LLMClient({
    apiKey,
    model: process.env.LLM_MODEL || 'openai/gpt-4o-mini',
    maxRetries: parseInt(process.env.LLM_MAX_RETRIES || '3', 10),
    timeout: parseInt(process.env.LLM_TIMEOUT || '30000', 10),
    temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '2048', 10),
  });
}

export default LLMClient;
