# Create Team Performance Optimization Service

```markdown
# Team Performance Optimization Service Documentation

## Purpose
The Team Performance Optimization Service is designed to optimize team composition and role assignments for tasks by analyzing agent skills, task requirements, and performance metrics. It leverages machine learning models to predict performance scores and recommend the most effective team configurations.

## Usage
To utilize this service, instantiate the `TeamOptimizationService` and call its methods with appropriate parameters to optimize team performance based on provided agents and tasks.

## Parameters/Props

### Agent
- **id** *(string)*: Unique identifier for the agent.
- **name** *(string)*: Name of the agent.
- **skills** *(Record<string, number>*: Dictionary of skills with respective proficiency values (0 to 1).
- **experience** *(number)*: Years of experience.
- **availability** *(boolean)*: Indicates if the agent is available for assignment.
- **performance_rating** *(number)*: Historical performance score of the agent.

### Task
- **id** *(string)*: Unique identifier for the task.
- **type** *(string)*: Type/category of the task.
- **complexity** *(number)*: Numeric representation of task complexity.
- **required_skills** *(Record<string, number>*: Skills required for the task with proficiency levels.
- **estimated_duration** *(number)*: Expected duration to complete the task in hours.
- **priority** *('low' | 'medium' | 'high' | 'critical')*: Priority level of the task.

### TeamComposition
- **agents** *(Agent[])*: Array of agents selected for the team.
- **roles** *(Record<string, string>*: Mapping of agent IDs to their respective roles.
- **predicted_performance** *(number)*: Predicted performance score for the team.
- **confidence** *(number)*: Confidence level of the prediction (0 to 1).

### OptimizationResult
- **recommended_team** *(TeamComposition)*: The optimal team composition based on analysis.
- **alternatives** *(TeamComposition[])*: List of alternative team compositions.
- **performance_score** *(number)*: Overall performance score achieved.
- **reasoning** *(string)*: Explanation of how the optimization was determined.
- **optimization_time** *(number)*: Time taken to perform the optimization in milliseconds.

## Return Values
Upon executing the optimization method, the service will return an `OptimizationResult` containing the recommended team and performance metrics.

## Examples

### Example Usage

```typescript
import { TeamOptimizationService } from '../../services/team-optimization';

// Initialize service
const teamOptimizationService = new TeamOptimizationService();

// Sample agents and tasks
const agents: Agent[] = [
    { id: '1', name: 'Alice', skills: { frontend: 0.9, react: 0.85 }, experience: 5, availability: true, performance_rating: 90 },
    { id: '2', name: 'Bob', skills: { backend: 0.8, node: 0.9 }, experience: 7, availability: true, performance_rating: 85 }
];

const task: Task = { id: '1', type: 'Development', complexity: 3, required_skills: { frontend: 0.8 }, estimated_duration: 10, priority: 'high' };

// Execute optimization
const result = await teamOptimizationService.optimizeTeam(agents, task);

// Display result
console.log('Recommended Team:', result.recommended_team);
console.log('Performance Score:', result.performance_score);
```
``` 

This documentation provides a concise overview of the Team Performance Optimization Service including its purpose, usage, parameter definitions, return values, and an example implementation.