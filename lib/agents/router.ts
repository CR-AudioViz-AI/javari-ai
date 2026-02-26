export type AgentType = 'claude' | 'chatgpt' | 'javari';

export interface TaskRoute {
  agent: AgentType;
  reasoning: string;
  capabilities: string[];
}

export function routeTask(task: {
  title: string;
  description?: string;
  systems_involved?: string[];
  phase?: number;
}): TaskRoute {
  const title = task.title.toLowerCase();
  const systems = task.systems_involved || [];

  // ARCHITECTURE & PLANNING → ChatGPT
  if (
    title.includes('define') ||
    title.includes('design') ||
    title.includes('architecture') ||
    title.includes('model') ||
    title.includes('schema') ||
    title.includes('plan')
  ) {
    return {
      agent: 'chatgpt',
      reasoning: 'Architecture and planning task',
      capabilities: ['reasoning', 'planning', 'validation', 'architecture']
    };
  }

  // CODE & IMPLEMENTATION → Claude
  if (
    title.includes('implement') ||
    title.includes('build') ||
    title.includes('create') ||
    title.includes('develop') ||
    title.includes('write') ||
    title.includes('code')
  ) {
    return {
      agent: 'claude',
      reasoning: 'Code generation and implementation task',
      capabilities: ['code', 'files', 'apis', 'database', 'execution']
    };
  }

  // DATABASE & SUPABASE → Claude
  if (systems.includes('Supabase') || systems.includes('PostgreSQL')) {
    return {
      agent: 'claude',
      reasoning: 'Database task requiring SQL and migrations',
      capabilities: ['database', 'migrations', 'rls', 'sql']
    };
  }

  // INTERNAL ORCHESTRATION → Javari
  if (
    title.includes('automate') ||
    title.includes('orchestrate') ||
    title.includes('coordinate') ||
    title.includes('workflow')
  ) {
    return {
      agent: 'javari',
      reasoning: 'Internal orchestration task',
      capabilities: ['orchestration', 'automation', 'state', 'monitoring']
    };
  }

  // DEFAULT → Claude
  return {
    agent: 'claude',
    reasoning: 'General execution task',
    capabilities: ['general', 'execution']
  };
}
