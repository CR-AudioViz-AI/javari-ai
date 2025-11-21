# Javari App Integration SDK

Comprehensive integration layer for all CR AudioViz AI applications providing monitoring, analytics, error tracking, and AI-powered features.

## Features

### 🔍 App Health Monitoring
- Real-time status tracking
- Performance metrics
- Error rate monitoring
- Uptime tracking
- Automatic health checks

### 🐛 Error Tracking & Auto-Fix
- Automatic error capture
- Global error handlers
- Pattern detection
- AI-powered auto-fix suggestions
- Error analytics

### 📊 Analytics & Insights
- User behavior tracking
- Feature usage statistics
- Conversion tracking
- A/B testing support
- Custom event tracking

### 💡 Feature Request System
- User feedback capture
- AI-powered prioritization
- Voting system
- Implementation tracking
- Insight generation

### 🎯 Performance Monitoring
- Core Web Vitals (LCP, FID, CLS)
- Navigation timing
- Resource timing
- Custom metrics
- Device type detection

## Installation

```typescript
import { JavariClient } from '@/lib/sdk'

// Initialize the SDK
const javari = new JavariClient({
  appId: 'your-app-id',
  appName: 'Your App Name',
  version: '1.0.0',
  environment: 'production'
})

// Initialize and start monitoring
await javari.initialize()
```

## Usage Examples

### Track User Events

```typescript
// Track page views
javari.analytics.pageView('/dashboard')

// Track feature usage
javari.analytics.featureUsed('pdf_export', {
  format: 'A4',
  pages: 5
})

// Track conversions
javari.analytics.conversion('subscription', 9.99, {
  plan: 'pro'
})
```

### Error Tracking

```typescript
// Errors are captured automatically, but you can also manually track
try {
  // Your code
} catch (error) {
  javari.errorTracker.captureError({
    message: error.message,
    stack: error.stack,
    level: 'error',
    context: { userId: 'user-123' }
  })
}

// Wrap async functions with error tracking
const result = await javari.errorTracker.captureAsyncError(
  async () => {
    return await riskyOperation()
  },
  { operation: 'data_sync' }
)
```

### Feature Requests

```typescript
// Submit feature request
const result = await javari.featureRequests.submit({
  userId: 'user-123',
  title: 'Add dark mode',
  description: 'Users want a dark theme option',
  priority: 'medium'
})

// Vote on existing request
await javari.featureRequests.vote('request-id', 'user-123')

// Get insights
const insights = await javari.featureRequests.getInsights()
console.log(insights.data.quickWins)
```

### Performance Tracking

```typescript
// Performance is tracked automatically, but you can add custom metrics
javari.performance.trackCustomMetric('api_response_time', 245, {
  endpoint: '/api/data',
  method: 'GET'
})

// Get performance stats
const stats = javari.performance.getStats()
```

### Health Monitoring

```typescript
// Health checks happen automatically, but you can get current status
const health = javari.monitor.getHealthStatus()
console.log(health.status) // 'healthy' | 'degraded' | 'down'

// Track users
javari.monitor.trackUser('user-123')

// Track requests
javari.monitor.trackRequest(150) // Response time in ms
```

## Configuration

### Environment Variables

```env
NEXT_PUBLIC_JAVARI_ENDPOINT=https://crav-javari.vercel.app
```

### SDK Options

```typescript
interface AppConfig {
  appId: string              // Unique app identifier
  appName: string            // Human-readable app name
  version: string            // App version (semver)
  environment: string        // 'development' | 'staging' | 'production'
  javariEndpoint?: string    // Optional custom endpoint
}
```

## Best Practices

### 1. Initialize Early

Initialize the SDK as early as possible in your app lifecycle:

```typescript
// In your root layout or _app.tsx
useEffect(() => {
  javari.initialize()
  
  return () => {
    javari.shutdown()
  }
}, [])
```

### 2. Set User Context

Set user information when available:

```typescript
javari.analytics.setUserId(user.id)
javari.analytics.setUserProperties({
  email: user.email,
  plan: user.subscription.plan,
  createdAt: user.createdAt
})
```

### 3. Track Key User Actions

Track important user interactions:

```typescript
javari.analytics.interaction('button', 'click', {
  buttonId: 'export-pdf',
  location: 'toolbar'
})
```

### 4. Handle Errors Gracefully

Use the error tracker to capture and report issues:

```typescript
window.addEventListener('unhandledrejection', (event) => {
  javari.errorTracker.captureError({
    message: `Unhandled Promise Rejection: ${event.reason}`,
    level: 'error'
  })
})
```

## API Reference

See [API Documentation](./API.md) for complete method references.

## Support

For issues or questions, contact the Javari team or open an issue in the repository.

## License

Proprietary - CR AudioViz AI, LLC
