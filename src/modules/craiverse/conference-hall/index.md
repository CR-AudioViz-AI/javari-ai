# Build CRAIverse Conference Hall Module

```markdown
# CRAIverse Conference Hall Module

## Purpose
The CRAIverse Conference Hall Module provides a robust framework for virtual conference events, enabling functionalities for participant management, event scheduling, real-time communication, and interactive tools such as chat, polls, and reactions within a 3D environment.

## Usage
This module is designed to be utilized within a React application that supports 3D rendering using the `@react-three/fiber` library. It necessitates integration with Supabase for real-time database management and AgoraRTC for audio/video streaming capabilities.

### Steps to Use:
1. Import the Conference Hall component into your primary application file.
2. Integrate with Supabase for managing event and participant data.
3. Setup AgoraRTC for audio/video handling.
4. Use the context provided to manipulate the conference state and handle events like user participation and chat management.

```javascript
import { ConferenceHall } from 'src/modules/craiverse/conference-hall';

function App() {
  return (
    <div>
      <ConferenceHall />
    </div>
  );
}
```

## Parameters/Props
The `ConferenceHall` component does not accept props directly but relies on its internal state and context for managing:

- **currentEvent**: The event currently being conducted.
- **events**: List of scheduled events.
- **participants**: List of participants in the conference.
- **chatMessages**: Conversations happening in real-time.
- **polls**: Active polling options for participant engagement.
- **reactions**: User reactions during the event.

Configurable parameters include:
- **streamingEnabled**: Boolean indicating if live streaming is active.
- **recordingEnabled**: Boolean indicating if the session is being recorded.
- **moderationEnabled**: Boolean controlling the moderation of chat.

## Return Values
The module returns a fully interactive conference environment rendered using Three.js. It maintains the state of the conference internally but provides several hooks and context methods for external access to manage events and participant interactions.

## Examples
### Basic Setup
```javascript
import React from 'react';
import { ConferenceHall } from 'src/modules/craiverse/conference-hall';

const App = () => {
  return (
    <ConferenceHall />
  );
};
```

### Managing State with Context
Using the context to update chat messages:
```javascript
import { useConferenceContext } from 'src/modules/craiverse/conference-hall/context';

const ChatComponent = () => {
  const { chatMessages, addChatMessage } = useConferenceContext();

  const sendMessage = (messageContent) => {
    addChatMessage({
      userId: 'user1',
      username: 'User One',
      content: messageContent,
      timestamp: new Date(),
      type: 'message',
      isModerated: false,
    });
  };

  return <ChatInterface messages={chatMessages} onSend={sendMessage} />;
};
```

### Polling Example
Creating a new poll:
```javascript
const createPoll = () => {
  const newPoll = {
    id: 'poll1',
    question: 'What is your favorite topic?',
    options: [{ id: 'option1', text: 'AI', votes: 0 }],
    isActive: true,
  };
  // Add logic to set new poll in the conference state
};
```
This documentation provides essential information for implementing and utilizing the CRAIverse Conference Hall Module effectively.
```