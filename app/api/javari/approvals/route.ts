// app/api/javari/approvals/route.ts
// Approval Queue Management API

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, id, approvedBy, rejectedBy, reason } = body
    
    switch (action) {
      case 'approve':
        // Update status
        await supabase
          .from('pending_approvals')
          .update({
            status: 'approved',
            approved_by: approvedBy,
            approved_at: new Date().toISOString()
          })
          .eq('id', id)
        
        // Get the approval details
        const { data: approval } = await supabase
          .from('pending_approvals')
          .select('*')
          .eq('id', id)
          .single()
        
        if (approval) {
          // Execute the command
          const execResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://javariai.com'}/api/javari/business`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              command: approval.command_text,
              userId: approvedBy,
              isApproved: true,
              approvalId: id
            })
          })
          
          const execResult = await execResponse.json()
          
          // Log the action
          await supabase.from('admin_actions').insert({
            action: 'approval_executed',
            target_user: approval.requested_by,
            parameters: { approvalId: id, result: execResult },
            status: execResult.success ? 'success' : 'error',
            executed_by: approvedBy,
            executed_at: new Date().toISOString()
          })
          
          return NextResponse.json({ 
            success: true, 
            message: 'Approved and executed',
            result: execResult 
          })
        }
        
        return NextResponse.json({ success: true, message: 'Approved' })
      
      case 'reject':
        await supabase
          .from('pending_approvals')
          .update({
            status: 'rejected',
            approved_by: rejectedBy,
            approved_at: new Date().toISOString(),
            rejection_reason: reason
          })
          .eq('id', id)
        
        return NextResponse.json({ success: true, message: 'Rejected' })
      
      case 'create':
        // Create new approval request
        const { data: newApproval, error } = await supabase
          .from('pending_approvals')
          .insert({
            command_text: body.commandText,
            category: body.category,
            parameters: body.parameters,
            risk_level: body.riskLevel || 'medium',
            status: 'pending',
            requested_by: body.requestedBy || 'system',
            requested_at: new Date().toISOString()
          })
          .select()
          .single()
        
        if (error) throw error
        return NextResponse.json({ success: true, approval: newApproval })
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Approval error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  
  let query = supabase
    .from('pending_approvals')
    .select('*')
    .order('requested_at', { ascending: false })
  
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }
  
  const { data, error } = await query.limit(50)
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  const pending = data?.filter(a => a.status === 'pending').length || 0
  const approved = data?.filter(a => a.status === 'approved').length || 0
  const rejected = data?.filter(a => a.status === 'rejected').length || 0
  
  return NextResponse.json({
    success: true,
    approvals: data || [],
    stats: { pending, approved, rejected, total: data?.length || 0 }
  })
}
