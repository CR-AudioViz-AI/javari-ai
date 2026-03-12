# Build Visual Team Composition Interface

# Visual Team Builder Documentation

## Purpose
The **Visual Team Builder** component facilitates drag-and-drop functionality for creating and managing team compositions. Users can sort and organize team members using a visually interactive interface. 

## Usage
To use the Visual Team Builder component, simply import it into your project:

```tsx
import VisualTeamBuilder from 'src/components/team-composition/visual-team-builder';
```

Include the component in your JSX as follows:

```tsx
<VisualTeamBuilder />
```

## Parameters/Props
The `VisualTeamBuilder` accepts the following optional props:

- **initialTeam** (Array<AIAgent>): An array of initial team members to display. Each member must adhere to the `AIAgent` interface.
- **roleTemplates** (Array<RoleTemplate>): An array of role templates available for team composition, each adhering to the `RoleTemplate` interface.
  
### AIAgent Interface
```tsx
interface AIAgent {
  id: string;                  // Unique identifier for the agent
  name: string;                // Name of the agent
  type: string;                // Type/category of the agent
  capabilities: string[];      // Capabilities of the agent
  cost_per_hour: number;       // Cost to use the agent per hour
  performance_score: number;   // Performance rating of the agent
  availability: number;        // Availability rating (0-100)
  specializations: string[];   // Specializations of the agent
  experience_level: string;    // Level of experience: 'junior', 'mid', 'senior', 'expert'
  metadata: Record<string, any>; // Additional metadata
}
```

### RoleTemplate Interface
```tsx
interface RoleTemplate {
  id: string;                // Unique identifier for the role
  name: string;              // Name of the role
  description: string;       // Description of the role
  required_skills: string[]; // Skills required for the role
}
```

## Return Values
This component does not return a value but renders a visual interface for team composition.

## Examples
1. **Basic Example**
   ```tsx
   const initialTeam = [
     { id: '1', name: 'Alice', type: 'Developer', capabilities: ['React', 'Node.js'], cost_per_hour: 50, performance_score: 90, availability: 80, specializations: ['Frontend'], experience_level: 'mid', metadata: {} },
     { id: '2', name: 'Bob', type: 'Designer', capabilities: ['Figma', 'Photoshop'], cost_per_hour: 40, performance_score: 85, availability: 90, specializations: ['UI/UX'], experience_level: 'senior', metadata: {} }
   ];

   <VisualTeamBuilder initialTeam={initialTeam} />
   ```

2. **Using Role Templates**
   ```tsx
   const roleTemplates = [
     { id: '1', name: 'Frontend Developer', description: 'Builds the user interface', required_skills: ['HTML', 'CSS', 'JavaScript'] },
     { id: '2', name: 'Backend Developer', description: 'Develops server-side logic', required_skills: ['Node.js', 'Express'] }
   ];

   <VisualTeamBuilder initialTeam={initialTeam} roleTemplates={roleTemplates} />
   ```

By following this documentation, developers can effectively implement the Visual Team Builder into their applications for enhanced team composition management.