/**
 * Express API Server - Frontend Integration Layer
 * Provides REST API and WebSocket support for the frontend dashboard
 */

import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { AppConfig } from './config/settings.js';
import { getLogger } from './utils/logger.js';

const logger = getLogger('api');

interface Signal {
  id: string;
  ticker: string;
  type: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  sentiment: number;
  timestamp: Date;
  newsAgentRecommendation: string;
  newsSummary?: string;
  investmentAgentReasoning?: string;
  personalityReasoning?: string;
  personalityVeto?: boolean;
  personalityModification?: string;
  executionTime: number;
}

let currentSignals: Signal[] = [];
let socketIOInstance: SocketIOServer | null = null;
let orchestratorInstance: any = null;

/**
 * Broadcast new signal to all connected clients
 */
export function broadcastSignal(signal: Signal) {
  if (!socketIOInstance) return;
  
  currentSignals.unshift(signal);
  // Keep only last 100 signals
  if (currentSignals.length > 100) {
    currentSignals.pop();
  }
  socketIOInstance.emit('signal:new', signal);
  logger.info(`Signal broadcast: ${signal.ticker} ${signal.type}`);
}

/**
 * Update agent status
 */
export function updateAgentStatus(agentId: string, status: string) {
  if (!socketIOInstance) return;
  socketIOInstance.emit('agent:status', { agentId, status, timestamp: new Date() });
}

/**
 * Initialize and start the API server
 */
export async function startAPIServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: ['http://localhost:3001', 'http://localhost:3000', 'http://127.0.0.1:3001'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 20000,
  } as any);

  socketIOInstance = io;

  // Middleware
  app.use(cors({
    origin: ['http://localhost:3001', 'http://localhost:3000', 'http://127.0.0.1:3001'],
    credentials: true,
  }));
  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date(),
      environment: AppConfig.env.nodeEnv,
    });
  });

  // Get all signals
  app.get('/api/signals', (_req: Request, res: Response) => {
    res.json({
      signals: currentSignals,
      total: currentSignals.length,
      timestamp: new Date(),
    });
  });

  // Get signal by ID
  app.get('/api/signals/:id', (req: Request, res: Response) => {
    const signal = currentSignals.find(s => s.id === req.params.id);
    if (!signal) {
      res.status(404).json({ error: 'Signal not found' });
      return;
    }
    res.json(signal);
  });

  // Get metrics
  app.get('/api/metrics', (_req: Request, res: Response) => {
    const totalSignals = currentSignals.length;
    const buySignals = currentSignals.filter(s => s.type === 'BUY').length;
    const sellSignals = currentSignals.filter(s => s.type === 'SELL').length;
    const avgConfidence = totalSignals > 0
      ? currentSignals.reduce((acc, s) => acc + s.confidence, 0) / totalSignals
      : 0;

    res.json({
      totalSignals,
      buySignals,
      sellSignals,
      avgConfidence,
      winRate: 0,
      portfolioPerformance: 0,
    });
  });

  // Get agent status
  app.get('/api/agents', (_req: Request, res: Response) => {
    res.json({
      agents: [
        {
          id: 'news-agent',
          name: 'News Agent',
          status: 'idle',
          lastUpdate: new Date(),
        },
        {
          id: 'investment-agent',
          name: 'Investment Agent',
          status: 'idle',
          lastUpdate: new Date(),
        },
        {
          id: 'personality-agent',
          name: 'Personality Agent',
          status: 'idle',
          lastUpdate: new Date(),
        },
      ],
    });
  });

  // Get execution logs
  app.get('/api/executions', (_req: Request, res: Response) => {
    res.json({
      executions: [],
      total: 0,
    });
  });

  // Change personality mode
  app.post('/api/personality', (req: Request, res: Response) => {
    const { personality } = req.body;
    if (!['buffett', 'soros', 'cathie', 'contrarian'].includes(personality)) {
      res.status(400).json({ error: 'Invalid personality' });
      return;
    }
    
    if (!orchestratorInstance) {
      res.status(503).json({ error: 'Orchestrator not available' });
      return;
    }
    
    try {
      orchestratorInstance.setPersonality(personality);
      logger.info(`Personality changed to: ${personality}`);
      res.json({ personality, status: 'updated' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to change personality: ${msg}`);
      res.status(500).json({ error: 'Failed to change personality' });
    }
  });

  // WebSocket connection handling
  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Send initial signals on connection
    socket.emit('signals:initial', currentSignals);

    // Handle subscription to signal updates
    socket.on('signals:subscribe', () => {
      logger.info(`Client subscribed to signals: ${socket.id}`);
      socket.emit('signals:subscribed');
    });

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  // Start server
  const port = AppConfig.server.port;
  httpServer.listen(port, () => {
    logger.info(`🚀 API Server running on http://localhost:${port}`);
    logger.info('📡 WebSocket server ready for frontend connections');
    logger.info(`   Transports: WebSocket, Polling`);
  });

  return { app, httpServer, io };
}
