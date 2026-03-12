# Build Team Composition Optimizer API

```markdown
# Team Composition Optimizer API Documentation

## Purpose
The Team Composition Optimizer API is designed to analyze given task requirements and optimize team composition dynamically by selecting suitable agents based on their skills, availability, and performance metrics. The API returns an optimal team configuration to efficiently address specific tasks while considering constraints like budget and deadlines.

## Usage
This API can be integrated into applications requiring task delegation, project management, or team-building functionalities. It uses agent profiles to determine the best-fit team for a specified task based on input parameters.

## Endpoint
- `POST /api/team/composition/optimize`

## Parameters / Props
The request body should contain a JSON object structured according to the following schema validated using Zod:

```typescript
const OptimizeTeamSchema = z.object({
  task_description: z.string().min(10).max(5000),
  task_type: z.enum(['analysis', 'creative', 'technical', 'research', 'mixed']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  budget_constraint: z.number().positive().optional(),
  deadline_hours: z.number().positive().optional(),
  required_skills: z.array(z.string()).optional(),
  team_size_preference: z.object({
    min: z.number().int().min(1).max(20),
    max: z.number().int().min(1).max(20)
  }).optional(),
  exclude_agents: z.array(z.string()).optional()
});
```

### Description of Parameters
- **task_description**: A detailed description of the task (10-5000 characters).
- **task_type**: Categorization of the task (one of 'analysis', 'creative', 'technical', 'research', or 'mixed').
- **priority**: The task's priority level (one of 'low', 'medium', 'high', or 'critical').
- **budget_constraint**: An optional budget limit for the team.
- **deadline_hours**: An optional deadline in hours for task completion.
- **required_skills**: An optional array of skills needed for the task.
- **team_size_preference**: An optional object specifying minimum and maximum team size preferences.
- **exclude_agents**: An optional array of agent IDs to exclude from the team selection.

## Return Values
Upon a successful request, the API returns a JSON object containing the optimized team composition:

```typescript
interface TeamComposition {
  agents: Agent[];
  synergy_score: number;
  estimated_performance: number;
  total_cost: number;
  confidence: number;
}
```

### Description of Return Values
- **agents**: Array of selected agents for the team.
- **synergy_score**: A calculated score representing the team's collaboration potential.
- **estimated_performance**: Predicted performance of the selected team based on historical data.
- **total_cost**: Total cost for employing the selected team for the task.
- **confidence**: Confidence score indicating the reliability of the composition.

## Examples
### Example Request
```json
{
  "task_description": "Create a market analysis report based on recent trends.",
  "task_type": "analysis",
  "priority": "high",
  "budget_constraint": 5000,
  "deadline_hours": 48,
  "required_skills": ["data analysis", "report writing"],
  "team_size_preference": {"min": 3, "max": 5}
}
```

### Example Response
```json
{
  "agents": [
    {
      "id": "agent_1",
      "name": "Alice",
      "skills": ["data analysis", "statistics"],
      "specializations": ["market research"],
      "performance_score": 90,
      "availability_status": "available",
      "cost_per_hour": 50,
      "experience_level": 5
    },
    {
      "id": "agent_2",
      "name": "Bob",
      "skills": ["report writing", "content creation"],
      "specializations": ["business analytics"],
      "performance_score": 85,
      "availability_status": "available",
      "cost_per_hour": 40,
      "experience_level": 4
    }
  ],
  "synergy_score": 75,
  "estimated_performance": 88,
  "total_cost": 7200,
  "confidence": 0.9
}
```
```