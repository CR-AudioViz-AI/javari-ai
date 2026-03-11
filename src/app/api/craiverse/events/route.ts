```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Pusher from 'pusher'
import Stripe from 'stripe'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import { verifyAuth } from '@/lib/auth'
import Redis from 'ioredis'

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true
})

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

const redis = new Redis(process.env.REDIS_URL!)

// Validation schemas
const eventCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(2000),
  event_type: z.enum(['concert', 'conference', 'meetup', 'workshop', 'panel']),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  max_participants: z.number().min(1).max(10000).optional(),
  is_private: z.boolean().default(false),
  requires_tickets: z.boolean().default(false),
  ticket_price: z.number().min(0).optional(),
  venue_type: z.enum(['audio_room', 'video_conference', 'hybrid', 'live_stream']),
  tags: z.array(z.string()).max(10).optional(),
  cover_image_url: z.string().url().optional(),
  streaming_platform: z.enum(['zoom', 'twilio', 'custom']).optional(),
  moderation_settings: z.object({
    require_approval: z.boolean().default(false),
    mute_participants: z.boolean().default(false),
    enable_chat: z.boolean().default(true),
    max_speakers: z.number().min(1).max(50).optional()
  }).optional()
})

const eventUpdateSchema = eventCreateSchema.partial()

const participantJoinSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['attendee', 'speaker', 'moderator']).default('attendee'),
  ticket_id: z.string().uuid().optional()
})

const ticketPurchaseSchema = z.object({
  quantity: z.number().min(1).max(10),
  payment_method_id: z.string(),
  user_email: z.string().email(),
  billing_details: z.object({
    name: z.string(),
    address: z.object({
      line1: z.string(),
      city: z.string(),
      state: z.string(),
      postal_code: z.string(),
      country: z.string()
    })
  })
})

// Helper functions
async function validateEventOwnership(eventId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('events')
    .select('creator_id')
    .eq('id', eventId)
    .single()
  
  return data?.creator_id === userId
}

async function generateStreamingCredentials(eventId: string, platform: string) {
  switch (platform) {
    case 'zoom':
      // Integration with Zoom API would go here
      return {
        meeting_id: `zoom_${eventId}`,
        join_url: `https://zoom.us/j/${eventId}`,
        password: Math.random().toString(36).substring(7)
      }
    case 'twilio':
      // Integration with Twilio Video API would go here
      return {
        room_name: `twilio_${eventId}`,
        access_token: 'twilio_token_here'
      }
    default:
      return {
        stream_key: `custom_${eventId}`,
        rtmp_url: `rtmp://stream.craiverse.com/live/${eventId}`
      }
  }
}

async function updateEventAnalytics(eventId: string, metric: string, value: number = 1) {
  const timestamp = new Date().toISOString()
  
  await supabase
    .from('event_analytics')
    .upsert({
      event_id: eventId,
      metric_type: metric,
      metric_value: value,
      timestamp: timestamp
    })
  
  // Update Redis cache for real-time metrics
  await redis.hincrby(`event:${eventId}:metrics`, metric, value)
}

// GET - List events with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const event_type = searchParams.get('type')
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')
    const is_live = searchParams.get('is_live') === 'true'
    const creator_id = searchParams.get('creator_id')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('events')
      .select(`
        *,
        creator:profiles(id, username, avatar_url),
        participants_count:event_participants(count),
        tickets_sold:event_tickets(count)
      `)
      .order('start_time', { ascending: true })
      .range(offset, offset + limit - 1)

    if (event_type) {
      query = query.eq('event_type', event_type)
    }

    if (start_date) {
      query = query.gte('start_time', start_date)
    }

    if (end_date) {
      query = query.lte('end_time', end_date)
    }

    if (creator_id) {
      query = query.eq('creator_id', creator_id)
    }

    if (is_live) {
      const now = new Date().toISOString()
      query = query
        .lte('start_time', now)
        .gte('end_time', now)
        .eq('status', 'live')
    }

    const { data: events, error, count } = await query

    if (error) {
      console.error('Events fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch events' },
        { status: 500 }
      )
    }

    // Get real-time metrics from Redis for each event
    const eventsWithMetrics = await Promise.all(
      (events || []).map(async (event) => {
        const metrics = await redis.hgetall(`event:${event.id}:metrics`)
        return {
          ...event,
          real_time_metrics: {
            current_participants: parseInt(metrics.current_participants || '0'),
            total_views: parseInt(metrics.total_views || '0'),
            peak_concurrent: parseInt(metrics.peak_concurrent || '0'),
            engagement_score: parseFloat(metrics.engagement_score || '0')
          }
        }
      })
    )

    return NextResponse.json({
      events: eventsWithMetrics,
      pagination: {
        page,
        limit,
        total: count,
        total_pages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    console.error('Events API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new event
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitResult = await rateLimit(identifier, 10, 3600) // 10 events per hour
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    // Auth verification
    const auth = await verifyAuth(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = eventCreateSchema.parse(body)

    // Validate event times
    const startTime = new Date(validatedData.start_time)
    const endTime = new Date(validatedData.end_time)
    const now = new Date()

    if (startTime <= now) {
      return NextResponse.json(
        { error: 'Event start time must be in the future' },
        { status: 400 }
      )
    }

    if (endTime <= startTime) {
      return NextResponse.json(
        { error: 'Event end time must be after start time' },
        { status: 400 }
      )
    }

    // Generate streaming credentials
    const streamingCredentials = validatedData.streaming_platform 
      ? await generateStreamingCredentials(
          crypto.randomUUID(), 
          validatedData.streaming_platform
        )
      : null

    // Create event
    const { data: event, error } = await supabase
      .from('events')
      .insert({
        ...validatedData,
        id: crypto.randomUUID(),
        creator_id: auth.user.id,
        status: 'scheduled',
        created_at: new Date().toISOString(),
        streaming_credentials: streamingCredentials
      })
      .select(`
        *,
        creator:profiles(id, username, avatar_url)
      `)
      .single()

    if (error) {
      console.error('Event creation error:', error)
      return NextResponse.json(
        { error: 'Failed to create event' },
        { status: 500 }
      )
    }

    // Initialize Redis metrics
    await redis.hmset(`event:${event.id}:metrics`, {
      current_participants: 0,
      total_views: 0,
      peak_concurrent: 0,
      engagement_score: 0
    })

    // Create Stripe product if tickets are required
    if (validatedData.requires_tickets && validatedData.ticket_price) {
      try {
        const product = await stripe.products.create({
          name: `Ticket for ${validatedData.title}`,
          description: validatedData.description,
          metadata: {
            event_id: event.id,
            creator_id: auth.user.id
          }
        })

        const price = await stripe.prices.create({
          unit_amount: Math.round(validatedData.ticket_price * 100),
          currency: 'usd',
          product: product.id
        })

        await supabase
          .from('events')
          .update({ 
            stripe_product_id: product.id,
            stripe_price_id: price.id 
          })
          .eq('id', event.id)

      } catch (stripeError) {
        console.error('Stripe product creation error:', stripeError)
        // Continue without failing the event creation
      }
    }

    // Broadcast event creation
    await pusher.trigger('craiverse-events', 'event-created', {
      event: event,
      creator: auth.user
    })

    await updateEventAnalytics(event.id, 'event_created')

    return NextResponse.json({ event }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Event creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update event
export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('id')

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      )
    }

    // Verify ownership
    const isOwner = await validateEventOwnership(eventId, auth.user.id)
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = eventUpdateSchema.parse(body)

    const { data: event, error } = await supabase
      .from('events')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId)
      .select(`
        *,
        creator:profiles(id, username, avatar_url)
      `)
      .single()

    if (error) {
      console.error('Event update error:', error)
      return NextResponse.json(
        { error: 'Failed to update event' },
        { status: 500 }
      )
    }

    // Broadcast event update
    await pusher.trigger(`event-${eventId}`, 'event-updated', { event })
    await updateEventAnalytics(eventId, 'event_updated')

    return NextResponse.json({ event })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Event update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Cancel/delete event
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('id')

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      )
    }

    // Verify ownership
    const isOwner = await validateEventOwnership(eventId, auth.user.id)
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Get event details for cleanup
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    // Process refunds if event has tickets
    if (event.requires_tickets && event.stripe_product_id) {
      try {
        const { data: tickets } = await supabase
          .from('event_tickets')
          .select('*')
          .eq('event_id', eventId)
          .eq('status', 'purchased')

        for (const ticket of tickets || []) {
          if (ticket.payment_intent_id) {
            await stripe.refunds.create({
              payment_intent: ticket.payment_intent_id,
              reason: 'requested_by_customer',
              metadata: {
                event_id: eventId,
                reason: 'event_cancelled'
              }
            })

            await supabase
              .from('event_tickets')
              .update({ status: 'refunded' })
              .eq('id', ticket.id)
          }
        }
      } catch (refundError) {
        console.error('Refund processing error:', refundError)
      }
    }

    // Soft delete event
    const { error } = await supabase
      .from('events')
      .update({ 
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId)

    if (error) {
      console.error('Event deletion error:', error)
      return NextResponse.json(
        { error: 'Failed to delete event' },
        { status: 500 }
      )
    }

    // Cleanup Redis data
    await redis.del(`event:${eventId}:metrics`)
    await redis.del(`event:${eventId}:participants`)

    // Broadcast event cancellation
    await pusher.trigger(`event-${eventId}`, 'event-cancelled', { 
      eventId,
      message: 'This event has been cancelled by the organizer'
    })

    await updateEventAnalytics(eventId, 'event_cancelled')

    return NextResponse.json({ 
      success: true, 
      message: 'Event cancelled successfully' 
    })

  } catch (error) {
    console.error('Event deletion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```