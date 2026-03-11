# Build Community Reputation Scoring Module

# Community Reputation Scoring Module

## Purpose
The Community Reputation Scoring Module is a React component that manages and computes individual user reputation scores within a community. It aggregates various metrics, such as contributions and validations, to create a comprehensive score that helps display user standings and achievements.

## Usage
To use the Community Reputation Scoring Module, import it into your desired React component, instantiate it with necessary props, and render it.

```javascript
import ReputationScoringModule from 'src/modules/community/reputation/ReputationScoringModule';

// Inside your functional component
<ReputationScoringModule userId="user123" />
```

## Parameters/Props
The component accepts the following parameters:

- **userId** (string): The unique identifier of the user for whom the reputation score is retrieved and computed.
- **onScoreUpdate** (function | optional): A callback function that is triggered when the user’s score is updated.
  
Example props usage:
```javascript
<ReputationScoringModule 
    userId="user123" 
    onScoreUpdate={(newScore) => console.log('Updated Score:', newScore)} 
/>
```

## Return Values
The component returns a JSX element that displays:

- The user’s total reputation score.
- Score breakdown by contributions (posts, comments, upvotes, etc.).
- Display of badges earned and their respective levels.
- A history chart of score changes over time, detailing reasons and categories for each change (contribution, validation, penalty, bonus).

## Examples
### Basic Example
Here's a minimal example of how to implement the component in a parent component:

```javascript
import React from 'react';
import ReputationScoringModule from 'src/modules/community/reputation/ReputationScoringModule';

const CommunityDashboard = () => {
    return (
        <div>
            <h1>Community Dashboard</h1>
            <ReputationScoringModule userId="user123" />
        </div>
    );
};

export default CommunityDashboard;
```

### Advanced Example with Callback
A more advanced implementation that logs the updated score to the console might look like this:

```javascript
import React from 'react';
import ReputationScoringModule from 'src/modules/community/reputation/ReputationScoringModule';

const UserProfile = () => {
    const handleScoreUpdate = (newScore) => {
        console.log('User reputation score updated:', newScore);
    };

    return (
        <div>
            <h1>User Profile</h1>
            <ReputationScoringModule 
                userId="user456" 
                onScoreUpdate={handleScoreUpdate} 
            />
        </div>
    );
};

export default UserProfile;
```

### Notes
- Ensure you have the Supabase client set up correctly to manage real-time updates.
- The component relies on React hooks (useState, useEffect) for state management and lifecycle handling. 
- Additional UI customization can be achieved by overriding default styles or extending the component based on the community needs.

This module serves as a foundational component for fostering community engagement by dynamically representing user contributions and standing.