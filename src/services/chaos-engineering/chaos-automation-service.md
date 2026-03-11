# Deploy Chaos Engineering Automation Service

```markdown
# Chaos Automation Service

## Purpose
The `ChaosAutomationService` is designed to automate chaos engineering experiments in a Kubernetes environment. It integrates with Supabase for data persistence, Kubernetes APIs for pod and deployment management, and Prometheus for monitoring metrics. The service allows the execution, scheduling, and management of chaos experiments by utilizing configurations provided during instantiation.

## Usage
To utilize the `ChaosAutomationService`, instantiate it with necessary configurations, and call its methods for managing chaos experiments.

```typescript
import { ChaosAutomationService } from './path/to/chaos-automation-service';

const service = new ChaosAutomationService(config);
service.runChaosExperiment(experimentDetails);
```

## Parameters/Props
The service takes in a configuration object during initialization. The config properties include:

- `supabase`: Configuration for Supabase
  - `url`: URL for the Supabase instance
  - `key`: API key for accessing Supabase
- `kubernetes`: Configuration for Kubernetes
  - `configPath`: Path to the Kubeconfig file
  - `namespace`: Kubernetes namespace to operate within
- `safety`: Safety settings for running experiments
  - `maxConcurrentExperiments`: Maximum number of concurrent chaos experiments
  - `cooldownPeriodMs`: Cooldown period between experiments in milliseconds
  - `emergencyStopEnabled`: Boolean flag to enable emergency stop functionality
- `notifications`: Notification configurations
  - `slack`: Slack integration configuration
    - `webhook`: Slack webhook URL
    - `channel`: Slack channel for notifications
  - `pagerDuty`: (additional PagerDuty settings can be included here)

## Return Values
The methods of the `ChaosAutomationService` typically return promises that resolve to a success status or throw errors if operations fail.

## Examples

### Instantiation and Basic Use
```typescript
const config = {
  supabase: { url: 'https://test.supabase.co', key: 'test-key' },
  kubernetes: { configPath: '/test/kubeconfig', namespace: 'test-namespace' },
  safety: { maxConcurrentExperiments: 3, cooldownPeriodMs: 300000, emergencyStopEnabled: true },
  notifications: {
    slack: { webhook: 'https://hooks.slack.com/test', channel: '#chaos-engineering' },
    pagerDuty: { /* PagerDuty config here */ }
  }
};

const chaosService = new ChaosAutomationService(config);
chaosService.runChaosExperiment({ type: 'pod-failure', target: 'example-pod' })
  .then(result => console.log('Chaos experiment initiated', result))
  .catch(err => console.error('Error initiating chaos experiment', err));
```

### Error Handling
```typescript
chaosService.runChaosExperiment({ type: 'network-latency', target: 'example-service' })
  .then(result => console.log(result))
  .catch(err => console.error('Chaos experiment failed', err));
```

### Notification of Results
Results of chaos experiments will be sent to the configured Slack channel and/or PagerDuty based on the provided configurations.
```