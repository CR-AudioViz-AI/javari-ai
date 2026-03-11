import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Types
interface TaskDependency {
  id: string
  team_id: string
  dependent_task_id: string
  prerequisite_task_id: string
  dependency_type: 'blocking' | 'soft' | 'resource' | 'sequence'
  condition?: string
  priority_weight: number
  is_optional: boolean
  created_at: string
  updated_at: string
}

interface TaskExecution {
  id: string
  task_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked'
  assigned_agent_id?: string
  execution_order: number
  estimated_duration: number
  actual_duration?: number
  created_at: string
  updated_at: string
}

interface DependencyGraph {
  nodes: Array<{
    id: string
    task_id: string
    status: string
    priority: number
    dependencies: string[]
  }>
  edges: Array<{
    from: string
    to: string
    type: string
    weight: number
  }>
}

// Validation schemas
const createDependencySchema = z.object({
  dependent_task_id: z.string().uuid(),
  prerequisite_task_id: z.string().uuid(),
  dependency_type: z.enum(['blocking', 'soft', 'resource', 'sequence']),
  condition: z.string().optional(),
  priority_weight: z.number().min(0).max(1).default(1),
  is_optional: z.boolean().default(false)
})

const updateDependencySchema = z.object({
  dependency_type: z.enum(['blocking', 'soft', 'resource', 'sequence']).optional(),
  condition: z.string().optional(),
  priority_weight: z.number().min(0).max(1).optional(),
  is_optional: z.boolean().optional()
})

const resolveDependenciesSchema = z.object({
  objective_weights: z.record(z.string(), z.number()).optional(),
  parallel_execution: z.boolean().default(true),
  max_parallel_tasks: z.number().min(1).max(50).default(10)
})

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Dependency graph utilities
class DependencyGraphResolver {
  private dependencies: TaskDependency[]
  private tasks: Map<string, any>

  constructor(dependencies: TaskDependency[], tasks: any[]) {
    this.dependencies = dependencies
    this.tasks = new Map(tasks.map(task => [task.id, task]))
  }

  buildGraph(): DependencyGraph {
    const nodes = Array.from(this.tasks.values()).map(task => ({
      id: task.id,
      task_id: task.id,
      status: task.status || 'pending',
      priority: this.calculateTaskPriority(task.id),
      dependencies: this.getTaskDependencies(task.id)
    }))

    const edges = this.dependencies.map(dep => ({
      from: dep.prerequisite_task_id,
      to: dep.dependent_task_id,
      type: dep.dependency_type,
      weight: dep.priority_weight
    }))

    return { nodes, edges }
  }

  private getTaskDependencies(taskId: string): string[] {
    return this.dependencies
      .filter(dep => dep.dependent_task_id === taskId)
      .map(dep => dep.prerequisite_task_id)
  }

  private calculateTaskPriority(taskId: string): number {
    const dependentDeps = this.dependencies.filter(dep => 
      dep.dependent_task_id === taskId
    )
    
    if (dependentDeps.length === 0) return 1

    return dependentDeps.reduce((acc, dep) => 
      acc + (dep.priority_weight * (dep.is_optional ? 0.5 : 1))
    , 0) / dependentDeps.length
  }

  topologicalSort(): string[] {
    const graph = new Map<string, string[]>()
    const inDegree = new Map<string, number>()

    // Initialize graph
    for (const task of this.tasks.values()) {
      graph.set(task.id, [])
      inDegree.set(task.id, 0)
    }

    // Build adjacency list and calculate in-degrees
    for (const dep of this.dependencies) {
      if (dep.dependency_type === 'blocking' || dep.dependency_type === 'sequence') {
        graph.get(dep.prerequisite_task_id)?.push(dep.dependent_task_id)
        inDegree.set(dep.dependent_task_id, 
          (inDegree.get(dep.dependent_task_id) || 0) + 1)
      }
    }

    // Kahn's algorithm
    const queue: string[] = []
    const result: string[] = []

    // Find all nodes with no incoming edges
    for (const [taskId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(taskId)
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!
      result.push(current)

      const neighbors = graph.get(current) || []
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1
        inDegree.set(neighbor, newDegree)
        
        if (newDegree === 0) {
          queue.push(neighbor)
        }
      }
    }

    // Check for cycles
    if (result.length !== this.tasks.size) {
      throw new Error('Circular dependency detected in task graph')
    }

    return result
  }

  detectCycles(): string[][] {
    const visited = new Set<string>()
    const recStack = new Set<string>()
    const cycles: string[][] = []

    const dfs = (node: string, path: string[]): void => {
      visited.add(node)
      recStack.add(node)
      path.push(node)

      const neighbors = this.dependencies
        .filter(dep => dep.prerequisite_task_id === node)
        .map(dep => dep.dependent_task_id)

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path])
        } else if (recStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor)
          cycles.push([...path.slice(cycleStart), neighbor])
        }
      }

      recStack.delete(node)
    }

    for (const taskId of this.tasks.keys()) {
      if (!visited.has(taskId)) {
        dfs(taskId, [])
      }
    }

    return cycles
  }

  getExecutionPlan(maxParallel: number = 10): Array<string[]> {
    const sortedTasks = this.topologicalSort()
    const plan: Array<string[]> = []
    const completed = new Set<string>()
    
    while (completed.size < sortedTasks.length) {
      const batch: string[] = []
      
      for (const taskId of sortedTasks) {
        if (completed.has(taskId) || batch.length >= maxParallel) continue
        
        const dependencies = this.getTaskDependencies(taskId)
        const canExecute = dependencies.every(depId => completed.has(depId))
        
        if (canExecute) {
          batch.push(taskId)
          completed.add(taskId)
        }
      }
      
      if (batch.length === 0) break
      plan.push(batch)
    }
    
    return plan
  }
}

// GET - List team task dependencies
export async function GET(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const { teamId } = params
    const { searchParams } = new URL(request.url)
    
    const taskId = searchParams.get('task_id')
    const dependencyType = searchParams.get('type')
    const includeOptional = searchParams.get('include_optional') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Validate team access
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .single()

    if (teamError || !team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      )
    }

    let query = supabase
      .from('task_dependencies')
      .select(`
        *,
        dependent_task:tasks!dependent_task_id(id, title, status),
        prerequisite_task:tasks!prerequisite_task_id(id, title, status)
      `)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (taskId) {
      query = query.or(`dependent_task_id.eq.${taskId},prerequisite_task_id.eq.${taskId}`)
    }

    if (dependencyType) {
      query = query.eq('dependency_type', dependencyType)
    }

    if (!includeOptional) {
      query = query.eq('is_optional', false)
    }

    const { data: dependencies, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch dependencies' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      dependencies: dependencies || [],
      pagination: {
        limit,
        offset,
        total: dependencies?.length || 0
      }
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create dependency relationship
export async function POST(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const { teamId } = params
    const body = await request.json()

    const validatedData = createDependencySchema.parse(body)

    // Validate team access
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .single()

    if (teamError || !team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      )
    }

    // Validate both tasks exist and belong to team
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, team_id')
      .in('id', [validatedData.dependent_task_id, validatedData.prerequisite_task_id])

    if (tasksError || tasks.length !== 2) {
      return NextResponse.json(
        { error: 'One or both tasks not found' },
        { status: 404 }
      )
    }

    if (!tasks.every(task => task.team_id === teamId)) {
      return NextResponse.json(
        { error: 'Tasks do not belong to specified team' },
        { status: 403 }
      )
    }

    // Check for self-dependency
    if (validatedData.dependent_task_id === validatedData.prerequisite_task_id) {
      return NextResponse.json(
        { error: 'Task cannot depend on itself' },
        { status: 400 }
      )
    }

    // Check for duplicate dependency
    const { data: existingDep } = await supabase
      .from('task_dependencies')
      .select('id')
      .eq('team_id', teamId)
      .eq('dependent_task_id', validatedData.dependent_task_id)
      .eq('prerequisite_task_id', validatedData.prerequisite_task_id)
      .single()

    if (existingDep) {
      return NextResponse.json(
        { error: 'Dependency already exists' },
        { status: 409 }
      )
    }

    // Create dependency
    const { data: dependency, error: createError } = await supabase
      .from('task_dependencies')
      .insert({
        team_id: teamId,
        ...validatedData
      })
      .select(`
        *,
        dependent_task:tasks!dependent_task_id(id, title, status),
        prerequisite_task:tasks!prerequisite_task_id(id, title, status)
      `)
      .single()

    if (createError) {
      console.error('Create dependency error:', createError)
      return NextResponse.json(
        { error: 'Failed to create dependency' },
        { status: 500 }
      )
    }

    // Check for cycles after adding dependency
    const { data: allDependencies } = await supabase
      .from('task_dependencies')
      .select('*')
      .eq('team_id', teamId)

    const { data: allTasks } = await supabase
      .from('tasks')
      .select('id, title, status')
      .eq('team_id', teamId)

    if (allDependencies && allTasks) {
      const resolver = new DependencyGraphResolver(allDependencies, allTasks)
      const cycles = resolver.detectCycles()
      
      if (cycles.length > 0) {
        // Remove the dependency we just created
        await supabase
          .from('task_dependencies')
          .delete()
          .eq('id', dependency.id)

        return NextResponse.json(
          { 
            error: 'Dependency would create circular reference',
            cycles: cycles
          },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({ dependency }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update dependency configuration
export async function PUT(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const { teamId } = params
    const { searchParams } = new URL(request.url)
    const dependencyId = searchParams.get('id')

    if (!dependencyId) {
      return NextResponse.json(
        { error: 'Dependency ID required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = updateDependencySchema.parse(body)

    // Validate dependency exists and belongs to team
    const { data: dependency, error: depError } = await supabase
      .from('task_dependencies')
      .select('*')
      .eq('id', dependencyId)
      .eq('team_id', teamId)
      .single()

    if (depError || !dependency) {
      return NextResponse.json(
        { error: 'Dependency not found' },
        { status: 404 }
      )
    }

    // Update dependency
    const { data: updatedDependency, error: updateError } = await supabase
      .from('task_dependencies')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString()
      })
      .eq('id', dependencyId)
      .select(`
        *,
        dependent_task:tasks!dependent_task_id(id, title, status),
        prerequisite_task:tasks!prerequisite_task_id(id, title, status)
      `)
      .single()

    if (updateError) {
      console.error('Update dependency error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update dependency' },
        { status: 500 }
      )
    }

    return NextResponse.json({ dependency: updatedDependency })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Remove dependency relationship
export async function DELETE(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const { teamId } = params
    const { searchParams } = new URL(request.url)
    const dependencyId = searchParams.get('id')

    if (!dependencyId) {
      return NextResponse.json(
        { error: 'Dependency ID required' },
        { status: 400 }
      )
    }

    // Validate dependency exists and belongs to team
    const { data: dependency, error: depError } = await supabase
      .from('task_dependencies')
      .select('*')
      .eq('id', dependencyId)
      .eq('team_id', teamId)
      .single()

    if (depError || !dependency) {
      return NextResponse.json(
        { error: 'Dependency not found' },
        { status: 404 }
      )
    }

    // Delete dependency
    const { error: deleteError } = await supabase
      .from('task_dependencies')
      .delete()
      .eq('id', dependencyId)

    if (deleteError) {
      console.error('Delete dependency error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete dependency' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Special endpoint for resolving dependencies
export async function PATCH(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const { teamId } = params
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action !== 'resolve') {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = resolveDependenciesSchema.parse(body)

    // Get all team dependencies and tasks
    const [{ data: dependencies }, { data: tasks }] = await Promise.all([
      supabase
        .from('task_dependencies')
        .select('*')
        .eq('team_id', teamId),
      supabase
        .from('tasks')
        .select('id, title, status, priority, estimated_duration')
        .eq('team_id', teamId)
    ])

    if (!dependencies || !tasks) {
      return NextResponse.json(
        { error: 'Failed to fetch team data' },
        { status: 500 }
      )
    }

    const resolver = new DependencyGraphResolver(dependencies, tasks)

    // Check for cycles
    const cycles = resolver.detectCycles()
    if (cycles.length > 0) {
      return NextResponse.json(
        { 
          error: 'Circular dependencies detected',
          cycles: cycles
        },
        { status: 400 }
      )
    }

    // Build dependency graph
    const graph = resolver.buildGraph()

    // Get execution plan
    const executionPlan = resolver.getExecutionPlan(validatedData.max_parallel_tasks)

    // Calculate total estimated duration
    const totalDuration = executionPlan.reduce((total, batch, index) => {
      const batchDuration = Math.max(...batch.map(taskId => {
        const task = tasks.find(t => t.id === taskId)
        return task?.estimated_duration || 60
      }))
      return total + batchDuration
    }, 0)

    return NextResponse.json({
      graph,
      execution_plan: executionPlan,
      total_estimated_duration: totalDuration,
      parallel_batches: executionPlan.length,
      total_tasks: tasks.length,
      dependency_count: dependencies.length,
      cycles_detected: cycles
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}