```typescript
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { Worker } from 'worker_threads';
import path from 'path';

// Routes
import eventsRouter from './routes/events';
import rsvpRouter from './routes/rsvp';
import feedbackRouter from './routes/feedback';

// Middleware
import { authMiddleware } from './middleware/auth';
import { validationMiddleware } from './middleware/validation';

// Services
import { EventService } from './services/EventService';
import { CalendarIntegrationService } from './services/CalendarIntegrationService';
import { ReminderService } from './services/ReminderService';
import { NotificationService } from './services/NotificationService';

/**
 * Community Event Calendar Microservice
 * 
 * Manages community events, meetups, and workshops with:
 * - RSVP functionality
 * - Calendar integration (Google, Outlook, iCal)
 * - Automated email/SMS reminders
 * - Post-event feedback collection
 * - Real-time notifications
 * 
 * @version 1.0.0
 * @author CR AudioViz AI Team
 */

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
  jwtSecret: string;
  googleCalendarCredentials?: string;
  outlookClientId?: string;
  outlookClientSecret?: string;
  emailProvider: 'sendgrid' | 'ses' | 'nodemailer';
  emailApiKey?: string;
  smsProvider?: 'twilio' | 'aws-sns';
  smsApiKey?: string;
  redisUrl?: string;
}

export interface EventCalendarApp {
  app: Application;
  eventService: EventService;
  calendarService: CalendarIntegrationService;
  reminderService: ReminderService;
  notificationService: NotificationService;
  reminderWorker?: Worker;
  calendarSyncWorker?: Worker;
}

/**
 * Application configuration from environment variables
 */
const config: ServerConfig = {
  port: parseInt(process.env.PORT || '3004', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  jwtSecret: process.env.JWT_SECRET || 'community-events-secret',
  googleCalendarCredentials: process.env.GOOGLE_CALENDAR_CREDENTIALS,
  outlookClientId: process.env.OUTLOOK_CLIENT_ID,
  outlookClientSecret: process.env.OUTLOOK_CLIENT_SECRET,
  emailProvider: (process.env.EMAIL_PROVIDER as 'sendgrid' | 'ses' | 'nodemailer') || 'nodemailer',
  emailApiKey: process.env.EMAIL_API_KEY,
  smsProvider: process.env.SMS_PROVIDER as 'twilio' | 'aws-sns',
  smsApiKey: process.env.SMS_API_KEY,
  redisUrl: process.env.REDIS_URL,
};

/**
 * Rate limiting configuration
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
});

/**
 * Initialize Supabase client
 */
const supabase = createClient(
  config.supabaseUrl,
  config.supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Create and configure Express application
 */
export function createApp(): EventCalendarApp {
  const app: Application = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));

  // CORS configuration
  app.use(cors({
    origin: config.nodeEnv === 'production' 
      ? ['https://cravatar.ai', 'https://app.cravatar.ai']
      : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  }));

  // General middleware
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(limiter);

  // Logging
  if (config.nodeEnv !== 'test') {
    app.use(morgan('combined'));
  }

  // Initialize services
  const eventService = new EventService(supabase);
  const calendarService = new CalendarIntegrationService({
    googleCredentials: config.googleCalendarCredentials,
    outlookClientId: config.outlookClientId,
    outlookClientSecret: config.outlookClientSecret,
  });
  const notificationService = new NotificationService({
    emailProvider: config.emailProvider,
    emailApiKey: config.emailApiKey,
    smsProvider: config.smsProvider,
    smsApiKey: config.smsApiKey,
  });
  const reminderService = new ReminderService(
    supabase,
    notificationService,
    config.redisUrl
  );

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'healthy',
      service: 'community-events',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // API documentation endpoint
  app.get('/api/docs', (req: Request, res: Response) => {
    res.status(200).json({
      service: 'Community Event Calendar Microservice',
      version: '1.0.0',
      endpoints: {
        events: {
          'GET /api/events': 'List all events with optional filtering',
          'POST /api/events': 'Create new event',
          'GET /api/events/:id': 'Get specific event details',
          'PUT /api/events/:id': 'Update event',
          'DELETE /api/events/:id': 'Delete event',
          'POST /api/events/:id/publish': 'Publish event',
        },
        rsvp: {
          'POST /api/rsvp': 'RSVP to event',
          'GET /api/rsvp/event/:eventId': 'Get event RSVPs',
          'PUT /api/rsvp/:id': 'Update RSVP status',
          'DELETE /api/rsvp/:id': 'Cancel RSVP',
        },
        feedback: {
          'POST /api/feedback': 'Submit event feedback',
          'GET /api/feedback/event/:eventId': 'Get event feedback',
          'GET /api/feedback/stats/:eventId': 'Get feedback statistics',
        },
        calendar: {
          'GET /api/events/:id/calendar/google': 'Get Google Calendar link',
          'GET /api/events/:id/calendar/outlook': 'Get Outlook Calendar link',
          'GET /api/events/:id/calendar/ical': 'Download iCal file',
        },
      },
    });
  });

  // API routes
  app.use('/api/events', eventsRouter);
  app.use('/api/rsvp', rsvpRouter);
  app.use('/api/feedback', feedbackRouter);

  // Calendar integration endpoints
  app.get('/api/events/:id/calendar/:provider', async (req: Request, res: Response) => {
    try {
      const { id, provider } = req.params;
      const event = await eventService.getEventById(id);

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      switch (provider) {
        case 'google':
          const googleUrl = calendarService.generateGoogleCalendarLink(event);
          res.redirect(googleUrl);
          break;
        case 'outlook':
          const outlookUrl = calendarService.generateOutlookCalendarLink(event);
          res.redirect(outlookUrl);
          break;
        case 'ical':
          const icalData = calendarService.generateICalFile(event);
          res.setHeader('Content-Type', 'text/calendar');
          res.setHeader('Content-Disposition', `attachment; filename="${event.title}.ics"`);
          res.send(icalData);
          break;
        default:
          res.status(400).json({ error: 'Invalid calendar provider' });
      }
    } catch (error) {
      console.error('Calendar integration error:', error);
      res.status(500).json({ error: 'Calendar integration failed' });
    }
  });

  // Error handling middleware
  app.use((error: any, req: Request, res: Response, next: any) => {
    console.error('Unhandled error:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        error: 'Resource already exists',
        details: error.detail,
      });
    }
    
    if (error.code === '23503') { // Foreign key constraint violation
      return res.status(400).json({
        error: 'Invalid reference to related resource',
        details: error.detail,
      });
    }

    res.status(error.status || 500).json({
      error: config.nodeEnv === 'production' 
        ? 'Internal server error' 
        : error.message,
      ...(config.nodeEnv !== 'production' && { stack: error.stack }),
    });
  });

  // 404 handler
  app.use('*', (req: Request, res: Response) => {
    res.status(404).json({
      error: 'Endpoint not found',
      path: req.originalUrl,
      method: req.method,
    });
  });

  // Initialize background workers
  let reminderWorker: Worker | undefined;
  let calendarSyncWorker: Worker | undefined;

  if (config.nodeEnv !== 'test') {
    // Start reminder worker
    reminderWorker = new Worker(
      path.resolve(__dirname, './workers/reminderWorker.js'),
      {
        workerData: {
          supabaseUrl: config.supabaseUrl,
          supabaseServiceKey: config.supabaseServiceKey,
          notificationConfig: {
            emailProvider: config.emailProvider,
            emailApiKey: config.emailApiKey,
            smsProvider: config.smsProvider,
            smsApiKey: config.smsApiKey,
          },
        },
      }
    );

    reminderWorker.on('error', (error) => {
      console.error('Reminder worker error:', error);
    });

    // Start calendar sync worker
    calendarSyncWorker = new Worker(
      path.resolve(__dirname, './workers/calendarSyncWorker.js'),
      {
        workerData: {
          supabaseUrl: config.supabaseUrl,
          supabaseServiceKey: config.supabaseServiceKey,
          calendarConfig: {
            googleCredentials: config.googleCalendarCredentials,
            outlookClientId: config.outlookClientId,
            outlookClientSecret: config.outlookClientSecret,
          },
        },
      }
    );

    calendarSyncWorker.on('error', (error) => {
      console.error('Calendar sync worker error:', error);
    });
  }

  return {
    app,
    eventService,
    calendarService,
    reminderService,
    notificationService,
    reminderWorker,
    calendarSyncWorker,
  };
}

/**
 * Start the server
 */
export function startServer(): Promise<EventCalendarApp> {
  return new Promise((resolve, reject) => {
    try {
      const appInstance = createApp();
      
      const server = appInstance.app.listen(config.port, () => {
        console.log(`🎉 Community Events Service running on port ${config.port}`);
        console.log(`📅 Environment: ${config.nodeEnv}`);
        console.log(`🔗 API Documentation: http://localhost:${config.port}/api/docs`);
        console.log(`❤️  Health Check: http://localhost:${config.port}/health`);
        
        resolve(appInstance);
      });

      server.on('error', (error) => {
        console.error('Server startup error:', error);
        reject(error);
      });

      // Graceful shutdown handling
      const shutdown = async () => {
        console.log('🔄 Shutting down Community Events Service...');
        
        try {
          // Terminate workers
          if (appInstance.reminderWorker) {
            await appInstance.reminderWorker.terminate();
          }
          if (appInstance.calendarSyncWorker) {
            await appInstance.calendarSyncWorker.terminate();
          }

          server.close(() => {
            console.log('✅ Community Events Service shut down gracefully');
            process.exit(0);
          });
        } catch (error) {
          console.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
      };

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);

    } catch (error) {
      console.error('Failed to start Community Events Service:', error);
      reject(error);
    }
  });
}

// Start server if running directly
if (require.main === module) {
  startServer().catch((error) => {
    console.error('Fatal startup error:', error);
    process.exit(1);
  });
}

export default createApp;
```