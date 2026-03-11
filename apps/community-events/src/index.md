# Deploy Community Event Calendar Microservice

# Community Event Calendar Microservice

## Purpose
The Community Event Calendar Microservice is a Node.js application that facilitates the management of community events, meetups, and workshops. It offers features including RSVP functionality, calendar integrations, automated reminders, feedback collection, and real-time notifications.

## Usage
To deploy the Community Event Calendar Microservice, follow these steps:
1. Set up the environment variables based on the `ServerConfig` interface.
2. Install the necessary dependencies using a package manager, such as npm or yarn.
3. Start the service using Node.js.

## Parameters/Props

### `ServerConfig`
This interface defines the required configuration parameters to initialize the microservice:

- `port` (number): The port on which the service listens.
- `nodeEnv` (string): The environment in which the service runs (e.g., "development", "production").
- `supabaseUrl` (string): The URL for Supabase backend services.
- `supabaseAnonKey` (string): The Anon key for Supabase authentication.
- `supabaseServiceKey` (string): The service key for secure access to Supabase.
- `jwtSecret` (string): Secret key used for JSON Web Token (JWT) signing.
- `googleCalendarCredentials?` (string): Optional credentials for Google Calendar integration.
- `outlookClientId?` (string): Optional client ID for Outlook integration.
- `outlookClientSecret?` (string): Optional client secret for Outlook integration.
- `emailProvider` ('sendgrid' | 'ses' | 'nodemailer'): The service used for sending emails.
- `emailApiKey?` (string): Optional API key for the email service provider.
- `smsProvider?` ('twilio' | 'aws-sns'): The service used for sending SMS notifications.
- `smsApiKey?` (string): Optional API key for the SMS service provider.
- `redisUrl?` (string): Optional URL for Redis caching.

### `EventCalendarApp`
This interface represents the main application structure:

- `app` (Application): The Express application instance.
- `eventService` (EventService): Service responsible for managing events.
- `calendarService` (CalendarIntegrationService): Service for calendar integrations.
- `reminderService` (ReminderService): Service to handle automated reminders.
- `notificationService` (NotificationService): Service for real-time notifications.
- `reminderWorker?` (Worker): Optional worker thread for handling reminders.
- `calendarSyncWorker?` (Worker): Optional worker thread for calendar synchronization.

## Return Values
The microservice launches an HTTP server, which will listen on the specified port to handle requests related to community events. It returns created application routes for event management, RSVP handling, and feedback submission.

## Examples

### Basic Configuration & Startup
```typescript
import { ServerConfig, EventCalendarApp } from './index';

const serverConfig: ServerConfig = {
  port: 3000,
  nodeEnv: 'development',
  supabaseUrl: 'https://your-supabase-url.supabase.co',
  supabaseAnonKey: 'your-anon-key',
  supabaseServiceKey: 'your-service-key',
  jwtSecret: 'your-jwt-secret',
  emailProvider: 'sendgrid',
  emailApiKey: 'your-email-api-key',
  smsProvider: 'twilio',
  smsApiKey: 'your-sms-api-key',
};

const app: EventCalendarApp = createEventCalendarApp(serverConfig);
app.listen(serverConfig.port, () => {
  console.log(`Server running on port ${serverConfig.port}`);
});
```

This example initializes the Community Event Calendar Microservice with basic server configuration and starts the application on the defined port.