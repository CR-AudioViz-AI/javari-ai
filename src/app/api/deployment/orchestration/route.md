# Build Deployment Pipeline Orchestration API

# Deployment Pipeline Orchestration API Documentation

## Purpose
The Deployment Pipeline Orchestration API is designed to facilitate the creation, execution, and management of deployment pipelines for applications. This API interacts with various services such as Supabase, GitHub, and Kubernetes to provide a seamless CI/CD experience.

## Usage
To use the Deployment Pipeline Orchestration API, you will need to make HTTP requests to the defined endpoints for creating pipelines, executing them, and handling rollbacks. Ensure that the proper environment variables are set for authentication and service access.

## Parameters / Props

### Create Pipeline
- **`name`** (string): The name of the pipeline (1-255 characters).
- **`repository`** (string): The URL of the repository (must be a valid URL).
- **`branch`** (string): The branch to be deployed (1-100 characters).
- **`environments`** (array of strings): List of environments for deployment (min. 1).
- **`stages`** (array of objects): Array of deployment stages (min. 1).
  - **`name`** (string): Name of the stage (1-255 characters).
  - **`environment`** (string): The environment for the stage (1-100 characters).
  - **`dependencies`** (optional, array of strings): Dependencies of the stage.
  - **`config`** (optional, object): Configuration settings for the stage.
  - **`timeout`** (optional, number): Timeout duration in seconds (60-3600).
- **`autoRollback`** (optional, boolean): Enable automatic rollback on failure.
- **`notifications`** (optional, object): Notification settings.
  - **`webhook`** (optional, string): URL for webhook notifications.
  - **`email`** (optional, array of strings): List of email recipients.

### Execute Pipeline
- **`commitSha`** (string): SHA of the commit being deployed (must be 40 characters).
- **`triggeredBy`** (string): User who triggered the execution (1-255 characters).
- **`skipStages`** (optional, array of strings): Stages to skip during execution.
- **`dryRun`** (optional, boolean): Perform a dry run without executing.

### Rollback
- **`targetDeploymentId`** (optional, string): UUID of the deployment to rollback to.
- **`reason`** (string): Reason for rollback (1-500 characters).
- **`skipValidation`** (optional, boolean): Skip validation checks.

## Return Values
The API returns responses based on the request type:
- For pipeline creation, it returns the created pipeline details.
- For execution, it returns the status and ID of the executed pipeline.
- For rollback, it returns the result of the rollback operation.

## Examples

### Create a Pipeline
```json
{
  "name": "My CI Pipeline",
  "repository": "https://github.com/user/my-repo",
  "branch": "main",
  "environments": ["staging", "production"],
  "stages": [
    {
      "name": "Deploy to Staging",
      "environment": "staging",
      "timeout": 300
    },
    {
      "name": "Deploy to Production",
      "environment": "production",
      "dependencies": ["Deploy to Staging"]
    }
  ],
  "autoRollback": true,
  "notifications": {
    "webhook": "https://my.webhook.url",
    "email": ["user@example.com"]
  }
}
```

### Execute a Pipeline
```json
{
  "commitSha": "1234567890abcdef1234567890abcdef12345678",
  "triggeredBy": "user@example.com",
  "dryRun": false
}
```

### Rollback
```json
{
  "targetDeploymentId": "e63fdd54-ff67-4cfa-a0b4-3ab0432ad8db",
  "reason": "Major issues detected after deployment"
}
``` 

Ensure to handle responses accordingly based on the operation outcomes.