# Build Team Task Dependency Management API

```markdown
# Team Task Dependency Management API

## Purpose
The Team Task Dependency Management API provides endpoints to manage task dependencies within a specified team. It allows for creating, updating, and resolving task dependencies, ensuring proper execution flow in task management.

## Usage
This API is structured around Next.js and Supabase. It integrates with a Supabase database to store and manage task dependencies, their relationships, and the execution status of tasks.

### Endpoints
- **POST /api/teams/[teamId]/tasks/dependencies**: Create a new task dependency.
- **PUT /api/teams/[teamId]/tasks/dependencies/[dependencyId]**: Update an existing task dependency.
- **GET /api/teams/[teamId]/tasks/dependencies/resolve**: Resolve and return the dependency graph for tasks.

## Parameters/Props

### Create Dependency
- `dependent_task_id` (string, UUID): The ID of the task that depends on another task.
- `prerequisite_task_id` (string, UUID): The ID of the task that must be completed first.
- `dependency_type` (string): Type of dependency. Must be one of 'blocking', 'soft', 'resource', or 'sequence'.
- `condition` (string, optional): Optional condition for the dependency.
- `priority_weight` (number): Weight for priority (0 to 1). Defaults to 1.
- `is_optional` (boolean): Indicates whether the dependency is optional. Defaults to `false`.

### Update Dependency
- `dependency_type` (string, optional): New type of dependency.
- `condition` (string, optional): Updated condition for the dependency.
- `priority_weight` (number, optional): Updated priority weight.
- `is_optional` (boolean, optional): Updated optional status.

### Resolve Dependencies
- `objective_weights` (record): Weights assigned to specific objectives for resolving dependencies.
- `parallel_execution` (boolean): Flag to allow parallel execution of tasks. Defaults to `true`.
- `max_parallel_tasks` (number): Maximum number of tasks to execute in parallel (1 to 50). Defaults to `10`.

## Return Values
- **Create/Update Dependency**: Returns the newly created or updated task dependency object along with a status message.
- **Resolve Dependencies**: Returns a Dependency Graph object which consists of nodes and edges detailing the tasks and their relationships.
  
### Dependency Graph Structure
- **nodes**: Array of task node objects, each containing:
    - `id`: Unique identifier for the task.
    - `task_id`: ID of the task.
    - `status`: Current execution status of the task.
    - `priority`: Priority weight of the task.
    - `dependencies`: List of IDs of tasks this task is dependent on.
  
- **edges**: Array of dependency edge objects, each containing:
    - `from`: ID of the prerequisite task.
    - `to`: ID of the dependent task.
    - `type`: Type of dependency (string).
    - `weight`: Priority weight of the dependency.

## Examples

### Create Dependency
```json
POST /api/teams/123/tasks/dependencies
{
  "dependent_task_id": "task-abc-123",
  "prerequisite_task_id": "task-def-456",
  "dependency_type": "blocking",
  "priority_weight": 0.8,
  "is_optional": false
}
```

### Update Dependency
```json
PUT /api/teams/123/tasks/dependencies/dependency-xyz
{
  "is_optional": true,
  "priority_weight": 0.5
}
```

### Resolve Dependencies
```json
GET /api/teams/123/tasks/dependencies/resolve
{
  "objective_weights": {
    "task-abc-123": 0.7,
    "task-def-456": 0.3
  },
  "parallel_execution": true,
  "max_parallel_tasks": 15
}
```
```