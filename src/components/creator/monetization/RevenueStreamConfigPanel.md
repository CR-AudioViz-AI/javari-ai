# Create Revenue Stream Configuration Panel

# RevenueStreamConfigPanel

## Purpose
The `RevenueStreamConfigPanel` component provides a UI for configuring different revenue streams in a monetization setup. It allows users to input details for subscription tiers and tip settings using a structured form, featuring validation and dynamic fields.

## Usage
This component should be utilized within a React application where revenue stream configuration is necessary. It leverages `react-hook-form` for form handling and validation through Zod schemas.

### Importing
```tsx
import RevenueStreamConfigPanel from 'src/components/creator/monetization/RevenueStreamConfigPanel';
```

### Example Usage
```tsx
const App = () => {
  return (
    <div>
      <h1>Configure Revenue Streams</h1>
      <RevenueStreamConfigPanel />
    </div>
  );
};
```

## Parameters/Props
The `RevenueStreamConfigPanel` component accepts no props directly; it manages state internally using React hooks and `react-hook-form`. Ensure you have the following dependencies installed:
- `react`
- `zod`
- `react-hook-form`
- `lucide-react`
- Custom UI components and libraries as referenced in the code.

## Return Values
The component does not return values in the traditional sense; instead, it manages its own state for revenue stream configurations. User input is validated and handled internally.

## Features
- **Subscription Tier Configuration**: Users can create multiple tiers with fields such as name, description, price, currency, billing cycle, features list, max subscribers, and active status. 
- **Tip Settings**: Users can enable or disable tipping configurations.
- **Dynamic and Validated Input**: Utilizes Zod for input validation, ensuring all necessary data is provided and adheres to specified formats.

## Validation Schemas
The component uses the following validation schemas:
1. **Subscription Tier Schema**:
   - `name`: Required string.
   - `description`: Optional string.
   - `price`: Minimum value of 0.99.
   - `currency`: Defaults to "USD".
   - `billingCycle`: Enum type, either "monthly" or "yearly".
   - `features`: Array of strings.
   - `maxSubscribers`: Optional number.
   - `isActive`: Optional boolean, defaults to true.

2. **Tip Setting Schema**:
   - `enabled`: Boolean to toggle status, defaulting to true (not fully shown in provided code).

## Example
```tsx
const subscriptionExample = {
  name: "Basic Tier",
  description: "Access to basic features",
  price: 9.99,
  currency: "USD",
  billingCycle: "monthly",
  features: ["Feature 1", "Feature 2"],
  isActive: true,
};

// Configure with example data
const Example = () => (
  <RevenueStreamConfigPanel
    initialData={subscriptionExample}
  />
);
```

## Conclusion
The `RevenueStreamConfigPanel` component is an essential tool for managing monetization configurations in your application. Its robust form handling and validation make it easy to ensure that all required revenue stream data is accurately captured.