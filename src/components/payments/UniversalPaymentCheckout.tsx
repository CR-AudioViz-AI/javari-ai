```tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  CreditCard, 
  Smartphone, 
  Wallet, 
  Shield, 
  Lock, 
  Check, 
  AlertCircle,
  Loader2,
  Star,
  Globe,
  Receipt,
  Trash2
} from 'lucide-react';

interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal' | 'apple_pay' | 'google_pay';
  name: string;
  icon: React.ReactNode;
  isDefault?: boolean;
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  token?: string;
}

interface Currency {
  code: string;
  symbol: string;
  name: string;
  rate: number;
}

interface PaymentItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  quantity: number;
}

interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface PaymentData {
  amount: number;
  currency: string;
  items: PaymentItem[];
  tax?: number;
  shipping?: number;
  discount?: number;
  billingAddress?: Address;
  shippingAddress?: Address;
}

interface UniversalPaymentCheckoutProps {
  /** Payment configuration */
  paymentData: PaymentData;
  /** Available currencies with conversion rates */
  currencies: Currency[];
  /** User's saved payment methods */
  savedPaymentMethods?: PaymentMethod[];
  /** Supported payment methods */
  supportedMethods: PaymentMethod['type'][];
  /** Locale for localization */
  locale?: string;
  /** Enable one-click payments */
  enableOneClick?: boolean;
  /** Enable saving payment methods */
  enableSavePayment?: boolean;
  /** PCI compliance mode */
  pciCompliant?: boolean;
  /** Merchant configuration */
  merchantConfig: {
    name: string;
    logo?: string;
    supportEmail?: string;
    termsUrl?: string;
    privacyUrl?: string;
  };
  /** Event handlers */
  onPaymentSuccess?: (result: any) => void;
  onPaymentError?: (error: Error) => void;
  onCurrencyChange?: (currency: string) => void;
  onSavePaymentMethod?: (method: PaymentMethod) => void;
  onDeletePaymentMethod?: (methodId: string) => void;
  /** Styling */
  className?: string;
}

const AVAILABLE_PAYMENT_METHODS: Record<PaymentMethod['type'], Omit<PaymentMethod, 'id' | 'token'>> = {
  card: {
    type: 'card',
    name: 'Credit/Debit Card',
    icon: <CreditCard className="h-4 w-4" />
  },
  paypal: {
    type: 'paypal',
    name: 'PayPal',
    icon: <Wallet className="h-4 w-4" />
  },
  apple_pay: {
    type: 'apple_pay',
    name: 'Apple Pay',
    icon: <Smartphone className="h-4 w-4" />
  },
  google_pay: {
    type: 'google_pay',
    name: 'Google Pay',
    icon: <Smartphone className="h-4 w-4" />
  }
};

export const UniversalPaymentCheckout: React.FC<UniversalPaymentCheckoutProps> = ({
  paymentData,
  currencies,
  savedPaymentMethods = [],
  supportedMethods,
  locale = 'en-US',
  enableOneClick = true,
  enableSavePayment = true,
  pciCompliant = true,
  merchantConfig,
  onPaymentSuccess,
  onPaymentError,
  onCurrencyChange,
  onSavePaymentMethod,
  onDeletePaymentMethod,
  className = ''
}) => {
  // State management
  const [selectedCurrency, setSelectedCurrency] = useState(paymentData.currency);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string>('');
  const [savePaymentMethod, setSavePaymentMethod] = useState(false);
  const [useShippingAsBilling, setUseShippingAsBilling] = useState(true);
  
  // Form data
  const [cardData, setCardData] = useState({
    number: '',
    expiry: '',
    cvv: '',
    name: ''
  });
  
  const [billingAddress, setBillingAddress] = useState<Address>({
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: ''
  });

  const [shippingAddress, setShippingAddress] = useState<Address>({
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: ''
  });

  // Currency conversion
  const currentCurrency = useMemo(() => 
    currencies.find(c => c.code === selectedCurrency) || currencies[0],
    [currencies, selectedCurrency]
  );

  const convertedAmount = useMemo(() => {
    if (!currentCurrency) return paymentData.amount;
    return paymentData.amount * currentCurrency.rate;
  }, [paymentData.amount, currentCurrency]);

  const totalAmount = useMemo(() => {
    let total = convertedAmount;
    if (paymentData.tax) total += paymentData.tax * currentCurrency.rate;
    if (paymentData.shipping) total += paymentData.shipping * currentCurrency.rate;
    if (paymentData.discount) total -= paymentData.discount * currentCurrency.rate;
    return total;
  }, [convertedAmount, paymentData.tax, paymentData.shipping, paymentData.discount, currentCurrency]);

  // Available payment methods
  const availablePaymentMethods = useMemo(() => 
    supportedMethods.map(type => ({
      ...AVAILABLE_PAYMENT_METHODS[type],
      id: type
    })),
    [supportedMethods]
  );

  // Handle currency change
  const handleCurrencyChange = useCallback((currency: string) => {
    setSelectedCurrency(currency);
    onCurrencyChange?.(currency);
  }, [onCurrencyChange]);

  // Handle payment method selection
  const handlePaymentMethodSelect = useCallback((methodId: string) => {
    setSelectedPaymentMethod(methodId);
    setPaymentError('');
  }, []);

  // Validate card data
  const validateCardData = useCallback(() => {
    if (!cardData.number || cardData.number.length < 16) {
      return 'Please enter a valid card number';
    }
    if (!cardData.expiry || !cardData.expiry.match(/^\d{2}\/\d{2}$/)) {
      return 'Please enter a valid expiry date (MM/YY)';
    }
    if (!cardData.cvv || cardData.cvv.length < 3) {
      return 'Please enter a valid CVV';
    }
    if (!cardData.name.trim()) {
      return 'Please enter the cardholder name';
    }
    return null;
  }, [cardData]);

  // Validate address
  const validateAddress = useCallback((address: Address) => {
    if (!address.line1.trim()) return 'Address line 1 is required';
    if (!address.city.trim()) return 'City is required';
    if (!address.state.trim()) return 'State is required';
    if (!address.postalCode.trim()) return 'Postal code is required';
    if (!address.country.trim()) return 'Country is required';
    return null;
  }, []);

  // Process payment
  const processPayment = useCallback(async () => {
    setIsProcessing(true);
    setPaymentError('');

    try {
      // Validation
      if (selectedPaymentMethod === 'card') {
        const cardError = validateCardData();
        if (cardError) {
          setPaymentError(cardError);
          setIsProcessing(false);
          return;
        }
      }

      const billingError = validateAddress(billingAddress);
      if (billingError) {
        setPaymentError(`Billing address: ${billingError}`);
        setIsProcessing(false);
        return;
      }

      if (!useShippingAsBilling) {
        const shippingError = validateAddress(shippingAddress);
        if (shippingError) {
          setPaymentError(`Shipping address: ${shippingError}`);
          setIsProcessing(false);
          return;
        }
      }

      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock payment result
      const paymentResult = {
        id: `payment_${Date.now()}`,
        amount: totalAmount,
        currency: selectedCurrency,
        status: 'succeeded',
        method: selectedPaymentMethod,
        timestamp: new Date().toISOString()
      };

      // Save payment method if requested
      if (savePaymentMethod && selectedPaymentMethod === 'card' && onSavePaymentMethod) {
        const newPaymentMethod: PaymentMethod = {
          id: `pm_${Date.now()}`,
          type: 'card',
          name: `**** ${cardData.number.slice(-4)}`,
          icon: <CreditCard className="h-4 w-4" />,
          last4: cardData.number.slice(-4),
          brand: 'visa', // This would come from card number detection
          token: `token_${Date.now()}`
        };
        onSavePaymentMethod(newPaymentMethod);
      }

      onPaymentSuccess?.(paymentResult);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';
      setPaymentError(errorMessage);
      onPaymentError?.(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      setIsProcessing(false);
    }
  }, [
    selectedPaymentMethod,
    validateCardData,
    validateAddress,
    billingAddress,
    shippingAddress,
    useShippingAsBilling,
    totalAmount,
    selectedCurrency,
    savePaymentMethod,
    cardData,
    onSavePaymentMethod,
    onPaymentSuccess,
    onPaymentError
  ]);

  // One-click payment
  const handleOneClickPayment = useCallback(async (method: PaymentMethod) => {
    setIsProcessing(true);
    setPaymentError('');

    try {
      // Simulate one-click payment
      await new Promise(resolve => setTimeout(resolve, 1000));

      const paymentResult = {
        id: `payment_${Date.now()}`,
        amount: totalAmount,
        currency: selectedCurrency,
        status: 'succeeded',
        method: method.type,
        savedMethod: true,
        timestamp: new Date().toISOString()
      };

      onPaymentSuccess?.(paymentResult);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'One-click payment failed';
      setPaymentError(errorMessage);
      onPaymentError?.(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      setIsProcessing(false);
    }
  }, [totalAmount, selectedCurrency, onPaymentSuccess, onPaymentError]);

  // Format currency
  const formatCurrency = useCallback((amount: number, currency: string) => {
    const currencyInfo = currencies.find(c => c.code === currency);
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      currencyDisplay: currencyInfo?.symbol ? 'symbol' : 'code'
    }).format(amount);
  }, [currencies, locale]);

  return (
    <Card className={`w-full max-w-2xl mx-auto ${className}`}>
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {merchantConfig.logo && (
              <img 
                src={merchantConfig.logo} 
                alt={merchantConfig.name}
                className="h-8 w-8 object-contain"
              />
            )}
            Secure Checkout
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              PCI Compliant
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Lock className="h-3 w-3" />
              SSL Secured
            </Badge>
          </div>
        </div>

        {/* Currency Selector */}
        <div className="flex items-center gap-4">
          <Label htmlFor="currency" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Currency
          </Label>
          <Select value={selectedCurrency} onValueChange={handleCurrencyChange}>
            <SelectTrigger id="currency" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencies.map(currency => (
                <SelectItem key={currency.code} value={currency.code}>
                  <div className="flex items-center gap-2">
                    <span>{currency.symbol}</span>
                    <span>{currency.code}</span>
                    <span className="text-muted-foreground">- {currency.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Order Summary */}
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Order Summary
          </h3>
          {paymentData.items.map(item => (
            <div key={item.id} className="flex justify-between">
              <div>
                <div className="font-medium">{item.name}</div>
                {item.description && (
                  <div className="text-sm text-muted-foreground">{item.description}</div>
                )}
                <div className="text-sm text-muted-foreground">Qty: {item.quantity}</div>
              </div>
              <div className="font-medium">
                {formatCurrency(item.price * item.quantity * currentCurrency.rate, selectedCurrency)}
              </div>
            </div>
          ))}
          
          {paymentData.tax && (
            <div className="flex justify-between text-sm">
              <span>Tax</span>
              <span>{formatCurrency(paymentData.tax * currentCurrency.rate, selectedCurrency)}</span>
            </div>
          )}
          
          {paymentData.shipping && (
            <div className="flex justify-between text-sm">
              <span>Shipping</span>
              <span>{formatCurrency(paymentData.shipping * currentCurrency.rate, selectedCurrency)}</span>
            </div>
          )}
          
          {paymentData.discount && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span>
              <span>-{formatCurrency(paymentData.discount * currentCurrency.rate, selectedCurrency)}</span>
            </div>
          )}
          
          <Separator />
          <div className="flex justify-between text-lg font-semibold">
            <span>Total</span>
            <span>{formatCurrency(totalAmount, selectedCurrency)}</span>
          </div>
        </div>

        {/* One-Click Payment (Saved Methods) */}
        {enableOneClick && savedPaymentMethods.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold">Quick Pay</h3>
            <div className="grid gap-3">
              {savedPaymentMethods.map(method => (
                <Button
                  key={method.id}
                  variant="outline"
                  className="flex items-center justify-between p-4 h-auto"
                  onClick={() => handleOneClickPayment(method)}
                  disabled={isProcessing}
                >
                  <div className="flex items-center gap-3">
                    {method.icon}
                    <div className="text-left">
                      <div className="font-medium">{method.name}</div>
                      {method.last4 && (
                        <div className="text-sm text-muted-foreground">
                          •••• {method.last4}
                        </div>
                      )}
                    </div>
                    {method.isDefault && (
                      <Badge variant="secondary">Default</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {formatCurrency(totalAmount, selectedCurrency)}
                    </span>
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </div>
                </Button>
              ))}
            </div>
            <Separator />
          </div>
        )}

        {/* Payment Method Selection */}
        <Tabs value={selectedPaymentMethod} onValueChange={handlePaymentMethodSelect}>
          <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${availablePaymentMethods.length}, 1fr)` }}>
            {availablePaymentMethods.map(method => (
              <TabsTrigger key={method.id} value={method.id} className="flex items-center gap-2">
                {method.icon}
                <span className="hidden sm:inline">{method.name}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Card Payment Form */}
          <TabsContent value="card" className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="card-name">Cardholder Name</Label>
                <Input
                  id="card-name"
                  value={cardData.name}
                  onChange={(e) => setCardData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="John Doe"
                />
              </div>
              
              <div>
                <Label htmlFor="card-number">Card Number</Label>
                <Input
                  id="card-number"
                  value={cardData.number}
                  onChange={(e) => setCardData(prev => ({ ...prev, number: e.target.value.replace(/\D/g, '') }))}
                  placeholder="1234 5678 9012 3456"
                  maxLength={16}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="card-expiry">Expiry Date</Label>
                  <Input
                    id="card-expiry"
                    value={cardData.expiry}
                    onChange={(e) => {
                      let value = e.target.value.replace(/\D/g, '');
                      if (value.length >= 2) {
                        value = value.slice(0, 2) + '/' + value.slice(2, 4);
                      }
                      setCardData(prev => ({ ...prev, expiry: value }));
                    }}
                    placeholder="MM/YY"
                    maxLength={5}
                  />
                </div>
                
                <div>
                  <Label htmlFor="card-cvv">CVV</Label>
                  <Input
                    id="card-cvv"
                    type="password"
                    value={cardData.cvv}
                    onChange={(e) => setCardData(prev => ({ ...prev, cvv: e.target.value.replace(/\D/g, '') }))}
                    placeholder="123"
                    maxLength={4}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* PayPal */}
          <TabsContent value="paypal">
            <div className="text-center py-8">
              <div className="text-lg font-medium mb-2">
                You will be redirected to PayPal to complete your payment
              </div>
              <div className="text-muted-foreground">
                Amount: {formatCurrency(totalAmount, selectedCurrency)}
              </div>
            </div>
          </TabsContent>

          {/* Apple Pay */}
          <TabsContent value="apple_pay">
            <div className="text-center py-8">
              <div className="text-lg font-medium mb-2">
                Use Touch ID or Face ID to pay with Apple Pay
              </div>
              <div className="text-muted-foreground">
                Amount: {formatCurrency(totalAmount, selectedCurrency)}
              </div>
            </div>
          </TabsContent>

          {/* Google Pay */}
          <TabsContent value="google_pay">
            <div className="text-center py-8">
              <div className="text-lg font-medium mb-2">
                Use your fingerprint to pay with Google Pay
              </div>
              <div className="text-muted-foreground">
                Amount: {formatCurrency(totalAmount, selectedCurrency)}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Billing Address */}
        <div className="space-y-4">
          <h3 className="font-semibold">Billing Address</h3>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="billing-line1">Address Line 1</Label>
              <Input
                id="billing