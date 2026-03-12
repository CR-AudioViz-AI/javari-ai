```typescript
import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { z } from 'zod';

// Validation schemas
const AgentStatusSchema = z.object({
  agentId: z.string(),
  status: z.enum(['idle', 'busy', 'error', 'offline']),
  currentTask: z.string().optional(),
  resources: z.array(z.string()),
  metadata: z.record(z.any()).optional()
});

const MessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('join_team'),
    teamId: z.string(),
    agentId: z.string(),
    token: z.string()
  }),
  z.object({
    type: z.literal('status_update'),
    agentId: z.string(),
    status: AgentStatusSchema
  }),
  z.object({
    type: z.literal('resource_request'),
    agentId: z.string(),
    resourceId: z.string(),
    duration: z.number().optional()
  }),
  z.object({
    type: z.literal('workflow_trigger'),
    workflowId: z.string(),
    dependencies: z.array(z.string()),
    parallelTasks: z.array(z.object({
      taskId: z.string(),
      agentId: z.string(),
      dependencies: z.array(z.string())
    }))
  }),
  z.object({
    type: z.literal('heartbeat'),
    agentId: z.string(),
    timestamp: z.number()
  })
]);

type Message = z.infer<typeof MessageSchema>;
type AgentStatus = z.infer<typeof AgentStatusSchema>;

interface AgentConnection {
  ws: WebSocket;
  agentId: string;
  teamId: string;
  lastHeartbeat: number;
  status: AgentStatus;
}

interface Resource {
  id: string;
  ownerId: string | null;
  expiresAt: number | null;
  queue: string[];
}

interface WorkflowTask {
  taskId: string;
  agentId: string;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
}

interface Workflow {
  id: string;
  tasks: Map<string, WorkflowTask>;
  completedTasks: Set<string>;
  runningTasks: Set<string>;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export class WebSocketTeamServer {
  private wss: WebSocketServer;
  private supabase: ReturnType<typeof createClient>;
  private redis: Redis;
  private agents = new Map<string, AgentConnection>();
  private teams = new Map<string, Set<string>>();
  private resources = new Map<string, Resource>();
  private workflows = new Map<string, Workflow>();
  private heartbeatInterval: NodeJS.Timeout;

  constructor() {
    this.wss = new WebSocketServer({ port: 8080 });
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.redis = new Redis(process.env.REDIS_URL!);
    
    this.setupWebSocketServer();
    this.setupHeartbeat();
    this.setupRedisSubscriptions();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          const validatedMessage = MessageSchema.parse(message);
          await this.handleMessage(ws, validatedMessage);
        } catch (error) {
          this.sendError(ws, 'Invalid message format', error);
        }
      });

      ws.on('close', () => {
        this.handleDisconnection(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleDisconnection(ws);
      });
    });
  }

  private async handleMessage(ws: WebSocket, message: Message): Promise<void> {
    switch (message.type) {
      case 'join_team':
        await this.handleJoinTeam(ws, message);
        break;
      case 'status_update':
        await this.handleStatusUpdate(message);
        break;
      case 'resource_request':
        await this.handleResourceRequest(message);
        break;
      case 'workflow_trigger':
        await this.handleWorkflowTrigger(message);
        break;
      case 'heartbeat':
        await this.handleHeartbeat(message);
        break;
    }
  }

  private async handleJoinTeam(ws: WebSocket, message: Extract<Message, { type: 'join_team' }>): Promise<void> {
    try {
      // Verify agent token with Supabase
      const { data: agent, error } = await this.supabase
        .from('agents')
        .select('*')
        .eq('id', message.agentId)
        .eq('team_id', message.teamId)
        .single();

      if (error || !agent) {
        this.sendError(ws, 'Authentication failed');
        return;
      }

      // Create agent connection
      const connection: AgentConnection = {
        ws,
        agentId: message.agentId,
        teamId: message.teamId,
        lastHeartbeat: Date.now(),
        status: {
          agentId: message.agentId,
          status: 'idle',
          resources: [],
        }
      };

      this.agents.set(message.agentId, connection);

      // Add to team
      if (!this.teams.has(message.teamId)) {
        this.teams.set(message.teamId, new Set());
      }
      this.teams.get(message.teamId)!.add(message.agentId);

      // Send current team state
      await this.sendTeamState(message.agentId);

      // Broadcast join notification
      await this.broadcastToTeam(message.teamId, {
        type: 'agent_joined',
        agentId: message.agentId,
        timestamp: Date.now()
      }, message.agentId);

      // Persist to Supabase
      await this.supabase
        .from('agent_sessions')
        .upsert({
          agent_id: message.agentId,
          team_id: message.teamId,
          status: 'connected',
          connected_at: new Date().toISOString()
        });

    } catch (error) {
      this.sendError(ws, 'Failed to join team', error);
    }
  }

  private async handleStatusUpdate(message: Extract<Message, { type: 'status_update' }>): Promise<void> {
    const agent = this.agents.get(message.agentId);
    if (!agent) return;

    agent.status = message.status;
    agent.lastHeartbeat = Date.now();

    // Broadcast to team
    await this.broadcastToTeam(agent.teamId, {
      type: 'status_updated',
      agentId: message.agentId,
      status: message.status,
      timestamp: Date.now()
    });

    // Persist to Supabase
    await this.supabase
      .from('agent_status')
      .upsert({
        agent_id: message.agentId,
        status: message.status.status,
        current_task: message.status.currentTask,
        resources: message.status.resources,
        metadata: message.status.metadata,
        updated_at: new Date().toISOString()
      });

    // Publish to Redis for cross-instance coordination
    await this.redis.publish(`team:${agent.teamId}:status`, JSON.stringify({
      agentId: message.agentId,
      status: message.status
    }));
  }

  private async handleResourceRequest(message: Extract<Message, { type: 'resource_request' }>): Promise<void> {
    const agent = this.agents.get(message.agentId);
    if (!agent) return;

    const resource = this.resources.get(message.resourceId);
    
    if (!resource) {
      // Create new resource
      const newResource: Resource = {
        id: message.resourceId,
        ownerId: message.agentId,
        expiresAt: message.duration ? Date.now() + message.duration : null,
        queue: []
      };
      this.resources.set(message.resourceId, newResource);

      await this.sendToAgent(message.agentId, {
        type: 'resource_allocated',
        resourceId: message.resourceId,
        agentId: message.agentId,
        expiresAt: newResource.expiresAt
      });
    } else if (resource.ownerId === null || (resource.expiresAt && resource.expiresAt < Date.now())) {
      // Resource available
      resource.ownerId = message.agentId;
      resource.expiresAt = message.duration ? Date.now() + message.duration : null;
      
      await this.sendToAgent(message.agentId, {
        type: 'resource_allocated',
        resourceId: message.resourceId,
        agentId: message.agentId,
        expiresAt: resource.expiresAt
      });
    } else {
      // Resource busy, add to queue
      resource.queue.push(message.agentId);
      
      await this.sendToAgent(message.agentId, {
        type: 'resource_queued',
        resourceId: message.resourceId,
        position: resource.queue.length
      });
    }

    // Broadcast resource status to team
    await this.broadcastToTeam(agent.teamId, {
      type: 'resource_status',
      resourceId: message.resourceId,
      ownerId: this.resources.get(message.resourceId)?.ownerId,
      queueLength: this.resources.get(message.resourceId)?.queue.length || 0
    });
  }

  private async handleWorkflowTrigger(message: Extract<Message, { type: 'workflow_trigger' }>): Promise<void> {
    const workflow: Workflow = {
      id: message.workflowId,
      tasks: new Map(),
      completedTasks: new Set(),
      runningTasks: new Set(),
      status: 'pending'
    };

    // Initialize tasks
    message.parallelTasks.forEach(task => {
      workflow.tasks.set(task.taskId, {
        taskId: task.taskId,
        agentId: task.agentId,
        dependencies: task.dependencies,
        status: 'pending'
      });
    });

    this.workflows.set(message.workflowId, workflow);

    // Start execution
    await this.executeWorkflow(message.workflowId);
  }

  private async executeWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    workflow.status = 'running';

    // Find tasks ready to execute (no pending dependencies)
    const readyTasks = Array.from(workflow.tasks.values()).filter(task => 
      task.status === 'pending' && 
      task.dependencies.every(dep => workflow.completedTasks.has(dep))
    );

    // Execute ready tasks in parallel
    const executePromises = readyTasks.map(async task => {
      task.status = 'running';
      workflow.runningTasks.add(task.taskId);

      await this.sendToAgent(task.agentId, {
        type: 'task_assignment',
        workflowId,
        taskId: task.taskId,
        dependencies: task.dependencies
      });
    });

    await Promise.all(executePromises);

    // Broadcast workflow status
    const teamIds = new Set(Array.from(this.agents.values()).map(a => a.teamId));
    for (const teamId of teamIds) {
      await this.broadcastToTeam(teamId, {
        type: 'workflow_status',
        workflowId,
        status: workflow.status,
        completedTasks: Array.from(workflow.completedTasks),
        runningTasks: Array.from(workflow.runningTasks)
      });
    }
  }

  private async handleHeartbeat(message: Extract<Message, { type: 'heartbeat' }>): Promise<void> {
    const agent = this.agents.get(message.agentId);
    if (agent) {
      agent.lastHeartbeat = message.timestamp;
    }
  }

  private async handleDisconnection(ws: WebSocket): Promise<void> {
    // Find agent by WebSocket
    const agent = Array.from(this.agents.values()).find(a => a.ws === ws);
    if (!agent) return;

    // Remove from team
    const teamAgents = this.teams.get(agent.teamId);
    if (teamAgents) {
      teamAgents.delete(agent.agentId);
    }

    // Release resources
    for (const [resourceId, resource] of this.resources.entries()) {
      if (resource.ownerId === agent.agentId) {
        resource.ownerId = null;
        resource.expiresAt = null;
        
        // Assign to next in queue
        if (resource.queue.length > 0) {
          const nextAgentId = resource.queue.shift()!;
          resource.ownerId = nextAgentId;
          
          await this.sendToAgent(nextAgentId, {
            type: 'resource_allocated',
            resourceId,
            agentId: nextAgentId,
            expiresAt: null
          });
        }
      } else {
        // Remove from queue
        resource.queue = resource.queue.filter(id => id !== agent.agentId);
      }
    }

    // Update agent status
    await this.supabase
      .from('agent_sessions')
      .update({
        status: 'disconnected',
        disconnected_at: new Date().toISOString()
      })
      .eq('agent_id', agent.agentId);

    // Broadcast disconnection
    await this.broadcastToTeam(agent.teamId, {
      type: 'agent_left',
      agentId: agent.agentId,
      timestamp: Date.now()
    });

    this.agents.delete(agent.agentId);
  }

  private setupHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 30000; // 30 seconds

      for (const [agentId, agent] of this.agents.entries()) {
        if (now - agent.lastHeartbeat > timeout) {
          console.log(`Agent ${agentId} timed out`);
          agent.ws.terminate();
          this.handleDisconnection(agent.ws);
        }
      }
    }, 10000); // Check every 10 seconds
  }

  private setupRedisSubscriptions(): void {
    this.redis.subscribe('team:*:status', 'team:*:coordination');
    
    this.redis.on('message', async (channel: string, message: string) => {
      try {
        const data = JSON.parse(message);
        
        if (channel.includes(':status')) {
          // Handle cross-instance status updates
          const teamId = channel.split(':')[1];
          await this.broadcastToTeam(teamId, {
            type: 'external_status_update',
            ...data
          });
        }
      } catch (error) {
        console.error('Redis message error:', error);
      }
    });
  }

  private async sendTeamState(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const teamAgents = this.teams.get(agent.teamId);
    if (!teamAgents) return;

    const teamState = {
      type: 'team_state',
      agents: Array.from(teamAgents).map(id => ({
        agentId: id,
        status: this.agents.get(id)?.status
      })).filter(Boolean),
      resources: Array.from(this.resources.entries()).map(([id, resource]) => ({
        id,
        ownerId: resource.ownerId,
        queueLength: resource.queue.length
      })),
      workflows: Array.from(this.workflows.entries()).map(([id, workflow]) => ({
        id,
        status: workflow.status,
        completedTasks: Array.from(workflow.completedTasks),
        runningTasks: Array.from(workflow.runningTasks)
      }))
    };

    await this.sendToAgent(agentId, teamState);
  }

  private async broadcastToTeam(teamId: string, message: any, excludeAgentId?: string): Promise<void> {
    const teamAgents = this.teams.get(teamId);
    if (!teamAgents) return;

    const broadcastPromises = Array.from(teamAgents)
      .filter(agentId => agentId !== excludeAgentId)
      .map(agentId => this.sendToAgent(agentId, message));

    await Promise.allSettled(broadcastPromises);
  }

  private async sendToAgent(agentId: string, message: any): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent || agent.ws.readyState !== WebSocket.OPEN) return;

    try {
      agent.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`Failed to send message to agent ${agentId}:`, error);
      this.handleDisconnection(agent.ws);
    }
  }

  private sendError(ws: WebSocket, message: string, error?: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        message,
        details: error?.message
      }));
    }
  }

  public async shutdown(): Promise<void> {
    clearInterval(this.heartbeatInterval);
    
    // Close all connections
    for (const agent of this.agents.values()) {
      agent.ws.close();
    }
    
    this.wss.close();
    await this.redis.quit();
  }
}

// Initialize and export server instance
export const teamCoordinationServer = new WebSocketTeamServer();
```