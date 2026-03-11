```tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useIntl, FormattedMessage, FormattedNumber } from 'react-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CreditCard, 
  Wallet, 
  MapPin, 
  User, 
  Shield, 
  Globe, 
  Truck,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// Types and Interfaces
interface UniversalCheckoutProps {
  cartItems: CartItem[];
  onOrderComplete: (order: Order) => void;
  onBack?: () => void;
  locale?: string;
  currency?: string;
  region?: string;
  abTestVariant?: string;
  className?: string;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  currency: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  type: 'card' | 'paypal' | 'apple_pay' | 'google_pay' | 'bank_transfer' | 'crypto';
  icon: React.ComponentType<{ className?: string }>;
  regions: string[];
  currencies: string[];
  enabled: boolean;
}

interface ShippingOption {
  id: string;
  name: string;
  price: number;
  estimatedDays: number;
  currency: string;
}

interface Address {
  firstName: string;
  lastName: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface Order {
  id: string;
  items: CartItem[];
  shipping: Address;
  billing: Address;
  paymentMethod: string;
  shippingOption: string;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
}

// Validation Schema
const addressSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  company: z.string().optional(),
  street1: z.string().min(1, 'Street address is required'),
  street2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
});

const checkoutSchema = z.object({
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Valid phone number required'),
  shipping: addressSchema,
  billing: addressSchema,
  paymentMethod: z.string().min(1, 'Payment method is required'),
  shippingOption: z.string().min(1, 'Shipping option is required'),
  sameAsBilling: z.boolean().default(false),
  terms: z.boolean().refine(val => val === true, 'You must accept the terms'),
  newsletter: z.boolean().default(false),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

// Constants
const CHECKOUT_STEPS = [
  { id: 'contact', label: 'Contact Information' },
  { id: 'shipping', label: 'Shipping Address' },
  { id: 'payment', label: 'Payment Method' },
  { id: 'review', label: 'Review Order' },
] as const;

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'card',
    name: 'Credit/Debit Card',
    type: 'card',
    icon: CreditCard,
    regions: ['US', 'CA', 'EU', 'UK', 'AU'],
    currencies: ['USD', 'CAD', 'EUR', 'GBP', 'AUD'],
    enabled: true,
  },
  {
    id: 'paypal',
    name: 'PayPal',
    type: 'paypal',
    icon: Wallet,
    regions: ['US', 'CA', 'EU', 'UK', 'AU'],
    currencies: ['USD', 'CAD', 'EUR', 'GBP', 'AUD'],
    enabled: true,
  },
];

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
];

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'AU', name: 'Australia' },
];

// Hooks
const useGeolocation = () => {
  const [location, setLocation] = useState<{ country?: string; region?: string }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate geolocation detection
    setTimeout(() => {
      setLocation({ country: 'US', region: 'NA' });
      setLoading(false);
    }, 1000);
  }, []);

  return { location, loading };
};

const useCurrencyConverter = (baseCurrency: string, targetCurrency: string) => {
  const [rate, setRate] = useState(1);
  const [loading, setLoading] = useState(false);

  const convert = useCallback((amount: number) => {
    return amount * rate;
  }, [rate]);

  useEffect(() => {
    if (baseCurrency === targetCurrency) {
      setRate(1);
      return;
    }

    setLoading(true);
    // Simulate currency conversion API
    setTimeout(() => {
      const mockRates: Record<string, number> = {
        'USD-EUR': 0.85,
        'USD-GBP': 0.73,
        'USD-CAD': 1.35,
        'EUR-USD': 1.18,
        'GBP-USD': 1.37,
      };
      const key = `${baseCurrency}-${targetCurrency}`;
      setRate(mockRates[key] || 1);
      setLoading(false);
    }, 500);
  }, [baseCurrency, targetCurrency]);

  return { rate, convert, loading };
};

// Components
const ProgressIndicator: React.FC<{ currentStep: number; totalSteps: number }> = ({ 
  currentStep, 
  totalSteps 
}) => {
  const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="w-full mb-8">
      <div className="flex justify-between mb-2">
        {CHECKOUT_STEPS.map((step, index) => (
          <div 
            key={step.id}
            className={`text-sm font-medium ${
              index + 1 <= currentStep ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            {step.label}
          </div>
        ))}
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
};

const LoadingSpinner: React.FC<{ message?: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-8">
    <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
    {message && <p className="text-sm text-muted-foreground">{message}</p>}
  </div>
);

const AddressForm: React.FC<{
  title: string;
  data: Partial<Address>;
  onChange: (data: Partial<Address>) => void;
  errors: any;
  register: any;
}> = ({ title, data, onChange, errors, register }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <MapPin className="h-5 w-5" />
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            {...register('shipping.firstName')}
            id="firstName"
            className={errors.shipping?.firstName ? 'border-destructive' : ''}
          />
          {errors.shipping?.firstName && (
            <p className="text-sm text-destructive mt-1">
              {errors.shipping.firstName.message}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            {...register('shipping.lastName')}
            id="lastName"
            className={errors.shipping?.lastName ? 'border-destructive' : ''}
          />
          {errors.shipping?.lastName && (
            <p className="text-sm text-destructive mt-1">
              {errors.shipping.lastName.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="company">Company (Optional)</Label>
        <Input {...register('shipping.company')} id="company" />
      </div>

      <div>
        <Label htmlFor="street1">Street Address *</Label>
        <Input
          {...register('shipping.street1')}
          id="street1"
          className={errors.shipping?.street1 ? 'border-destructive' : ''}
        />
        {errors.shipping?.street1 && (
          <p className="text-sm text-destructive mt-1">
            {errors.shipping.street1.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="street2">Apartment, suite, etc. (Optional)</Label>
        <Input {...register('shipping.street2')} id="street2" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="city">City *</Label>
          <Input
            {...register('shipping.city')}
            id="city"
            className={errors.shipping?.city ? 'border-destructive' : ''}
          />
          {errors.shipping?.city && (
            <p className="text-sm text-destructive mt-1">
              {errors.shipping.city.message}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="postalCode">Postal Code *</Label>
          <Input
            {...register('shipping.postalCode')}
            id="postalCode"
            className={errors.shipping?.postalCode ? 'border-destructive' : ''}
          />
          {errors.shipping?.postalCode && (
            <p className="text-sm text-destructive mt-1">
              {errors.shipping.postalCode.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="state">State/Province *</Label>
          <Input
            {...register('shipping.state')}
            id="state"
            className={errors.shipping?.state ? 'border-destructive' : ''}
          />
          {errors.shipping?.state && (
            <p className="text-sm text-destructive mt-1">
              {errors.shipping.state.message}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="country">Country *</Label>
          <Select {...register('shipping.country')}>
            <SelectTrigger>
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  {country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.shipping?.country && (
            <p className="text-sm text-destructive mt-1">
              {errors.shipping.country.message}
            </p>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
);

const PaymentMethodSelector: React.FC<{
  selectedMethod: string;
  onChange: (method: string) => void;
  availableMethods: PaymentMethod[];
}> = ({ selectedMethod, onChange, availableMethods }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <CreditCard className="h-5 w-5" />
        Payment Method
      </CardTitle>
    </CardHeader>
    <CardContent>
      <RadioGroup value={selectedMethod} onValueChange={onChange}>
        {availableMethods.map((method) => {
          const Icon = method.icon;
          return (
            <div
              key={method.id}
              className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <RadioGroupItem value={method.id} id={method.id} />
              <Icon className="h-5 w-5 text-muted-foreground" />
              <Label htmlFor={method.id} className="flex-1 cursor-pointer">
                {method.name}
              </Label>
              <Badge variant="secondary">
                <Shield className="h-3 w-3 mr-1" />
                Secure
              </Badge>
            </div>
          );
        })}
      </RadioGroup>
    </CardContent>
  </Card>
);

const OrderSummary: React.FC<{
  items: CartItem[];
  currency: string;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  shippingOption?: ShippingOption;
}> = ({ items, currency, subtotal, shipping, tax, total, shippingOption }) => {
  const intl = useIntl();

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle>Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-medium text-sm">{item.name}</p>
                <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
              </div>
              <FormattedNumber
                value={item.price * item.quantity}
                style="currency"
                currency={currency}
                className="text-sm font-medium"
              />
            </div>
          ))}
        </div>

        <Separator />

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <FormattedNumber
              value={subtotal}
              style="currency"
              currency={currency}
            />
          </div>
          
          <div className="flex justify-between items-center">
            <div>
              <span>Shipping</span>
              {shippingOption && (
                <p className="text-xs text-muted-foreground">
                  {shippingOption.name} ({shippingOption.estimatedDays} days)
                </p>
              )}
            </div>
            <FormattedNumber
              value={shipping}
              style="currency"
              currency={currency}
            />
          </div>

          <div className="flex justify-between">
            <span>Tax</span>
            <FormattedNumber
              value={tax}
              style="currency"
              currency={currency}
            />
          </div>
        </div>

        <Separator />

        <div className="flex justify-between text-lg font-semibold">
          <span>Total</span>
          <FormattedNumber
            value={total}
            style="currency"
            currency={currency}
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4" />
          <span>Secure checkout with 256-bit SSL encryption</span>
        </div>
      </CardContent>
    </Card>
  );
};

// Main Component
export const UniversalCheckout: React.FC<UniversalCheckoutProps> = ({
  cartItems,
  onOrderComplete,
  onBack,
  locale = 'en-US',
  currency: initialCurrency = 'USD',
  region = 'US',
  abTestVariant = 'control',
  className,
}) => {
  const intl = useIntl();
  const { location, loading: locationLoading } = useGeolocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [currency, setCurrency] = useState(initialCurrency);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shippingOptions] = useState<ShippingOption[]>([
    {
      id: 'standard',
      name: 'Standard Shipping',
      price: 5.99,
      estimatedDays: 5,
      currency: 'USD',
    },
    {
      id: 'express',
      name: 'Express Shipping',
      price: 15.99,
      estimatedDays: 2,
      currency: 'USD',
    },
  ]);

  const { convert, loading: conversionLoading } = useCurrencyConverter(
    cartItems[0]?.currency || 'USD',
    currency
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    mode: 'onChange',
  });

  const watchedValues = watch();
  const sameAsBilling = watch('sameAsBilling');

  // Calculate totals
  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + convert(item.price * item.quantity), 0);
  }, [cartItems, convert]);

  const selectedShipping = shippingOptions.find(
    option => option.id === watchedValues.shippingOption
  );
  const shippingCost = selectedShipping ? convert(selectedShipping.price) : 0;
  const tax = subtotal * 0.08; // 8% tax rate
  const total = subtotal + shippingCost + tax;

  // Filter available payment methods based on region and currency
  const availablePaymentMethods = useMemo(() => {
    return PAYMENT_METHODS.filter(
      method =>
        method.enabled &&
        method.regions.includes(region) &&
        method.currencies.includes(currency)
    );
  }, [region, currency]);

  // Auto-fill billing address if same as shipping
  useEffect(() => {
    if (sameAsBilling && watchedValues.shipping) {
      Object.keys(watchedValues.shipping).forEach(key => {
        setValue(`billing.${key}` as any, watchedValues.shipping[key as keyof Address]);
      });
    }
  }, [sameAsBilling, watchedValues.shipping, setValue]);

  const onSubmit = async (data: CheckoutFormData) => {
    setIsProcessing(true);
    setError(null);

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const order: Order = {
        id: `order_${Date.now()}`,
        items: cartItems,
        shipping: data.shipping,
        billing: sameAsBilling ? data.shipping : data.billing,
        paymentMethod: data.paymentMethod,
        shippingOption: data.shippingOption,
        subtotal,
        shipping: shippingCost,
        tax,
        total,
        currency,
      };

      onOrderComplete(order);
    } catch (err) {
      setError('Payment processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const nextStep = () => {
    if (currentStep < CHECKOUT_STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (locationLoading) {
    return (
      <div className={`max-w-6xl mx-auto p-6 ${className}`}>
        <LoadingSpinner message="Detecting your location..." />
      </div>
    );
  }

  return (
    <div className={`max-w-6xl mx-auto p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="ghost" onClick={onBack} size="sm">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <div>
            <h1 className="text-3xl font-bold">Checkout</h1>
            <p className="text-muted-foreground">
              Complete your purchase securely
            </p>
          </div>