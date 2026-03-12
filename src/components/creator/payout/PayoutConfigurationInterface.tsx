```tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { debounce } from 'lodash';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CreditCard,
  DollarSign,
  Calendar,
  FileText,
  Plus,
  Trash2,
  Edit,
  AlertTriangle,
  CheckCircle,
  Info,
  Settings,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

// Zod schemas
const paymentMethodSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['bank_account', 'debit_card', 'paypal']),
  accountNumber: z.string().min(1, 'Account number is required'),
  routingNumber: z.string().optional(),
  accountHolderName: z.string().min(1, 'Account holder name is required'),
  isDefault: z.boolean().default(false),
});

const taxInfoSchema = z.object({
  taxId: z.string().min(9, 'Valid tax ID required'),
  taxIdType: z.enum(['ssn', 'ein']),
  businessName: z.string().optional(),
  addressLine1: z.string().min(1, 'Address is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(2, 'State is required'),
  zipCode: z.string().min(5, 'Valid zip code required'),
  country: z.string().default('US'),
});

const payoutConfigSchema = z.object({
  schedule: z.enum(['weekly', 'biweekly', 'monthly']),
  minimumThreshold: z.number().min(1, 'Minimum threshold must be at least $1'),
  autoPayoutEnabled: z.boolean().default(true),
  currency: z.string().default('USD'),
  paymentMethodId: z.string().min(1, 'Payment method is required'),
  taxInformation: taxInfoSchema.optional(),
});

// Types
interface PaymentMethod {
  id: string;
  type: 'bank_account' | 'debit_card' | 'paypal';
  accountNumber: string;
  routingNumber?: string;
  accountHolderName: string;
  isDefault: boolean;
  lastFour: string;
  status: 'active' | 'pending' | 'inactive';
}

interface PayoutHistory {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  scheduledDate: string;
  completedDate?: string;
  paymentMethod: string;
  fees: number;
}

interface PayoutConfigurationInterfaceProps {
  creatorId: string;
  currentEarnings?: number;
  onConfigUpdate?: (config: any) => void;
  className?: string;
}

const PayoutScheduleSelector: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled = false }) => {
  const scheduleOptions = [
    { value: 'weekly', label: 'Weekly', description: 'Every Friday' },
    { value: 'biweekly', label: 'Bi-weekly', description: '1st and 15th' },
    { value: 'monthly', label: 'Monthly', description: 'Last day of month' },
  ];

  return (
    <div className="space-y-2">
      <Label htmlFor="payout-schedule">Payout Schedule</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id="payout-schedule">
          <SelectValue placeholder="Select schedule" />
        </SelectTrigger>
        <SelectContent>
          {scheduleOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div>
                <div className="font-medium">{option.label}</div>
                <div className="text-sm text-muted-foreground">
                  {option.description}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const PaymentMethodManager: React.FC<{
  methods: PaymentMethod[];
  selectedMethodId: string;
  onMethodSelect: (id: string) => void;
  onMethodAdd: (method: Omit<PaymentMethod, 'id'>) => void;
  onMethodDelete: (id: string) => void;
  onMethodEdit: (id: string, method: Partial<PaymentMethod>) => void;
}> = ({
  methods,
  selectedMethodId,
  onMethodSelect,
  onMethodAdd,
  onMethodDelete,
  onMethodEdit,
}) => {
  const [isAddingMethod, setIsAddingMethod] = useState(false);
  const [editingMethod, setEditingMethod] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: {
      type: 'bank_account' as const,
      accountNumber: '',
      routingNumber: '',
      accountHolderName: '',
      isDefault: false,
    },
  });

  const handleAddMethod = (data: any) => {
    onMethodAdd({
      ...data,
      lastFour: data.accountNumber.slice(-4),
      status: 'pending' as const,
    });
    setIsAddingMethod(false);
    form.reset();
    toast.success('Payment method added successfully');
  };

  const getMethodIcon = (type: string) => {
    switch (type) {
      case 'bank_account':
        return <CreditCard className="h-4 w-4" />;
      case 'debit_card':
        return <CreditCard className="h-4 w-4" />;
      case 'paypal':
        return <DollarSign className="h-4 w-4" />;
      default:
        return <CreditCard className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'default',
      pending: 'secondary',
      inactive: 'destructive',
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label>Payment Methods</Label>
        <Dialog open={isAddingMethod} onOpenChange={setIsAddingMethod}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Method
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Payment Method</DialogTitle>
              <DialogDescription>
                Add a new payment method for receiving payouts
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleAddMethod)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bank_account">
                            Bank Account
                          </SelectItem>
                          <SelectItem value="debit_card">Debit Card</SelectItem>
                          <SelectItem value="paypal">PayPal</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accountHolderName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Holder Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch('type') === 'bank_account' && (
                  <FormField
                    control={form.control}
                    name="routingNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Routing Number</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddingMethod(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Add Method</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {methods.map((method) => (
          <div
            key={method.id}
            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
              selectedMethodId === method.id
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/50'
            }`}
            onClick={() => onMethodSelect(method.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getMethodIcon(method.type)}
                <div>
                  <div className="font-medium">
                    {method.accountHolderName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ****{method.lastFour} • {method.type.replace('_', ' ')}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusBadge(method.status)}
                <div className="flex space-x-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingMethod(method.id);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMethodDelete(method.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {methods.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No payment methods added yet</p>
        </div>
      )}
    </div>
  );
};

const TaxInformationForm: React.FC<{
  value?: any;
  onChange: (value: any) => void;
  required?: boolean;
}> = ({ value, onChange, required = true }) => {
  const form = useForm({
    resolver: zodResolver(taxInfoSchema),
    defaultValues: value || {
      taxId: '',
      taxIdType: 'ssn',
      businessName: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'US',
    },
  });

  useEffect(() => {
    const subscription = form.watch((data) => {
      onChange(data);
    });
    return () => subscription.unsubscribe();
  }, [form, onChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <FileText className="h-4 w-4" />
        <Label className="text-base font-medium">Tax Information</Label>
        {required && <span className="text-destructive">*</span>}
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Required for payouts over $600</AlertTitle>
        <AlertDescription>
          We're required by law to collect tax information for creators who
          earn over $600 per year.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="taxIdType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tax ID Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="ssn">Social Security Number</SelectItem>
                  <SelectItem value="ein">
                    Employer Identification Number
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="taxId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tax ID</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={
                    form.watch('taxIdType') === 'ssn'
                      ? '123-45-6789'
                      : '12-3456789'
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.watch('taxIdType') === 'ein' && (
          <FormField
            control={form.control}
            name="businessName"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Business Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="addressLine1"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>Address Line 1</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="addressLine2"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>Address Line 2 (Optional)</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="state"
          render={({ field }) => (
            <FormItem>
              <FormLabel>State</FormLabel>
              <FormControl>
                <Input {...field} placeholder="CA" />
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
              <FormLabel>Zip Code</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <FormControl>
                <Input {...field} disabled />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};

const PayoutThresholdSlider: React.FC<{
  value: number;
  onChange: (value: number) => void;
  currentEarnings?: number;
  min?: number;
  max?: number;
}> = ({
  value,
  onChange,
  currentEarnings = 0,
  min = 1,
  max = 1000,
}) => {
  const handleValueChange = (newValue: number[]) => {
    onChange(newValue[0]);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const canPayout = currentEarnings >= value;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label>Minimum Payout Threshold</Label>
        <div className="text-sm text-muted-foreground">
          Current: {formatCurrency(currentEarnings)}
        </div>
      </div>

      <div className="px-2">
        <Slider
          value={[value]}
          onValueChange={handleValueChange}
          max={max}
          min={min}
          step={1}
          className="w-full"
        />
      </div>

      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{formatCurrency(min)}</span>
        <span className="font-medium text-foreground">
          {formatCurrency(value)}
        </span>
        <span>{formatCurrency(max)}</span>
      </div>

      <Alert className={canPayout ? 'border-green-200' : 'border-orange-200'}>
        {canPayout ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-orange-600" />
        )}
        <AlertDescription>
          {canPayout
            ? `You'll receive a payout of ${formatCurrency(currentEarnings)} on your next scheduled date.`
            : `You need ${formatCurrency(value - currentEarnings)} more to reach the minimum threshold.`}
        </AlertDescription>
      </Alert>
    </div>
  );
};

const PayoutPreviewCard: React.FC<{
  config: any;
  currentEarnings: number;
  nextPayoutDate: Date;
  estimatedFees: number;
}> = ({ config, currentEarnings, nextPayoutDate, estimatedFees }) => {
  const netAmount = currentEarnings - estimatedFees;
  const canPayout = currentEarnings >= (config.minimumThreshold || 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Next Payout Preview</CardTitle>
            <CardDescription>
              Based on your current configuration
            </CardDescription>
          </div>
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm text-muted-foreground">
              Available Balance
            </Label>
            <div className="text-2xl font-bold">
              {formatCurrency(currentEarnings)}
            </div>