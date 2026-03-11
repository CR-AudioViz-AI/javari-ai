# Build Universal Checkout Experience

# UniversalCheckout Component

## Purpose
The `UniversalCheckout` component provides a seamless checkout experience for e-commerce applications. It handles user input for cart items, payment methods, and shipping options while supporting multiple locales and currencies.

## Usage
To use the `UniversalCheckout` component, import it into your application, and pass the required props, including the cart items and an order completion callback.

```jsx
import UniversalCheckout from './src/components/checkout/UniversalCheckout';

const MyCheckoutPage = () => {
  const cartItems = [
    { id: '1', name: 'Product 1', price: 29.99, quantity: 2, currency: 'USD' },
    { id: '2', name: 'Product 2', price: 49.99, quantity: 1, currency: 'USD' },
  ];

  const handleOrderComplete = (order) => {
    console.log('Order completed:', order);
  };

  return (
    <UniversalCheckout 
      cartItems={cartItems} 
      onOrderComplete={handleOrderComplete} 
      locale="en-US" 
      currency="USD" 
    />
  );
};
```

## Parameters/Props
The following props can be passed to the `UniversalCheckout` component:

| Prop               | Type                             | Description                                                                          |
|--------------------|----------------------------------|--------------------------------------------------------------------------------------|
| `cartItems`       | `CartItem[]`                    | An array of items in the user's cart.                                              |
| `onOrderComplete`  | `(order: Order) => void`        | Callback that is invoked when the order is successfully completed.                |
| `onBack`           | `() => void`                    | Optional callback for handling back navigation.                                     |
| `locale`          | `string`                        | Optional locale string for internationalization (default: undefined).              |
| `currency`        | `string`                        | Optional currency code for displaying prices (default: undefined).                 |
| `region`          | `string`                        | Optional region identifier (default: undefined).                                   |
| `abTestVariant`   | `string`                        | Optional variant identifier for A/B testing (default: undefined).                  |
| `className`       | `string`                        | Optional additional CSS classes for customization (default: undefined).            |

### CartItem Interface
```tsx
interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  currency: string;
}
```

### PaymentMethod Interface
```tsx
interface PaymentMethod {
  id: string;
  name: string;
  type: 'card' | 'paypal' | 'apple_pay' | 'google_pay' | 'bank_transfer' | 'crypto';
  icon: React.ComponentType<{ className?: string }>;
  regions: string[];
  currencies: string[];
  enabled: boolean;
}
```

### ShippingOption Interface
```tsx
interface ShippingOption {
  id: string;
  name: string;
  price: number;
  estimatedDays: number;
  currency: string;
}
```

## Return Values
The `UniversalCheckout` component does not return any values itself but triggers the provided `onOrderComplete` callback with the `Order` object upon successful completion of an order.

## Examples
Here’s a simple implementation of the `UniversalCheckout` component in a functional component:

```jsx
const ExampleCheckout = () => {
  const cartItems = [
    { id: '1', name: 'Widget', price: 20.0, quantity: 1, currency: 'USD' },
  ];

  const handleOrderComplete = (order) => {
    console.log('Order finished:', order);
  };

  return (
    <UniversalCheckout
      cartItems={cartItems}
      onOrderComplete={handleOrderComplete}
      locale="en-US"
      currency="USD"
      abTestVariant="A"
      className="checkout-container"
    />
  );
};
```

The `UniversalCheckout` component provides a robust framework for handling online purchases efficiently while accommodating various user preferences, currencies, and regions.