# Build Team Performance Monitoring System

```markdown
# Team Performance Monitoring System

## Purpose
The Team Performance Monitoring System is designed to analyze and visualize the performance metrics of team members. It aggregates various performance indicators, allowing managers to assess team productivity, identify bottlenecks, and improve overall team efficiency.

## Usage
To implement the Team Performance Monitoring System in your React application, import and utilize the primary component found in `src/app/(dashboard)/team-performance/page.tsx`. This component integrates various UI elements to present data visually and interactively.

### Example Usage
```jsx
import TeamPerformance from './path/to/team-performance/page';

function App() {
  return (
    <div>
      <TeamPerformance />
    </div>
  );
}
```

## Parameters / Props
The `TeamPerformance` component accepts the following props:

- **agentMetrics**: An array of objects conforming to the `AgentMetrics` interface. Represents individual agent performance.
- **teamMetrics**: An object conforming to the `TeamMetrics` interface. Summarizes overall team performance.
- **productivityTrend**: An array of objects conforming to the `ProductivityTrend` interface. Displays historical productivity data.
  
### AgentMetrics Interface
```typescript
interface AgentMetrics {
  id: string;                // Unique identifier for the agent
  name: string;              // Agent's name
  email: string;             // Agent's email
  avatar?: string;           // URL to the agent's avatar image
  status: 'online' | 'offline' | 'away' | 'busy'; // Current online status
  utilization: number;       // Percentage of time the agent is utilized
  tasksCompleted: number;    // Total number of tasks completed
  averageTaskTime: number;   // Average time spent on tasks (in minutes)
  qualityScore: number;      // Quality of completed tasks (0-100)
  collaborationIndex: number; // Measure of collaboration with the team
  lastActivity: string;      // Timestamp of the last activity
  currentTasks: number;      // Number of tasks currently assigned
  overdueItems: number;      // Number of overdue tasks
}
```

### TeamMetrics Interface
```typescript
interface TeamMetrics {
  totalAgents: number;                  // Total agents in the team
  activeAgents: number;                  // Total active agents
  averageUtilization: number;            // Average utilization across the team
  totalTasksCompleted: number;           // Total tasks completed by the team
  averageCompletionTime: number;         // Average time to complete tasks (in minutes)
  teamProductivityScore: number;         // Overall productivity score for the team
  collaborationEfficiency: number;       // Efficiency of collaboration
  bottleneckCount: number;               // Number of identified bottlenecks
  alertCount: number;                    // Total number of alerts triggered
}
```

### ProductivityTrend Interface
```typescript
interface ProductivityTrend {
  date: string;                         // Date of the recorded metric
  productivityScore: number;            // Productivity score for the date
}
```

## Return Values
The `TeamPerformance` component renders a series of UI components including cards, charts, and tabs, each displaying relevant performance metrics. It uses data visualization libraries (e.g., Recharts) to produce interactive graphs that illustrate agent and team performance trends.

## Examples
Here’s an example illustrating how data can be passed to the component:
```jsx
const agentMetrics = [
  {
    id: "1",
    name: "John Doe",
    email: "johndoe@example.com",
    status: "online",
    utilization: 85,
    tasksCompleted: 23,
    averageTaskTime: 30,
    qualityScore: 90,
    collaborationIndex: 75,
    lastActivity: "2023-10-01T10:15:00Z",
    currentTasks: 3,
    overdueItems: 1,
  },
  // More agents...
];

const teamMetrics = {
  totalAgents: 10,
  activeAgents: 8,
  averageUtilization: 80,
  totalTasksCompleted: 200,
  averageCompletionTime: 45,
  teamProductivityScore: 88,
  collaborationEfficiency: 70,
  bottleneckCount: 2,
  alertCount: 3,
};

const productivityTrend = [
  { date: "2023-10-01", productivityScore: 85 },
  { date: "2023-10-02", productivityScore: 88 },
  // More records...
];

<TeamPerformance
  agentMetrics={agentMetrics}
  teamMetrics={teamMetrics}
  productivityTrend={productivityTrend}
/>
```
```