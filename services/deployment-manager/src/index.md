# Deploy Automated Blue-Green Deployment Manager

```markdown
# Blue-Green Deployment Manager

## Purpose
The Blue-Green Deployment Manager is an autonomous service designed to facilitate blue-green deployments within the CR AudioViz AI platform. It automates traffic switching, performs health validations, and supports instant rollbacks to ensure a seamless deployment process.

## Usage
To deploy the Blue-Green Deployment Manager, instantiate an Express application and configure the necessary middlewares and routes. The service handles incoming deployment requests, manages deployment states, and leverages Kubernetes for orchestrating containerized applications.

```typescript
import { App } from './services/deployment-manager';

const app = new App();
app.start(); // starts the deployment manager
```

## Parameters/Props

### DeploymentConfig Interface
The `DeploymentConfig` interface defines the configuration for a deployment.

- `serviceId` (string): Unique identifier for the service to be deployed.
- `targetEnvironment` (DeploymentEnvironment): The environment to deploy to, either 'blue' or 'green'.
- `strategy` (TrafficStrategy): The traffic strategy to use—can be 'blue_green', 'canary', or 'rolling'.
- `image` (string): Docker image to be deployed.
- `replicas` (number): Number of replicas for the deployment.
- `resources` (object):
  - `cpu` (string): CPU resource request.
  - `memory` (string): Memory resource request.
- `healthCheck` (object):
  - `path` (string): Path for health checks.
  - `port` (number): Port for health checks.
  - `timeout` (number): Timeout for health checks.
  - `interval` (number): Interval between health checks.
  - `threshold` (number): Number of consecutive failures allowed before the service is deemed unhealthy.
- `trafficSplit` (object): Configuration for traffic splitting (e.g., `canaryPercentage` for canary strategy).

### Enums
- **DeploymentEnvironment**: Defines environment types.
- **DeploymentStatus**: Enumerates possible deployment statuses (e.g., PENDING, DEPLOYING, ACTIVE, FAILED).
- **HealthStatus**: Used for health check results (HEALTHY, UNHEALTHY, DEGRADE).
- **TrafficStrategy**: Defines traffic management strategies.

## Return Values
The service interacts primarily via HTTP endpoints and returns JSON objects containing the status of deployments, health check results, and configuration confirmations in response to requests.

## Examples

### Example of Deployment Configuration
```typescript
const deploymentConfig: DeploymentConfig = {
  serviceId: 'my-service',
  targetEnvironment: 'green',
  strategy: 'blue_green',
  image: 'my-org/my-service:latest',
  replicas: 3,
  resources: {
    cpu: '500m',
    memory: '128Mi'
  },
  healthCheck: {
    path: '/health',
    port: 8080,
    timeout: 5,
    interval: 10,
    threshold: 3
  },
  trafficSplit: {
    canaryPercentage: 10 // Optional, applicable for canary strategy
  }
};
```

### Starting the Deployment Manager
```typescript
const manager = new BlueGreenDeploymentManager();
manager.start();
// The server will listen on the defined port
```

This documentation provides an overview of the Blue-Green Deployment Manager's functionality, configuration, and implementation details necessary for deployment and use within the CR AudioViz AI platform.
```