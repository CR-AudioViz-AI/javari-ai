/**
 * JAVARI AI - KILL COMMAND API ENDPOINT
 * Roy-Only Emergency System Control
 * 
 * @version 1.0.0
 * @date November 21, 2025 - 11:09 PM EST
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  KillCommandSystem, 
  requireOwner,
  logSecurityAction 
} from '@/lib/security/javari-security';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { action, commandPhrase, reason, suspiciousActors } = body;

    // Require owner access (Roy only)
    await requireOwner(user.id);

    if (action === 'activate') {
      // ACTIVATE KILL COMMAND
      await KillCommandSystem.activate({
        userId: user.id,
        reason: reason || 'Manual kill command activation',
        commandPhrase,
        suspiciousActors: suspiciousActors || []
      });

      return NextResponse.json({
        success: true,
        message: 'Kill command activated - All Javari operations frozen',
        status: 'SYSTEM_LOCKED',
        timestamp: new Date().toISOString()
      });

    } else if (action === 'deactivate') {
      // DEACTIVATE KILL COMMAND
      await KillCommandSystem.deactivate({
        userId: user.id,
        commandPhrase,
        reason: reason || 'Manual kill command deactivation'
      });

      return NextResponse.json({
        success: true,
        message: 'Kill command deactivated - Operations resumed',
        status: 'SYSTEM_ACTIVE',
        timestamp: new Date().toISOString()
      });

    } else if (action === 'status') {
      // CHECK STATUS
      const isActive = await KillCommandSystem.isActive();
      
      return NextResponse.json({
        success: true,
        active: isActive,
        status: isActive ? 'SYSTEM_LOCKED' : 'SYSTEM_ACTIVE',
        timestamp: new Date().toISOString()
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use: activate, deactivate, or status' },
        { status: 400 }
      );
    }

  } catch (error: any) {
    // Log error
    console.error('Kill command error:', error);

    // Return appropriate error
    if (error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    if (error.message.includes('Invalid kill command phrase')) {
      return NextResponse.json(
        { error: 'Invalid kill command phrase provided' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint to check status (doesn't require command phrase)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only Roy can check kill command status
    await requireOwner(user.id);

    const isActive = await KillCommandSystem.isActive();
    
    return NextResponse.json({
      active: isActive,
      status: isActive ? 'SYSTEM_LOCKED' : 'SYSTEM_ACTIVE',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes('UNAUTHORIZED') ? 403 : 500 }
    );
  }
}
