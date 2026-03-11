# Build Universal Payment Checkout Widget

```markdown
# Universal Payment Checkout Widget

## Purpose
The Universal Payment Checkout widget is designed to facilitate the checkout process for users by integrating multiple payment methods and currency options, ensuring a seamless payment experience.

## Usage
To utilize the Universal Payment Checkout component, include it in your layout or page component and provide it with necessary props:

```tsx
<UniversalPaymentCheckout 
  paymentData={paymentData}
  currencies={availableCurrencies}
  savedPaymentMethods={userPaymentMethods}
/>
```

## Parameters/Props

| Prop                     | Type                                   | Description                                                      |
|--------------------------|----------------------------------------|------------------------------------------------------------------|
| `paymentData`            | `PaymentData`                          | Configuration object for payment, including amount, currency, items, and optional fields like tax and shipping. |
| `currencies`             | `Currency[]`                          | Array of available currencies with corresponding conversion rates. |
| `savedPaymentMethods`     | `PaymentMethod[]` (optional)         | Array of user's previously saved payment methods for quick selection. |
| `onPaymentSuccess`       | `(data: any) => void` (optional)    | Callback function triggered upon successful payment processing. |
| `onPaymentError`         | `(error: any) => void` (optional)    | Callback function triggered on payment failures.                |

## Return Values
The Universal Payment Checkout component does not return values directly but encourages the use of callback functions (`onPaymentSuccess` and `onPaymentError`) to handle payment outcomes.

## Examples

### Basic Example
Here is a basic implementation of the widget with default payment data:

```tsx
const paymentData = {
  amount: 100.00,
  currency: 'USD',
  items: [
    { id: 'item1', name: 'Product 1', price: 50.00, currency: 'USD', quantity: 1 },
    { id: 'item2', name: 'Product 2', price: 50.00, currency: 'USD', quantity: 1 }
  ]
};

const availableCurrencies = [
  { code: 'USD', symbol: '$', name: 'US Dollar', rate: 1 },
  { code: 'EUR', symbol: '€', name: 'Euro', rate: 0.85 }
];

<UniversalPaymentCheckout 
  paymentData={paymentData}
  currencies={availableCurrencies}
/>
```

### With Saved Payment Methods
Example of utilizing saved payment methods for improved user experience:

```tsx
const userPaymentMethods = [
  { id: 'pm1', type: 'card', name: 'Visa **** 1234', icon: <CreditCard />, isDefault: true },
  { id: 'pm2', type: 'paypal', name: 'PayPal', icon: <Wallet /> }
];

<UniversalPaymentCheckout 
  paymentData={paymentData}
  currencies={availableCurrencies}
  savedPaymentMethods={userPaymentMethods}
/>
```

## Notes
Ensure that the currency rates are updated regularly and that user payment methods are securely stored and managed according to best practices in payment processing.
```