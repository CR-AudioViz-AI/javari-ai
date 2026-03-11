```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { z } from 'zod';
import { rateLimit } from '@/lib/middleware/rate-limit';
import { auditLogger } from '@/lib/compliance/audit-logger';
import { reportGenerator } from '@/lib/compliance/report-generator';
import { encryptionService } from '@/lib/security/encryption';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validation schemas
const ComplianceReportRequestSchema = z.object({
  reportType: z.enum(['SOX', 'GDPR', 'HIPAA', 'COMBINED']),
  dateRange: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime()
  }),
  includeAuditTrail: z.boolean().optional().default(true),
  format: z.enum(['PDF', 'JSON', 'CSV']).optional().default('PDF'),
  deliveryMethod: z.enum(['DOWNLOAD', 'EMAIL']).optional().default('DOWNLOAD'),
  emailRecipients: z.array(z.string().email()).optional(),
  organizationId: z.string().uuid()
});

const ComplianceQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
  limit: z.string().regex(/^[1-9]\d{0,2}$/).transform(Number).optional().default(50),
  reportType: z.enum(['SOX', 'GDPR', 'HIPAA', 'COMBINED']).optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED']).optional(),
  organizationId: z.string().uuid()
});

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 compliance report requests per window
  message: 'Too many compliance report requests. Please try again later.'
});

// Generate compliance report
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await limiter(request);
    if (rateLimitResult) return rateLimitResult;

    // Authenticate and authorize
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify admin role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role, organization_id')
      .eq('user_id', session.user.id)
      .single();

    if (!userRole || !['ADMIN', 'COMPLIANCE_OFFICER'].includes(userRole.role)) {
      await auditLogger.log({
        userId: session.user.id,
        action: 'COMPLIANCE_REPORT_ACCESS_DENIED',
        resource: 'compliance_reports',
        details: { reason: 'insufficient_permissions' },
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      });

      return NextResponse.json(
        { error: 'Insufficient permissions for compliance reporting' },
        { status: 403 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validatedData = ComplianceReportRequestSchema.parse({
      ...body,
      organizationId: userRole.organization_id
    });

    // Log report generation request
    await auditLogger.log({
      userId: session.user.id,
      action: 'COMPLIANCE_REPORT_REQUESTED',
      resource: 'compliance_reports',
      details: {
        reportType: validatedData.reportType,
        dateRange: validatedData.dateRange,
        format: validatedData.format
      },
      ipAddress: request.ip || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    // Generate unique report ID
    const reportId = `${validatedData.reportType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create report record
    const { data: reportRecord, error: reportError } = await supabase
      .from('compliance_reports')
      .insert({
        id: reportId,
        organization_id: validatedData.organizationId,
        report_type: validatedData.reportType,
        status: 'PENDING',
        requested_by: session.user.id,
        date_range_start: validatedData.dateRange.startDate,
        date_range_end: validatedData.dateRange.endDate,
        format: validatedData.format,
        delivery_method: validatedData.deliveryMethod,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (reportError) {
      throw new Error(`Failed to create report record: ${reportError.message}`);
    }

    // Generate report asynchronously
    const reportResult = await reportGenerator.generate({
      reportId,
      organizationId: validatedData.organizationId,
      reportType: validatedData.reportType,
      dateRange: validatedData.dateRange,
      includeAuditTrail: validatedData.includeAuditTrail,
      format: validatedData.format,
      requestedBy: session.user.id
    });

    // Update report status
    await supabase
      .from('compliance_reports')
      .update({
        status: 'COMPLETED',
        file_path: reportResult.filePath,
        file_size: reportResult.fileSize,
        completed_at: new Date().toISOString(),
        metadata: encryptionService.encrypt(JSON.stringify(reportResult.metadata))
      })
      .eq('id', reportId);

    // Handle delivery
    if (validatedData.deliveryMethod === 'EMAIL' && validatedData.emailRecipients?.length) {
      // Email delivery would be handled by a background job
      await supabase
        .from('compliance_report_deliveries')
        .insert(
          validatedData.emailRecipients.map(email => ({
            report_id: reportId,
            delivery_method: 'EMAIL',
            recipient: email,
            status: 'PENDING',
            scheduled_at: new Date().toISOString()
          }))
        );
    }

    // Log successful generation
    await auditLogger.log({
      userId: session.user.id,
      action: 'COMPLIANCE_REPORT_GENERATED',
      resource: 'compliance_reports',
      details: {
        reportId,
        reportType: validatedData.reportType,
        fileSize: reportResult.fileSize
      },
      ipAddress: request.ip || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    return NextResponse.json({
      success: true,
      data: {
        reportId,
        status: 'COMPLETED',
        downloadUrl: validatedData.deliveryMethod === 'DOWNLOAD' ? reportResult.downloadUrl : null,
        generatedAt: new Date().toISOString(),
        fileSize: reportResult.fileSize,
        metadata: {
          reportType: validatedData.reportType,
          dateRange: validatedData.dateRange,
          format: validatedData.format,
          recordsProcessed: reportResult.metadata.recordsProcessed,
          complianceScore: reportResult.metadata.complianceScore
        }
      }
    });

  } catch (error) {
    console.error('Compliance report generation error:', error);

    // Log error
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    await auditLogger.log({
      userId: (await getServerSession(authOptions))?.user?.id || 'anonymous',
      action: 'COMPLIANCE_REPORT_ERROR',
      resource: 'compliance_reports',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
      ipAddress: request.ip || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    return NextResponse.json(
      { error: 'Failed to generate compliance report' },
      { status: 500 }
    );
  }
}

// Get compliance reports
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await limiter(request);
    if (rateLimitResult) return rateLimitResult;

    // Authenticate and authorize
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify role and get organization
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role, organization_id')
      .eq('user_id', session.user.id)
      .single();

    if (!userRole || !['ADMIN', 'COMPLIANCE_OFFICER', 'VIEWER'].includes(userRole.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const validatedQuery = ComplianceQuerySchema.parse({
      ...queryParams,
      organizationId: userRole.organization_id
    });

    // Build query
    let query = supabase
      .from('compliance_reports')
      .select(`
        id,
        report_type,
        status,
        requested_by,
        date_range_start,
        date_range_end,
        format,
        delivery_method,
        file_size,
        created_at,
        completed_at,
        user_profiles!requested_by (
          full_name,
          email
        )
      `)
      .eq('organization_id', validatedQuery.organizationId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (validatedQuery.reportType) {
      query = query.eq('report_type', validatedQuery.reportType);
    }

    if (validatedQuery.status) {
      query = query.eq('status', validatedQuery.status);
    }

    // Apply pagination
    const offset = (validatedQuery.page - 1) * validatedQuery.limit;
    query = query.range(offset, offset + validatedQuery.limit - 1);

    const { data: reports, error: reportsError, count } = await query;

    if (reportsError) {
      throw new Error(`Failed to fetch reports: ${reportsError.message}`);
    }

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('compliance_reports')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', validatedQuery.organizationId);

    // Log access
    await auditLogger.log({
      userId: session.user.id,
      action: 'COMPLIANCE_REPORTS_ACCESSED',
      resource: 'compliance_reports',
      details: {
        page: validatedQuery.page,
        limit: validatedQuery.limit,
        filters: { reportType: validatedQuery.reportType, status: validatedQuery.status }
      },
      ipAddress: request.ip || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    return NextResponse.json({
      success: true,
      data: {
        reports: reports || [],
        pagination: {
          page: validatedQuery.page,
          limit: validatedQuery.limit,
          total: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / validatedQuery.limit)
        }
      }
    });

  } catch (error) {
    console.error('Compliance reports fetch error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch compliance reports' },
      { status: 500 }
    );
  }
}

// Delete compliance report
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify admin role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role, organization_id')
      .eq('user_id', session.user.id)
      .single();

    if (!userRole || userRole.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin permissions required' },
        { status: 403 }
      );
    }

    const { reportId } = await request.json();

    if (!reportId || typeof reportId !== 'string') {
      return NextResponse.json(
        { error: 'Valid report ID required' },
        { status: 400 }
      );
    }

    // Verify report ownership and get file path
    const { data: report } = await supabase
      .from('compliance_reports')
      .select('file_path')
      .eq('id', reportId)
      .eq('organization_id', userRole.organization_id)
      .single();

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // Delete file from storage
    if (report.file_path) {
      await supabase.storage
        .from('compliance-reports')
        .remove([report.file_path]);
    }

    // Delete report record
    const { error: deleteError } = await supabase
      .from('compliance_reports')
      .delete()
      .eq('id', reportId)
      .eq('organization_id', userRole.organization_id);

    if (deleteError) {
      throw new Error(`Failed to delete report: ${deleteError.message}`);
    }

    // Log deletion
    await auditLogger.log({
      userId: session.user.id,
      action: 'COMPLIANCE_REPORT_DELETED',
      resource: 'compliance_reports',
      details: { reportId },
      ipAddress: request.ip || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    return NextResponse.json({
      success: true,
      message: 'Compliance report deleted successfully'
    });

  } catch (error) {
    console.error('Compliance report deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete compliance report' },
      { status: 500 }
    );
  }
}
```