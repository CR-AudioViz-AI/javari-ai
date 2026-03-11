```typescript
import express, { Express, Request, Response } from 'express';
import { Server } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { KafkaProducer } from './kafka/producer';
import { KafkaConsumer } from './kafka/consumer';
import { KafkaAdmin } from './kafka/admin';
import { MessageHandler } from './handlers/message-handler';
import { CoordinationHandler } from './handlers/coordination-handler';
import { ValidationMiddleware } from './middleware/validation';
import { AuthMiddleware } from './middleware/auth';
import { MessageOrderingUtils } from './utils/message-ordering';
import { RetryLogic } from './utils/retry-logic';
import { 
  AgentMessage, 
  MessagePriority, 
  MessageType,
  CoordinationState,
  AgentStatus
} from './types/message.types';
import { Agent, AgentRole } from './types/agent.types';
import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';

/**
 * Inter-Agent Message Bus Microservice
 * 
 * Handles message passing between AI agents in team mode using Apache Kafka
 * for reliable delivery and maintains message ordering for coordinated workflows.
 * 
 * @author CR AudioViz AI
 * @version 1.0.0
 */
export class MessageBusService {
  private app: Express;
  private server: Server | null = null;
  private wsServer: WebSocketServer | null = null;
  private kafkaProducer: KafkaProducer;
  private kafkaConsumer: KafkaConsumer;
  private kafkaAdmin: KafkaAdmin;
  private messageHandler: MessageHandler;
  private coordinationHandler: CoordinationHandler;
  private validationMiddleware: ValidationMiddleware;
  private authMiddleware: AuthMiddleware;
  private messageOrderingUtils: MessageOrderingUtils;
  private retryLogic: RetryLogic;
  private redis: Redis;
  private supabase: any;
  private readonly port: number;
  private readonly kafkaConfig: any;
  private isShuttingDown = false;

  constructor() {
    this.port = parseInt(process.env.PORT || '3003', 10);
    this.app = express();
    
    // Kafka configuration
    this.kafkaConfig = {
      clientId: 'cr-audioviz-message-bus',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      connectionTimeout: 3000,
      requestTimeout: 30000,
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    };

    // Initialize Redis client
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Initialize services
    this.kafkaProducer = new KafkaProducer(this.kafkaConfig);
    this.kafkaConsumer = new KafkaConsumer(this.kafkaConfig);
    this.kafkaAdmin = new KafkaAdmin(this.kafkaConfig);
    this.messageOrderingUtils = new MessageOrderingUtils(this.redis);
    this.retryLogic = new RetryLogic();
    
    this.messageHandler = new MessageHandler(
      this.kafkaProducer,
      this.redis,
      this.supabase,
      this.messageOrderingUtils
    );
    
    this.coordinationHandler = new CoordinationHandler(
      this.redis,
      this.supabase,
      this.messageOrderingUtils
    );
    
    this.validationMiddleware = new ValidationMiddleware();
    this.authMiddleware = new AuthMiddleware(this.supabase);

    this.setupExpress();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupGracefulShutdown();
  }

  /**
   * Setup Express application with middleware
   */
  private setupExpress(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Agent-ID', 'X-Session-ID']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      message: 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use(limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'message-bus',
        version: '1.0.0'
      });
    });

    // Agent registration
    this.app.post('/api/v1/agents/register',
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      this.validationMiddleware.validateAgentRegistration.bind(this.validationMiddleware),
      this.handleAgentRegistration.bind(this)
    );

    // Agent status update
    this.app.put('/api/v1/agents/:agentId/status',
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      this.validationMiddleware.validateStatusUpdate.bind(this.validationMiddleware),
      this.handleAgentStatusUpdate.bind(this)
    );

    // Send message
    this.app.post('/api/v1/messages/send',
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      this.validationMiddleware.validateMessage.bind(this.validationMiddleware),
      this.handleSendMessage.bind(this)
    );

    // Get message history
    this.app.get('/api/v1/messages/:agentId',
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      this.handleGetMessageHistory.bind(this)
    );

    // Team coordination
    this.app.post('/api/v1/coordination/create-session',
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      this.validationMiddleware.validateCoordinationSession.bind(this.validationMiddleware),
      this.handleCreateCoordinationSession.bind(this)
    );

    // Join coordination session
    this.app.post('/api/v1/coordination/:sessionId/join',
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      this.handleJoinCoordinationSession.bind(this)
    );

    // Get active agents
    this.app.get('/api/v1/agents/active',
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      this.handleGetActiveAgents.bind(this)
    );

    // Error handling
    this.app.use(this.handleError.bind(this));
  }

  /**
   * Setup WebSocket server for real-time communication
   */
  private setupWebSocket(): void {
    this.wsServer = new WebSocketServer({ 
      port: this.port + 1,
      perMessageDeflate: false 
    });

    this.wsServer.on('connection', async (ws, req) => {
      try {
        const agentId = req.url?.split('?agentId=')[1];
        if (!agentId) {
          ws.close(1008, 'Agent ID required');
          return;
        }

        // Store agent connection
        await this.redis.hset('ws:connections', agentId, 'connected');
        
        ws.on('message', async (data) => {
          try {
            const message = JSON.parse(data.toString());
            await this.handleWebSocketMessage(agentId, message, ws);
          } catch (error) {
            console.error('WebSocket message error:', error);
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Invalid message format' 
            }));
          }
        });

        ws.on('close', async () => {
          await this.redis.hdel('ws:connections', agentId);
          await this.updateAgentStatus(agentId, AgentStatus.OFFLINE);
        });

        ws.on('error', (error) => {
          console.error('WebSocket error:', error);
        });

        // Send connection confirmation
        ws.send(JSON.stringify({
          type: 'connected',
          agentId,
          timestamp: new Date().toISOString()
        }));

      } catch (error) {
        console.error('WebSocket connection error:', error);
        ws.close(1011, 'Internal server error');
      }
    });
  }

  /**
   * Handle agent registration
   */
  private async handleAgentRegistration(req: Request, res: Response): Promise<void> {
    try {
      const agentData: Agent = req.body;
      
      // Register agent in coordination handler
      await this.coordinationHandler.registerAgent(agentData);
      
      // Update agent presence in Redis
      await this.redis.hset('agents:active', agentData.id, JSON.stringify({
        ...agentData,
        lastSeen: new Date().toISOString(),
        status: AgentStatus.ONLINE
      }));

      res.json({
        success: true,
        message: 'Agent registered successfully',
        agentId: agentData.id
      });
    } catch (error) {
      console.error('Agent registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to register agent'
      });
    }
  }

  /**
   * Handle agent status update
   */
  private async handleAgentStatusUpdate(req: Request, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const { status } = req.body;

      await this.updateAgentStatus(agentId, status);

      res.json({
        success: true,
        message: 'Agent status updated successfully'
      });
    } catch (error) {
      console.error('Agent status update error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update agent status'
      });
    }
  }

  /**
   * Handle send message
   */
  private async handleSendMessage(req: Request, res: Response): Promise<void> {
    try {
      const message: AgentMessage = req.body;
      
      // Process message through handler
      await this.messageHandler.processMessage(message);

      res.json({
        success: true,
        message: 'Message sent successfully',
        messageId: message.id
      });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send message'
      });
    }
  }

  /**
   * Handle get message history
   */
  private async handleGetMessageHistory(req: Request, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const { limit = '50', offset = '0' } = req.query;

      const messages = await this.messageHandler.getMessageHistory(
        agentId,
        parseInt(limit as string, 10),
        parseInt(offset as string, 10)
      );

      res.json({
        success: true,
        messages,
        total: messages.length
      });
    } catch (error) {
      console.error('Get message history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve message history'
      });
    }
  }

  /**
   * Handle create coordination session
   */
  private async handleCreateCoordinationSession(req: Request, res: Response): Promise<void> {
    try {
      const sessionData = req.body;
      
      const session = await this.coordinationHandler.createSession(sessionData);

      res.json({
        success: true,
        session,
        message: 'Coordination session created successfully'
      });
    } catch (error) {
      console.error('Create coordination session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create coordination session'
      });
    }
  }

  /**
   * Handle join coordination session
   */
  private async handleJoinCoordinationSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { agentId } = req.body;

      await this.coordinationHandler.joinSession(sessionId, agentId);

      res.json({
        success: true,
        message: 'Successfully joined coordination session'
      });
    } catch (error) {
      console.error('Join coordination session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to join coordination session'
      });
    }
  }

  /**
   * Handle get active agents
   */
  private async handleGetActiveAgents(req: Request, res: Response): Promise<void> {
    try {
      const activeAgents = await this.redis.hgetall('agents:active');
      
      const agents = Object.entries(activeAgents).map(([id, data]) => {
        return { id, ...JSON.parse(data) };
      });

      res.json({
        success: true,
        agents,
        total: agents.length
      });
    } catch (error) {
      console.error('Get active agents error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve active agents'
      });
    }
  }

  /**
   * Handle WebSocket messages
   */
  private async handleWebSocketMessage(
    agentId: string, 
    message: any, 
    ws: any
  ): Promise<void> {
    try {
      switch (message.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          break;

        case 'status_update':
          await this.updateAgentStatus(agentId, message.status);
          break;

        case 'broadcast_message':
          await this.broadcastMessage(agentId, message);
          break;

        default:
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: `Unknown message type: ${message.type}` 
          }));
      }
    } catch (error) {
      console.error('WebSocket message handling error:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Failed to process message' 
      }));
    }
  }

  /**
   * Update agent status
   */
  private async updateAgentStatus(agentId: string, status: AgentStatus): Promise<void> {
    try {
      const agentData = await this.redis.hget('agents:active', agentId);
      if (agentData) {
        const agent = JSON.parse(agentData);
        agent.status = status;
        agent.lastSeen = new Date().toISOString();
        
        await this.redis.hset('agents:active', agentId, JSON.stringify(agent));
        
        // Broadcast status update
        await this.broadcastStatusUpdate(agentId, status);
      }
    } catch (error) {
      console.error('Update agent status error:', error);
      throw error;
    }
  }

  /**
   * Broadcast message to connected agents
   */
  private async broadcastMessage(fromAgentId: string, message: any): Promise<void> {
    try {
      const connections = await this.redis.hgetall('ws:connections');
      
      for (const [agentId, status] of Object.entries(connections)) {
        if (agentId !== fromAgentId && status === 'connected') {
          // Send via WebSocket if available, otherwise queue for later
          // Implementation would depend on WebSocket connection management
        }
      }
    } catch (error) {
      console.error('Broadcast message error:', error);
      throw error;
    }
  }

  /**
   * Broadcast agent status update
   */
  private async broadcastStatusUpdate(agentId: string, status: AgentStatus): Promise<void> {
    try {
      const statusMessage = {
        type: 'agent_status_update',
        agentId,
        status,
        timestamp: new Date().toISOString()
      };

      await this.broadcastMessage(agentId, statusMessage);
    } catch (error) {
      console.error('Broadcast status update error:', error);
      throw error;
    }
  }

  /**
   * Error handling middleware
   */
  private handleError(error: any, req: Request, res: Response, next: any): void {
    console.error('API Error:', error);

    if (res.headersSent) {
      return next(error);
    }

    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';

    res.status(statusCode).json({
      success: false,
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      console.log(`Received ${signal}. Starting graceful shutdown...`);

      try {
        // Close WebSocket server
        if (this.wsServer) {
          this.wsServer.close();
        }

        // Close HTTP server
        if (this.server) {
          this.server.close();
        }

        // Disconnect Kafka
        await this.kafkaProducer.disconnect();
        await this.kafkaConsumer.disconnect();
        await this.kafkaAdmin.disconnect();

        // Close Redis connection
        await this.redis.quit();

        console.log('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Start the message bus service
   */
  public async start(): Promise<void> {
    try {
      console.log('Starting Message Bus Service...');

      // Connect to Redis
      await this.redis.connect();
      console.log('Connected to Redis');

      // Initialize Kafka
      await this.kafkaAdmin.connect();
      await this.kafkaAdmin.createTopics();
      
      await this.kafkaProducer.connect();
      await this.kafkaConsumer.connect();
      console.log('Connected to Kafka');

      // Start Kafka consumer
      await this.kafkaConsumer.startConsuming(
        this.messageHandler.handleKafkaMessage.bind(this.messageHandler)
      );

      // Start HTTP server
      this.server = this.app.listen(this.port, () => {
        console.log(`Message Bus Service listening on port ${this.port}`);
        console.log(`WebSocket server listening on port ${this.port + 1}`);
        console.log('Service ready to handle inter-agent messages');
      });

    } catch (error) {
      console.error('Failed to start Message Bus Service:', error);
      throw error;
    }
  }
}

// Start the service if this file is run directly
if (require.main === module) {
  const service = new MessageBusService();
  service.start().catch((error) => {
    console.error('Service startup failed:', error);
    process.exit(1);
  });
}

export default MessageBusService;
```