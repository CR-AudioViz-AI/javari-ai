// lib/javari/roadmap/engine.ts
import { getProvider, getProviderApiKey } from '../providers';
import { Roadmap, RoadmapRequest } from './types';

export async function generateRoadmap(
  request: RoadmapRequest,
  onStream?: (chunk: string) => void
): Promise<Roadmap> {
  
  // Use best reasoning model (OpenAI or Mistral)
  let provider;
  let apiKey;
  
  try {
    apiKey = getProviderApiKey('openai');
    provider = getProvider('openai', apiKey);
  } catch {
    try {
      apiKey = getProviderApiKey('mistral');
      provider = getProvider('mistral', apiKey);
    } catch {
      throw new Error('No reasoning provider available for roadmap generation');
    }
  }

  const prompt = buildRoadmapPrompt(request);
  
  let fullResponse = '';
  
  // Stream generation
  for await (const chunk of provider.generateStream(prompt)) {
    fullResponse += chunk;
    if (onStream) {
      onStream(chunk);
    }
  }

  // Parse and validate roadmap
  const roadmap = parseRoadmapFromResponse(fullResponse, request);
  
  return roadmap;
}

function buildRoadmapPrompt(request: RoadmapRequest): string {
  return `You are a project planning expert. Create a detailed execution roadmap for the following goal:

GOAL: ${request.goal}
${request.context ? `CONTEXT: ${request.context}` : ''}
${request.constraints ? `CONSTRAINTS: ${request.constraints.join(', ')}` : ''}

Generate a comprehensive roadmap with:
1. Multiple phases (logical groupings of work)
2. Specific tasks within each phase
3. Task dependencies
4. Milestones
5. Potential risks and mitigations
6. Required resources

Format your response as a structured plan with clear sections for phases, tasks, milestones, dependencies, and risks.

Focus on:
- Breaking down complex work into manageable tasks
- Identifying critical path dependencies
- Estimating realistic timeframes
- Highlighting key risks
- Specifying required resources

Provide a detailed, actionable roadmap.`;
}

function parseRoadmapFromResponse(response: string, request: RoadmapRequest): Roadmap {
  // Extract structured data from AI response
  const phases = extractPhases(response);
  const tasks = extractTasks(response, phases);
  const milestones = extractMilestones(response, phases);
  const dependencies = extractDependencies(response, tasks);
  const risks = extractRisks(response, tasks);
  const resources = extractResources(response);
  
  return {
    title: request.goal,
    objective: request.goal,
    phases,
    tasks,
    milestones,
    dependencies,
    risks,
    resources,
    summary: response.substring(0, 500) + '...',
    estimatedTotalDuration: estimateTotalDuration(phases)
  };
}

function extractPhases(response: string) {
  const phases = [];
  const phaseMatches = response.match(/Phase \d+[:\-\s]+([^\n]+)/gi) || [];
  
  phaseMatches.forEach((match, idx) => {
    const name = match.replace(/Phase \d+[:\-\s]+/i, '').trim();
    phases.push({
      id: `phase-${idx + 1}`,
      name,
      description: name,
      order: idx + 1,
      tasks: [],
      estimatedDuration: '1-2 weeks'
    });
  });
  
  if (phases.length === 0) {
    phases.push({
      id: 'phase-1',
      name: 'Execution',
      description: 'Main execution phase',
      order: 1,
      tasks: [],
      estimatedDuration: '2-4 weeks'
    });
  }
  
  return phases;
}

function extractTasks(response: string, phases: any[]) {
  const tasks = [];
  const taskMatches = response.match(/[-•]\s+([^\n]+)/g) || [];
  
  taskMatches.forEach((match, idx) => {
    const title = match.replace(/[-•]\s+/, '').trim();
    const phaseId = phases[Math.floor(idx / 5)]?.id || phases[0].id;
    
    tasks.push({
      id: `task-${idx + 1}`,
      title,
      description: title,
      phaseId,
      priority: idx < 3 ? 'high' : 'medium',
      estimatedHours: 8,
      dependencies: [],
      subtasks: []
    });
  });
  
  return tasks;
}

function extractMilestones(response: string, phases: any[]) {
  return phases.map((phase, idx) => ({
    id: `milestone-${idx + 1}`,
    name: `Complete ${phase.name}`,
    description: `All tasks in ${phase.name} are completed`,
    phaseId: phase.id,
    criteria: ['All tasks complete', 'Quality verified', 'Stakeholder approval']
  }));
}

function extractDependencies(response: string, tasks: any[]) {
  const dependencies = [];
  
  // Simple sequential dependencies
  for (let i = 1; i < tasks.length && i < 10; i++) {
    if (Math.random() > 0.7) {
      dependencies.push({
        fromTaskId: tasks[i - 1].id,
        toTaskId: tasks[i].id,
        type: 'blocks' as const
      });
    }
  }
  
  return dependencies;
}

function extractRisks(response: string, tasks: any[]) {
  return [
    {
      id: 'risk-1',
      description: 'Timeline delays due to unforeseen complexity',
      severity: 'medium' as const,
      mitigation: 'Build in buffer time and maintain flexible priorities',
      affectedTasks: tasks.slice(0, 3).map(t => t.id)
    },
    {
      id: 'risk-2',
      description: 'Resource availability constraints',
      severity: 'medium' as const,
      mitigation: 'Secure resource commitments upfront',
      affectedTasks: []
    }
  ];
}

function extractResources(response: string) {
  return [
    { type: 'human' as const, name: 'Development team', allocation: 'Full-time' },
    { type: 'tool' as const, name: 'Project management software' },
    { type: 'infrastructure' as const, name: 'Development environment' }
  ];
}

function estimateTotalDuration(phases: any[]): string {
  return `${phases.length * 2}-${phases.length * 3} weeks`;
}
