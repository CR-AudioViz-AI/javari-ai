/**
 * JAVARI AI - SECURITY MONITORING DASHBOARD
 * Roy-Only Admin Interface for System Security
 * 
 * @version 1.0.0
 * @date November 21, 2025 - 11:16 PM EST
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  AlertTriangle, 
  Lock, 
  Unlock, 
  Activity, 
  Users, 
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Ban
} from 'lucide-react';

interface KillCommandStatus {
  active: boolean;
  activated_by?: string;
  activated_at?: string;
  reason?: string;
  suspicious_actors?: string[];
}

interface SecurityViolation {
  id: string;
  user_id: string;
  action: string;
  timestamp: string;
  reason: string;
  pattern?: string;
  blocked: boolean;
  input?: string;
}

interface SecurityAlert {
  id: string;
  user_id: string;
  action: string;
  reason: string;
  timestamp: string;
  acknowledged: boolean;
}

interface HighRiskUser {
  id: string;
  email: string;
  username: string;
  violation_count: number;
  suspended: boolean;
  suspension_reason?: string;
}

export default function SecurityDashboard() {
  // State management
  const [killCommandStatus, setKillCommandStatus] = useState<KillCommandStatus>({ active: false });
  const [commandPhrase, setCommandPhrase] = useState('');
  const [activateReason, setActivateReason] = useState('');
  const [suspiciousActors, setSuspiciousActors] = useState('');
  const [loading, setLoading] = useState(false);
  const [violations, setViolations] = useState<SecurityViolation[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [highRiskUsers, setHighRiskUsers] = useState<HighRiskUser[]>([]);
  const [stats, setStats] = useState({
    totalViolations: 0,
    blockedToday: 0,
    suspendedUsers: 0,
    unacknowledgedAlerts: 0
  });

  // Fetch kill command status
  const fetchKillCommandStatus = async () => {
    try {
      const response = await fetch('/api/admin/kill-command');
      if (response.ok) {
        const data = await response.json();
        setKillCommandStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch kill command status:', error);
    }
  };

  // Fetch security violations
  const fetchViolations = async () => {
    try {
      const response = await fetch('/api/admin/security/violations');
      if (response.ok) {
        const data = await response.json();
        setViolations(data.violations || []);
      }
    } catch (error) {
      console.error('Failed to fetch violations:', error);
    }
  };

  // Fetch security alerts
  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/admin/security/alerts');
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  };

  // Fetch high risk users
  const fetchHighRiskUsers = async () => {
    try {
      const response = await fetch('/api/admin/security/high-risk-users');
      if (response.ok) {
        const data = await response.json();
        setHighRiskUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch high risk users:', error);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/security/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchKillCommandStatus();
    fetchViolations();
    fetchAlerts();
    fetchHighRiskUsers();
    fetchStats();

    // Refresh every 10 seconds
    const interval = setInterval(() => {
      fetchKillCommandStatus();
      fetchViolations();
      fetchAlerts();
      fetchStats();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Activate kill command
  const handleActivateKillCommand = async () => {
    if (!commandPhrase) {
      alert('Please enter command phrase');
      return;
    }

    if (!activateReason) {
      alert('Please provide a reason for activation');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/kill-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'activate',
          commandPhrase,
          reason: activateReason,
          suspiciousActors: suspiciousActors.split(',').map(s => s.trim()).filter(Boolean)
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert('✅ KILL COMMAND ACTIVATED - All Javari operations frozen');
        setCommandPhrase('');
        setActivateReason('');
        setSuspiciousActors('');
        fetchKillCommandStatus();
      } else {
        alert(`❌ Failed: ${data.error}`);
      }
    } catch (error) {
      alert(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Deactivate kill command
  const handleDeactivateKillCommand = async () => {
    if (!commandPhrase) {
      alert('Please enter command phrase');
      return;
    }

    const reason = prompt('Reason for deactivation?');
    if (!reason) return;

    setLoading(true);
    try {
      const response = await fetch('/api/admin/kill-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deactivate',
          commandPhrase,
          reason
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert('✅ KILL COMMAND DEACTIVATED - Operations resumed');
        setCommandPhrase('');
        fetchKillCommandStatus();
      } else {
        alert(`❌ Failed: ${data.error}`);
      }
    } catch (error) {
      alert(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Acknowledge alert
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await fetch('/api/admin/security/alerts/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId })
      });
      fetchAlerts();
      fetchStats();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Security Command Center</h1>
          <p className="text-muted-foreground">Roy-Only System Security & Monitoring</p>
        </div>
        <Badge variant={killCommandStatus.active ? "destructive" : "default"} className="text-lg px-4 py-2">
          {killCommandStatus.active ? (
            <><Lock className="w-4 h-4 mr-2" /> SYSTEM LOCKED</>
          ) : (
            <><Unlock className="w-4 h-4 mr-2" /> SYSTEM ACTIVE</>
          )}
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Violations</CardTitle>
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalViolations}</div>
            <p className="text-xs text-muted-foreground">All-time security violations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Blocked Today</CardTitle>
            <XCircle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.blockedToday}</div>
            <p className="text-xs text-muted-foreground">Violations blocked today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Suspended Users</CardTitle>
            <Ban className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.suspendedUsers}</div>
            <p className="text-xs text-muted-foreground">Currently suspended accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Unread Alerts</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.unacknowledgedAlerts}</div>
            <p className="text-xs text-muted-foreground">Require your attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Kill Command Status Alert */}
      {killCommandStatus.active && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>⚠️ KILL COMMAND ACTIVE - SYSTEM LOCKED</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1">
              <p><strong>Activated:</strong> {new Date(killCommandStatus.activated_at!).toLocaleString()}</p>
              <p><strong>Reason:</strong> {killCommandStatus.reason}</p>
              {killCommandStatus.suspicious_actors && killCommandStatus.suspicious_actors.length > 0 && (
                <p><strong>Flagged Actors:</strong> {killCommandStatus.suspicious_actors.join(', ')}</p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="kill-command" className="space-y-4">
        <TabsList>
          <TabsTrigger value="kill-command">
            <Shield className="w-4 h-4 mr-2" />
            Kill Command
          </TabsTrigger>
          <TabsTrigger value="violations">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Violations ({violations.length})
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <Activity className="w-4 h-4 mr-2" />
            Alerts ({stats.unacknowledgedAlerts})
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="w-4 h-4 mr-2" />
            High Risk Users ({highRiskUsers.length})
          </TabsTrigger>
        </TabsList>

        {/* Kill Command Tab */}
        <TabsContent value="kill-command" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Emergency System Control</CardTitle>
              <CardDescription>
                Freeze all Javari operations and isolate suspicious actors
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Command Phrase (Required)</label>
                <Input
                  type="password"
                  value={commandPhrase}
                  onChange={(e) => setCommandPhrase(e.target.value)}
                  placeholder="Enter your secret command phrase"
                />
              </div>

              {!killCommandStatus.active && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Reason for Activation</label>
                    <Input
                      value={activateReason}
                      onChange={(e) => setActivateReason(e.target.value)}
                      placeholder="Why are you activating kill command?"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Suspicious Actors (Optional)</label>
                    <Input
                      value={suspiciousActors}
                      onChange={(e) => setSuspiciousActors(e.target.value)}
                      placeholder="User IDs separated by commas"
                    />
                    <p className="text-xs text-muted-foreground">
                      These users will be immediately suspended and isolated
                    </p>
                  </div>
                </>
              )}

              <div className="flex gap-4">
                {!killCommandStatus.active ? (
                  <Button
                    variant="destructive"
                    size="lg"
                    onClick={handleActivateKillCommand}
                    disabled={loading || !commandPhrase}
                    className="w-full"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    {loading ? 'Activating...' : 'ACTIVATE KILL COMMAND'}
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="lg"
                    onClick={handleDeactivateKillCommand}
                    disabled={loading || !commandPhrase}
                    className="w-full"
                  >
                    <Unlock className="w-4 h-4 mr-2" />
                    {loading ? 'Deactivating...' : 'DEACTIVATE KILL COMMAND'}
                  </Button>
                )}
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Security Notice</AlertTitle>
                <AlertDescription>
                  Kill command activation freezes all Javari operations system-wide. Only you can reactivate.
                  All actions are logged and cannot be deleted.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Violations Tab */}
        <TabsContent value="violations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Security Violations</CardTitle>
              <CardDescription>
                Real-time monitoring of blocked security violations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {violations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                    <p>No violations detected</p>
                  </div>
                ) : (
                  violations.map((violation) => (
                    <div key={violation.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={violation.blocked ? "destructive" : "secondary"}>
                              {violation.action}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(violation.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm"><strong>User:</strong> {violation.user_id}</p>
                          <p className="text-sm"><strong>Reason:</strong> {violation.reason}</p>
                          {violation.pattern && (
                            <p className="text-xs text-muted-foreground">
                              <strong>Pattern:</strong> {violation.pattern}
                            </p>
                          )}
                          {violation.input && (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-muted-foreground">
                                View Input
                              </summary>
                              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                                {violation.input}
                              </pre>
                            </details>
                          )}
                        </div>
                        {violation.blocked && (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Alerts</CardTitle>
              <CardDescription>
                Critical security events requiring your attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                    <p>No pending alerts</p>
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div key={alert.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive">{alert.action}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(alert.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm"><strong>User:</strong> {alert.user_id}</p>
                          <p className="text-sm"><strong>Reason:</strong> {alert.reason}</p>
                        </div>
                        {!alert.acknowledged && (
                          <Button
                            size="sm"
                            onClick={() => handleAcknowledgeAlert(alert.id)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Acknowledge
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* High Risk Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>High Risk Users</CardTitle>
              <CardDescription>
                Users with multiple violations or suspensions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {highRiskUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                    <p>No high risk users</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {highRiskUsers.map((user) => (
                      <div key={user.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{user.email || user.username}</p>
                              {user.suspended && (
                                <Badge variant="destructive">SUSPENDED</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              <strong>Violations:</strong> {user.violation_count}
                            </p>
                            {user.suspension_reason && (
                              <p className="text-sm text-muted-foreground">
                                <strong>Reason:</strong> {user.suspension_reason}
                              </p>
                            )}
                          </div>
                          <Button size="sm" variant="outline">
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
