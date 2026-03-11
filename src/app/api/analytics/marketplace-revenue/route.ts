```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MarketplaceTransaction {
  id: string;
  agent_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  commission: number;
  transaction_type: string;
  status: string;
  created_at: string;
  ai_agents: {
    name: string;
    category: string;
  };
  seller_profile: {
    username: string;
    display_name: string;
  };
  buyer_profile: {
    username: string;
    display_name: string;
  };
}

interface RevenueMetrics {
  totalRevenue: number;
  totalCommission: number;
  totalTransactions: number;
  averageTransactionValue: number;
  growthRate: number;
  topAgents: Array<{
    agentId: string;
    agentName: string;
    revenue: number;
    transactions: number;
    commission: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    revenue: number;
    transactions: number;
    percentage: number;
  }>;
  timeSeriesData: Array<{
    period: string;
    revenue: number;
    transactions: number;
    commission: number;
  }>;
}

async function validateAuth(request: NextRequest): Promise<string | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('supabase-auth-token')?.value;
    
    if (!token) {
      return null;
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }

    // Check if user has admin or analytics permissions
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, permissions')
      .eq('id', user.id)
      .single();

    if (!profile || (!profile.role?.includes('admin') && !profile.permissions?.includes('analytics'))) {
      return null;
    }

    return user.id;
  } catch (error) {
    console.error('Auth validation error:', error);
    return null;
  }
}

async function getMarketplaceAnalytics(
  startDate: string,
  endDate: string,
  period: string = 'daily',
  agentId?: string,
  category?: string,
  page: number = 1,
  limit: number = 100
): Promise<{ data: RevenueMetrics; pagination: any }> {
  try {
    let query = supabase
      .from('marketplace_transactions')
      .select(`
        id,
        agent_id,
        buyer_id,
        seller_id,
        amount,
        commission,
        transaction_type,
        status,
        created_at,
        ai_agents!inner(
          name,
          category
        ),
        seller_profile:user_profiles!seller_id(
          username,
          display_name
        ),
        buyer_profile:user_profiles!buyer_id(
          username,
          display_name
        )
      `)
      .eq('status', 'completed')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });

    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    if (category) {
      query = query.eq('ai_agents.category', category);
    }

    const { data: transactions, error, count } = await query
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    if (!transactions) {
      throw new Error('No transaction data retrieved');
    }

    // Calculate basic metrics
    const totalRevenue = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalCommission = transactions.reduce((sum, t) => sum + (t.commission || 0), 0);
    const totalTransactions = transactions.length;
    const averageTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Calculate growth rate (compare with previous period)
    const periodDays = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    const prevStartDate = new Date(new Date(startDate).getTime() - (periodDays * 24 * 60 * 60 * 1000)).toISOString();
    const prevEndDate = new Date(new Date(endDate).getTime() - (periodDays * 24 * 60 * 60 * 1000)).toISOString();

    const { data: prevTransactions } = await supabase
      .from('marketplace_transactions')
      .select('amount')
      .eq('status', 'completed')
      .gte('created_at', prevStartDate)
      .lte('created_at', prevEndDate);

    const prevRevenue = prevTransactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
    const growthRate = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    // Calculate top agents
    const agentMetrics = new Map();
    transactions.forEach(t => {
      const agentId = t.agent_id;
      const existing = agentMetrics.get(agentId) || {
        agentId,
        agentName: t.ai_agents?.name || 'Unknown',
        revenue: 0,
        transactions: 0,
        commission: 0
      };
      
      existing.revenue += t.amount || 0;
      existing.transactions += 1;
      existing.commission += t.commission || 0;
      
      agentMetrics.set(agentId, existing);
    });

    const topAgents = Array.from(agentMetrics.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Calculate category breakdown
    const categoryMetrics = new Map();
    transactions.forEach(t => {
      const category = t.ai_agents?.category || 'Other';
      const existing = categoryMetrics.get(category) || {
        category,
        revenue: 0,
        transactions: 0,
        percentage: 0
      };
      
      existing.revenue += t.amount || 0;
      existing.transactions += 1;
      
      categoryMetrics.set(category, existing);
    });

    const categoryBreakdown = Array.from(categoryMetrics.values())
      .map(c => ({
        ...c,
        percentage: totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Generate time series data
    const timeSeriesData = generateTimeSeriesData(transactions, period, startDate, endDate);

    const data: RevenueMetrics = {
      totalRevenue,
      totalCommission,
      totalTransactions,
      averageTransactionValue,
      growthRate,
      topAgents,
      categoryBreakdown,
      timeSeriesData
    };

    const pagination = {
      currentPage: page,
      totalPages: Math.ceil((count || 0) / limit),
      totalItems: count || 0,
      itemsPerPage: limit
    };

    return { data, pagination };

  } catch (error) {
    console.error('Analytics query error:', error);
    throw error;
  }
}

function generateTimeSeriesData(
  transactions: MarketplaceTransaction[],
  period: string,
  startDate: string,
  endDate: string
): Array<{ period: string; revenue: number; transactions: number; commission: number }> {
  const timeData = new Map();
  
  transactions.forEach(t => {
    let periodKey: string;
    const date = new Date(t.created_at);
    
    switch (period) {
      case 'hourly':
        periodKey = date.toISOString().slice(0, 13) + ':00:00.000Z';
        break;
      case 'daily':
        periodKey = date.toISOString().slice(0, 10);
        break;
      case 'weekly':
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        periodKey = startOfWeek.toISOString().slice(0, 10);
        break;
      case 'monthly':
        periodKey = date.toISOString().slice(0, 7);
        break;
      case 'yearly':
        periodKey = date.toISOString().slice(0, 4);
        break;
      default:
        periodKey = date.toISOString().slice(0, 10);
    }
    
    const existing = timeData.get(periodKey) || {
      period: periodKey,
      revenue: 0,
      transactions: 0,
      commission: 0
    };
    
    existing.revenue += t.amount || 0;
    existing.transactions += 1;
    existing.commission += t.commission || 0;
    
    timeData.set(periodKey, existing);
  });
  
  return Array.from(timeData.values()).sort((a, b) => a.period.localeCompare(b.period));
}

function generateCSV(data: RevenueMetrics): string {
  const headers = ['Period', 'Revenue', 'Transactions', 'Commission'];
  const rows = data.timeSeriesData.map(item => [
    item.period,
    item.revenue.toString(),
    item.transactions.toString(),
    item.commission.toString()
  ]);
  
  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');
    
  return csvContent;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await validateAuth(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const period = searchParams.get('period') || 'daily';
    const agentId = searchParams.get('agentId');
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000);
    const format = searchParams.get('format') || 'json';

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    if (!['hourly', 'daily', 'weekly', 'monthly', 'yearly'].includes(period)) {
      return NextResponse.json(
        { error: 'Invalid period. Must be one of: hourly, daily, weekly, monthly, yearly' },
        { status: 400 }
      );
    }

    const result = await getMarketplaceAnalytics(
      startDate,
      endDate,
      period,
      agentId || undefined,
      category || undefined,
      page,
      limit
    );

    if (format === 'csv') {
      const csvContent = generateCSV(result.data);
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="marketplace-revenue-${startDate}-${endDate}.csv"`
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      metadata: {
        generatedAt: new Date().toISOString(),
        period,
        dateRange: { startDate, endDate },
        filters: {
          agentId: agentId || null,
          category: category || null
        }
      }
    });

  } catch (error) {
    console.error('Marketplace revenue analytics API error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: 'Analytics processing failed',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```