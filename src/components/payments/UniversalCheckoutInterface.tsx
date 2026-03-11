```tsx
import React, { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card'
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  CreditCard, 
  Shield, 
  Globe, 
  Lock, 
  CheckCircle, 
  AlertTriangle,
  Loader2,
  MapPin,
  Calculator,
  Languages
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Types
interface PaymentMethod {
  id: string
  name: string
  type: 'card' | 'bank' | 'wallet' | 'crypto' | 'local'
  icon: React.ComponentType<{ className?: string }>
  currencies: string[]
  countries: string[]
  fees?: {
    fixed: number
    percentage: number
  }
  processingTime: string
  requirements?: string[]
}

interface Country {
  code: string
  name: string
  currency: string
  taxRate: number
  requiredFields: string[]
  addressFormat: string[]
  postalCodeRegex: string
  phoneFormat: string
}

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  taxable: boolean
  category: string
}

interface LocaleConfig {
  language: string
  country: string
  currency: string
  numberFormat: Intl.NumberFormatOptions
  dateFormat: Intl.DateTimeFormatOptions
  rtl: boolean
}

interface UniversalCheckoutInterfaceProps {
  cartItems: CartItem[]
  locale?: LocaleConfig
  onPaymentComplete?: (result: PaymentResult) => void
  onError?: (error: Error) => void
  className?: string
  testMode?: boolean
  complianceMode?: 'strict' | 'standard' | 'relaxed'
  theme?: 'light' | 'dark' | 'auto'
}

interface PaymentResult {
  transactionId: string
  amount: number
  currency: string
  method: string
  status: 'success' | 'pending' | 'failed'
  timestamp: Date
}

// Mock data - in real implementation, fetch from APIs
const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'visa',
    name: 'Visa',
    type: 'card',
    icon: CreditCard,
    currencies: ['USD', 'EUR', 'GBP', 'JPY'],
    countries: ['US', 'GB', 'DE', 'FR', 'JP'],
    fees: { fixed: 0, percentage: 2.9 },
    processingTime: 'instant'
  },
  {
    id: 'paypal',
    name: 'PayPal',
    type: 'wallet',
    icon: Globe,
    currencies: ['USD', 'EUR', 'GBP'],
    countries: ['US', 'GB', 'DE', 'FR'],
    fees: { fixed: 0.30, percentage: 3.49 },
    processingTime: 'instant'
  },
  {
    id: 'sepa',
    name: 'SEPA Direct Debit',
    type: 'bank',
    icon: MapPin,
    currencies: ['EUR'],
    countries: ['DE', 'FR', 'IT', 'ES'],
    fees: { fixed: 0.35, percentage: 0 },
    processingTime: '1-3 days'
  }
]

const COUNTRIES: Record<string, Country> = {
  US: {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    taxRate: 0.08,
    requiredFields: ['firstName', 'lastName', 'address1', 'city', 'state', 'zipCode'],
    addressFormat: ['address1', 'address2', 'city', 'state', 'zipCode'],
    postalCodeRegex: '^\\d{5}(-\\d{4})?$',
    phoneFormat: '+1 (XXX) XXX-XXXX'
  },
  GB: {
    code: 'GB',
    name: 'United Kingdom',
    currency: 'GBP',
    taxRate: 0.20,
    requiredFields: ['firstName', 'lastName', 'address1', 'city', 'postCode'],
    addressFormat: ['address1', 'address2', 'city', 'postCode'],
    postalCodeRegex: '^[A-Z]{1,2}\\d[A-Z\\d]? ?\\d[A-Z]{2}$',
    phoneFormat: '+44 XXXX XXX XXX'
  },
  DE: {
    code: 'DE',
    name: 'Germany',
    currency: 'EUR',
    taxRate: 0.19,
    requiredFields: ['firstName', 'lastName', 'address1', 'city', 'zipCode'],
    addressFormat: ['address1', 'address2', 'zipCode', 'city'],
    postalCodeRegex: '^\\d{5}$',
    phoneFormat: '+49 XXX XXXXXXX'
  }
}

// Schema factory based on locale
const createCheckoutSchema = (country: Country, locale: LocaleConfig) => {
  const baseSchema = z.object({
    email: z.string().email('Invalid email format'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    address1: z.string().min(1, 'Address is required'),
    address2: z.string().optional(),
    city: z.string().min(1, 'City is required'),
    phone: z.string().min(1, 'Phone number is required'),
    acceptTerms: z.boolean().refine(val => val === true, 'You must accept the terms'),
    acceptPrivacy: z.boolean().refine(val => val === true, 'You must accept the privacy policy'),
    marketingOptIn: z.boolean().optional()
  })

  // Add country-specific fields
  const countrySpecificFields: Record<string, z.ZodTypeAny> = {}

  if (country.code === 'US') {
    countrySpecificFields.state = z.string().min(1, 'State is required')
    countrySpecificFields.zipCode = z.string().regex(
      new RegExp(country.postalCodeRegex),
      'Invalid ZIP code format'
    )
  } else if (country.code === 'GB') {
    countrySpecificFields.postCode = z.string().regex(
      new RegExp(country.postalCodeRegex),
      'Invalid postcode format'
    )
  } else if (country.code === 'DE') {
    countrySpecificFields.zipCode = z.string().regex(
      new RegExp(country.postalCodeRegex),
      'Invalid postal code format'
    )
  }

  return baseSchema.extend(countrySpecificFields)
}

const UniversalCheckoutInterface: React.FC<UniversalCheckoutInterfaceProps> = ({
  cartItems,
  locale = {
    language: 'en',
    country: 'US',
    currency: 'USD',
    numberFormat: { style: 'currency', currency: 'USD' },
    dateFormat: { year: 'numeric', month: 'long', day: 'numeric' },
    rtl: false
  },
  onPaymentComplete,
  onError,
  className,
  testMode = false,
  complianceMode = 'standard',
  theme = 'auto'
}) => {
  // State
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [geoLocation, setGeoLocation] = useState<string>(locale.country)
  const [detectedCurrency, setDetectedCurrency] = useState<string>(locale.currency)
  const [taxAmount, setTaxAmount] = useState<number>(0)
  const [totalAmount, setTotalAmount] = useState<number>(0)
  const [complianceChecks, setComplianceChecks] = useState<Record<string, boolean>>({})

  // Get current country config
  const currentCountry = useMemo(() => 
    COUNTRIES[geoLocation] || COUNTRIES.US, 
    [geoLocation]
  )

  // Create form schema based on current country
  const formSchema = useMemo(() => 
    createCheckoutSchema(currentCountry, locale),
    [currentCountry, locale]
  )

  // Form setup
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      address1: '',
      address2: '',
      city: '',
      phone: '',
      acceptTerms: false,
      acceptPrivacy: false,
      marketingOptIn: false
    }
  })

  // Filter payment methods based on location and currency
  const availablePaymentMethods = useMemo(() => {
    return PAYMENT_METHODS.filter(method => 
      method.countries.includes(geoLocation) && 
      method.currencies.includes(detectedCurrency)
    )
  }, [geoLocation, detectedCurrency])

  // Calculate totals
  useEffect(() => {
    const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const taxableAmount = cartItems
      .filter(item => item.taxable)
      .reduce((sum, item) => sum + (item.price * item.quantity), 0)
    
    const tax = taxableAmount * currentCountry.taxRate
    const total = subtotal + tax

    setTaxAmount(tax)
    setTotalAmount(total)
  }, [cartItems, currentCountry.taxRate])

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale.language, {
      ...locale.numberFormat,
      currency: detectedCurrency
    }).format(amount)
  }

  // Geolocation detection
  useEffect(() => {
    const detectLocation = async () => {
      try {
        // In real implementation, use IP geolocation service
        const response = await fetch('/api/geolocation')
        const data = await response.json()
        setGeoLocation(data.country)
        setDetectedCurrency(COUNTRIES[data.country]?.currency || 'USD')
      } catch (error) {
        console.warn('Geolocation detection failed, using default')
      }
    }

    detectLocation()
  }, [])

  // Compliance checks
  useEffect(() => {
    const runComplianceChecks = async () => {
      const checks: Record<string, boolean> = {
        gdpr: currentCountry.code === 'GB' || currentCountry.code === 'DE',
        pci: true, // Always required for payments
        localTax: currentCountry.taxRate > 0,
        dataRetention: complianceMode === 'strict',
        cookieConsent: complianceMode !== 'relaxed'
      }

      setComplianceChecks(checks)
    }

    runComplianceChecks()
  }, [currentCountry, complianceMode])

  // Steps configuration
  const steps = [
    { id: 'contact', title: 'Contact Information', icon: Globe },
    { id: 'payment', title: 'Payment Method', icon: CreditCard },
    { id: 'review', title: 'Review Order', icon: CheckCircle }
  ]

  // Step validation
  const validateStep = async (stepIndex: number): Promise<boolean> => {
    switch (stepIndex) {
      case 0:
        const contactFields = ['email', 'firstName', 'lastName', 'address1', 'city', 'phone']
        const isValid = await form.trigger(contactFields as any)
        return isValid
      case 1:
        return selectedPaymentMethod !== ''
      case 2:
        return form.getValues('acceptTerms') && form.getValues('acceptPrivacy')
      default:
        return true
    }
  }

  // Navigation handlers
  const handleNext = async () => {
    const isStepValid = await validateStep(currentStep)
    if (isStepValid && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Payment submission
  const handlePayment = async (data: z.infer<typeof formSchema>) => {
    setLoading(true)
    
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const result: PaymentResult = {
        transactionId: `tx_${Date.now()}`,
        amount: totalAmount,
        currency: detectedCurrency,
        method: selectedPaymentMethod,
        status: 'success',
        timestamp: new Date()
      }

      onPaymentComplete?.(result)
    } catch (error) {
      onError?.(error as Error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      className={cn(
        "max-w-4xl mx-auto p-6 space-y-6",
        locale.rtl && "rtl",
        className
      )}
      dir={locale.rtl ? 'rtl' : 'ltr'}
    >
      {/* Progress Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Secure Checkout
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                <Globe className="w-3 h-3 mr-1" />
                {currentCountry.name}
              </Badge>
              <Badge variant="outline">
                <Languages className="w-3 h-3 mr-1" />
                {detectedCurrency}
              </Badge>
            </div>
          </div>
          
          <div className="space-y-4">
            <Progress value={(currentStep + 1) / steps.length * 100} />
            <div className="flex justify-between">
              {steps.map((step, index) => (
                <div 
                  key={step.id}
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    index <= currentStep ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <step.icon className="w-4 h-4" />
                  {step.title}
                </div>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handlePayment)} className="space-y-6">
              
              {/* Step 1: Contact Information */}
              {currentStep === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address *</FormLabel>
                          <FormControl>
                            <Input 
                              type="email" 
                              placeholder="your@email.com"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="John" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="address1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 1 *</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main Street" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 2</FormLabel>
                          <FormControl>
                            <Input placeholder="Apartment, suite, etc." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City *</FormLabel>
                            <FormControl>
                              <Input placeholder="New York" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Dynamic postal code field based on country */}
                      {currentCountry.code === 'US' && (
                        <>
                          <FormField
                            control={form.control}
                            name="state"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>State *</FormLabel>
                                <FormControl>
                                  <Input placeholder="NY" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="zipCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>ZIP Code *</FormLabel>
                                <FormControl>
                                  <Input placeholder="10001" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}

                      {currentCountry.code === 'GB' && (
                        <FormField
                          control={form.control}
                          name="postCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Postcode *</FormLabel>
                              <FormControl>
                                <Input placeholder="SW1A 1AA" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {currentCountry.code === 'DE' && (
                        <FormField
                          control={form.control}
                          name="zipCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Postal Code *</FormLabel>
                              <FormControl>
                                <Input placeholder="10115" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder={currentCountry.phoneFormat} 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Step 2: Payment Method */}
              {currentStep === 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Payment Method</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                      <TabsList className="grid w-full grid-cols-3">
                        {availablePaymentMethods.map((method) => (
                          <TabsTrigger 
                            key={method.id} 
                            value={method.id}
                            className="flex items-center gap-2"
                          >
                            <method.icon className="w-4 h-4" />
                            {method.name}
                          </TabsTrigger>
                        ))}
                      </TabsList>

                      {availablePaymentMethods.map((method) => (
                        <TabsContent key={method.id} value={method.id} className="space-y-4">
                          <div className="p-4 border rounded-lg">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h4 className="font-medium">{method.name}</h4>
                                <p className="text-sm text-muted-foreground">
                                  Processing time: {method.processingTime}
                                </p>
                              </div>
                              {