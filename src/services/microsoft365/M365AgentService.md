# Create Microsoft 365 AI Agent Service

```markdown
# M365AgentService Documentation

## Purpose
The `M365AgentService` facilitates the integration of AI agents with Microsoft 365 services, leveraging capabilities such as attending meetings, managing emails, analyzing documents, automating workflows, and assisting with calendar events.

## Usage
This service is intended for developers looking to implement AI-driven functionalities within Microsoft 365 platforms, utilizing the Microsoft Graph API and Azure authentication methods.

### Dependencies
- `@microsoft/microsoft-graph-client`
- `@azure/msal-node`
- `botbuilder`
- `@supabase/supabase-js`
- `openai`

## Parameters / Props

### M365AuthConfig
- **clientId** (string): The application ID registered in Azure AD.
- **clientSecret** (string): The secret associated with the Azure AD application.
- **tenantId** (string): The Azure AD tenant ID.
- **redirectUri** (string): The redirect URI for authentication.
- **scopes** (string[]): Array of permissions required by the application.

### AgentConfig
- **id** (string): Unique identifier for the AI agent.
- **name** (string): Name of the AI agent.
- **description** (string): Brief description of the agent's purpose.
- **capabilities** (AgentCapability[]): List of functionalities the agent can perform.
- **personality** (string): Describes the style or tone of the agent's interactions.
- **systemPrompt** (string): Initial prompt defining the agent's behavior.
- **maxTokens** (number): Maximum tokens for generated responses.
- **temperature** (number): Controls variability in output (0.0 to 1.0).

### AgentCapability (Enum)
Defines the capabilities of the agent:
- `MEETING_PARTICIPANT`
- `EMAIL_MANAGER`
- `DOCUMENT_ANALYZER`
- `WORKFLOW_AUTOMATOR`
- `CALENDAR_ASSISTANT`

### MeetingContext
- **meetingId** (string): Identifier for the meeting.
- **organizerId** (string): ID of the meeting organizer.
- **participants** (Participant[]): List of participants in the meeting.
- **agenda** (string): Meeting agenda.
- **transcript** (string[]): Array of messages or parts of the conversation.
- **sharedFiles** (SharedFile[]): Files shared during the meeting.
- **startTime** (Date): Start time of the meeting.
- **endTime** (Date): Optional end time of the meeting.
- **status** (string): Current status of the meeting ('scheduled', 'active', 'ended').

### Participant
- **id** (string): Unique identifier for the participant.
- **displayName** (string): Display name of the participant.
- **email** (string): Email address of the participant.
- **role** (string): Role in the meeting ('organizer', 'presenter', 'attendee').
- **isAgent** (boolean): Indicates if the participant is an AI agent.

### SharedFile
- **id** (string): Unique identifier for the file.
- **name** (string): Name of the file.
- **url** (string): Download or access URL for the file.
- **type** (string): Category/type of the file.
- **uploadedBy** (string): ID of the user who uploaded the file.
- **uploadedAt** (Date): Date the file was uploaded.

### EmailContext
- **messageId** (string): Unique identifier for the email.
- **subject** (string): Subject line of the email.
- **sender** (string): Email address of the sender.
- **recipients** (string[]): Array of recipient email addresses.
- **body** (string): Main content of the email.
- **attachments** (Attachment[]): List of email attachments.
- **importance** (string): Email importance level ('low', 'normal', 'high').

## Examples
```typescript
const authConfig: M365AuthConfig = {
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  tenantId: 'your-tenant-id',
  redirectUri: 'http://localhost:3000/auth/callback',
  scopes: ['Mail.Read', 'User.Read']
};

const agentConfig: AgentConfig = {
  id: 'agent-1',
  name: 'Assistant Bot',
  description: 'An intelligent assistant for handling calendar and emails.',
  capabilities: [AgentCapability.EMAIL_MANAGER, AgentCapability.CALENDAR_ASSISTANT],
  personality: 'friendly',
  systemPrompt: 'You are a helpful assistant.',
  maxTokens: 150,
  temperature: 0.7
};
```
```