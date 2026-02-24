# NotificationOS (Javari Inbox) - Phase 1 MVP

**Version:** 1.0.0  
**Status:** ✅ COMPLETE  
**Created:** 2026-01-29  
**Repository:** CR-AudioViz-AI/javari-ai

---

## Overview

NotificationOS is the universal notification delivery system for CRAudioVizAI. Phase 1 implements email notifications, in-app messaging, system alerts, and event-triggered messages with extensibility for SMS/push notifications in Phase 2.

---

## Phase 1 Features

### ✅ Implemented

1. **Database Schema**
   - `notifications` - Core notification storage with multi-channel support
   - `notification_templates` - Reusable templates with variable substitution
   - `notification_delivery_log` - Immutable audit log of delivery attempts
   - `notification_preferences` - User preferences and consent management

2. **Row Level Security (RLS)**
   - Users can only view/update their own notifications
   - Service role has full access for system operations
   - Delivery logs inherit notification permissions
   - Preferences are user-specific

3. **API Routes**
   - `POST /api/notifications/send` - Send notification (direct or from template)
   - `GET /api/notifications` - List user notifications with filtering
   - `PATCH /api/notifications/[id]/read` - Mark specific notification as read
   - `PATCH /api/notifications/read-all` - Mark all notifications as read

4. **Service Layer**
   - NotificationService class with full CRUD operations
   - Template-based notifications with variable substitution
   - Deduplication support (24-hour window)
   - Automatic retry with exponential backoff
   - Delivery audit logging

5. **Delivery Channels**
   - ✅ Email (console mode for development)
   - ✅ In-app notifications (database storage)
   - ⚠️ SMS (schema ready, not implemented)
   - ⚠️ Push (schema ready, not implemented)

6. **Default Templates**
   - Welcome email
   - Password reset
   - System alerts
   - Task completion notifications

### ⚠️ Deferred to Phase 2

- SMS delivery (Twilio integration)
- Push notifications (Firebase/OneSignal)
- Email providers (Resend, SendGrid, SMTP)
- Quiet hours enforcement
- Advanced escalation rules
- Notification batching/digests
- Rich in-app notification UI

---

## Installation

### 1. Run Database Migration

```bash
# From javari-ai repository root
psql $DATABASE_URL -f database/migrations/notificationos.sql
```

Or use Supabase dashboard:
1. Go to SQL Editor
2. Paste contents of `notificationos_schema.sql`
3. Run migration

### 2. Install Service Layer

```bash
# Create directory if it doesn't exist
mkdir -p lib/notificationos

# Copy service file
cp notification-service.ts lib/notificationos/index.ts
```

### 3. Install API Routes

```bash
# Create directories
mkdir -p app/api/notifications/send
mkdir -p app/api/notifications/read-all
mkdir -p app/api/notifications/[id]/read

# Copy route files
cp route-send.ts app/api/notifications/send/route.ts
cp route-list.ts app/api/notifications/route.ts
cp route-read.ts app/api/notifications/[id]/read/route.ts
cp route-read-all.ts app/api/notifications/read-all/route.ts
```

### 4. Configure Environment Variables

```bash
# .env.local
EMAIL_PROVIDER=console  # Options: console, smtp, resend, sendgrid
```

---

## Usage

### Send Direct Notification

```typescript
import { NotificationService } from '@/lib/notificationos';

await NotificationService.create({
  user_id: 'user-uuid',
  type: 'system',
  priority: 'normal',
  subject: 'Test Notification',
  body: 'This is a test notification',
  channel: 'email',
  send_immediately: true,
});
```

### Send from Template

```typescript
await NotificationService.sendFromTemplate({
  user_id: 'user-uuid',
  template_key: 'welcome',
  variables: {
    user_name: 'John Doe',
  },
  send_immediately: true,
});
```

### List User Notifications

```typescript
const notifications = await NotificationService.list('user-uuid', {
  status: 'unread',
  limit: 20,
  offset: 0,
});
```

### Mark as Read

```typescript
await NotificationService.markAsRead('notification-uuid', 'user-uuid');
```

---

## API Reference

### POST /api/notifications/send

Send a notification (direct or from template).

**Request Body (Direct):**
```json
{
  "user_id": "optional-user-uuid",
  "type": "system",
  "priority": "normal",
  "subject": "Subject line",
  "body": "Message body",
  "html_body": "<p>HTML body</p>",
  "channel": "email",
  "metadata": {},
  "tags": ["tag1", "tag2"],
  "send_immediately": true
}
```

**Request Body (Template):**
```json
{
  "template_key": "welcome",
  "variables": {
    "user_name": "John Doe"
  },
  "send_immediately": true
}
```

**Response:**
```json
{
  "success": true,
  "notification": { ... }
}
```

### GET /api/notifications

List user notifications.

**Query Parameters:**
- `status` - Filter by status (pending, sent, delivered, failed, read)
- `type` - Filter by type (email, system, alert, info, warning, error)
- `limit` - Number of results (default: 50)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "notifications": [...],
  "unread_count": 5,
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 42
  }
}
```

### PATCH /api/notifications/[id]/read

Mark a notification as read.

**Response:**
```json
{
  "success": true
}
```

### PATCH /api/notifications/read-all

Mark all notifications as read for current user.

**Response:**
```json
{
  "success": true
}
```

---

## Database Schema

### Tables

| Table | Purpose | RLS Enabled |
|-------|---------|-------------|
| `notifications` | Core notification storage | ✅ |
| `notification_templates` | Reusable templates | ✅ |
| `notification_delivery_log` | Immutable delivery audit | ✅ |
| `notification_preferences` | User preferences | ✅ |

### Key Features

- **Deduplication:** Use `dedup_key` to prevent duplicate notifications within 24 hours
- **Retry Logic:** Automatic retry with exponential backoff (max 3 attempts)
- **Audit Trail:** Every delivery attempt is logged immutably
- **Templates:** Support variable substitution with `{{variable}}` syntax
- **Auto-Preferences:** Created automatically for new users via trigger

---

## Configuration

### Email Providers

Set `EMAIL_PROVIDER` environment variable:

- `console` - Log to console (development)
- `smtp` - SMTP server (not implemented)
- `resend` - Resend.com (not implemented)
- `sendgrid` - SendGrid (not implemented)

Phase 1 uses console mode. Production email providers deferred to Phase 2.

---

## Testing

### Send Test Notification

```bash
curl -X POST https://your-app.vercel.app/api/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "subject": "Test Notification",
    "body": "This is a test",
    "channel": "email",
    "send_immediately": true
  }'
```

### List Notifications

```bash
curl https://your-app.vercel.app/api/notifications \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Monitoring

### Delivery Stats Query

```sql
SELECT 
  channel,
  status,
  COUNT(*) as count,
  AVG(duration_ms) as avg_duration_ms
FROM notification_delivery_log
WHERE attempted_at > NOW() - INTERVAL '24 hours'
GROUP BY channel, status;
```

### Failed Deliveries

```sql
SELECT *
FROM notifications
WHERE status = 'failed'
  AND delivery_attempts >= max_attempts
ORDER BY created_at DESC;
```

---

## Security

- ✅ Row Level Security enabled on all tables
- ✅ Users can only access their own notifications
- ✅ Service role required for system operations
- ✅ Delivery logs are append-only
- ✅ Templates managed by service role only

---

## Performance

- Indexed on: `user_id`, `status`, `created_at`, `read_at`
- Deduplication check limited to last 24 hours
- Automatic cleanup recommended (archive old notifications after 90 days)

---

## Next Steps (Phase 2)

1. Implement Resend/SendGrid email providers
2. Add SMS delivery (Twilio)
3. Add push notifications (Firebase)
4. Build rich in-app notification UI
5. Implement quiet hours enforcement
6. Add notification batching/digests
7. Build notification preferences UI
8. Add webhook delivery channel

---

## Files

- `database/migrations/notificationos.sql` - Database schema
- `lib/notificationos/index.ts` - Service layer
- `app/api/notifications/send/route.ts` - Send endpoint
- `app/api/notifications/route.ts` - List endpoint
- `app/api/notifications/[id]/read/route.ts` - Mark as read
- `app/api/notifications/read-all/route.ts` - Mark all as read

---

## Support

For issues or questions, see:
- MASTER_BIBLE v2.3.0 Section 58 (NotificationOS specification)
- MASTER_ROADMAP v3.1 Phase 1.3 (Core OS Architecture)

---

**Status:** ✅ Phase 1 MVP COMPLETE  
**Ready for:** Production deployment with console email mode  
**Requires for production:** Email provider configuration (Phase 2)
