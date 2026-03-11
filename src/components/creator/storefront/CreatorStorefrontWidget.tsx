'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ShoppingCart, 
  Star, 
  Users, 
  Clock, 
  Download,
  Play,
  BookOpen,
  CreditCard,
  Check,
  X,
  Settings,
  Eye,
  Code,
  Palette,
  Package,
  TrendingUp,
  Filter,
  Search,
  Heart,
  Share2
} from 'lucide-react';

// Types and Interfaces
interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: 'course' | 'digital-product' | 'service' | 'template';
  image: string;
  tags: string[];
  rating: number;
  reviewCount: number;
  studentsCount?: number;
  duration?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  features: string[];
  isOnSale: boolean;
  inventory: number;
  isDigital: boolean;
  previewUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface CartItem extends Product {
  quantity: number;
}

interface BrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  borderRadius: string;
  logoUrl?: string;
  companyName: string;
  customCss?: string;
}

interface WidgetConfig {
  creatorId: string;
  layout: 'grid' | 'list' | 'carousel';
  columns: number;
  showFilters: boolean;
  showSearch: boolean;
  showCategories: boolean;
  maxProducts: number;
  enableWishlist: boolean;
  enableShare: boolean;
  checkoutMode: 'modal' | 'redirect';
  analyticsEnabled: boolean;
}

interface CreatorStorefrontWidgetProps {
  creatorId: string;
  config?: Partial<WidgetConfig>;
  branding?: Partial<BrandingConfig>;
  products?: Product[];
  onProductClick?: (product: Product) => void;
  onPurchaseComplete?: (orderDetails: any) => void;
  onAnalyticsEvent?: (event: string, data: any) => void;
  className?: string;
  embedded?: boolean;
}

// Product Grid Component
const ProductGrid: React.FC<{
  products: Product[];
  layout: string;
  columns: number;
  onProductClick: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  branding: BrandingConfig;
  config: WidgetConfig;
}> = ({ products, layout, columns, onProductClick, onAddToCart, branding, config }) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
  };

  return (
    <div className={`grid gap-6 ${gridCols[columns as keyof typeof gridCols]}`}>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onClick={onProductClick}
          onAddToCart={onAddToCart}
          branding={branding}
          config={config}
        />
      ))}
    </div>
  );
};

// Product Card Component
const ProductCard: React.FC<{
  product: Product;
  onClick: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  branding: BrandingConfig;
  config: WidgetConfig;
}> = ({ product, onClick, onAddToCart, branding, config }) => {
  const [isWishlisted, setIsWishlisted] = useState(false);

  const categoryIcons = {
    course: BookOpen,
    'digital-product': Download,
    service: Users,
    template: Package
  };

  const IconComponent = categoryIcons[product.category];

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: product.title,
        text: product.description,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <Card 
      className="group hover:shadow-lg transition-all duration-300 cursor-pointer"
      style={{
        borderRadius: branding.borderRadius,
        borderColor: branding.primaryColor + '20'
      }}
    >
      <div className="relative overflow-hidden rounded-t-lg">
        <img
          src={product.image}
          alt={product.title}
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
          onClick={() => onClick(product)}
        />
        
        {product.isOnSale && (
          <Badge className="absolute top-2 left-2" style={{ backgroundColor: branding.secondaryColor }}>
            Sale
          </Badge>
        )}

        <div className="absolute top-2 right-2 flex gap-2">
          {config.enableWishlist && (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 w-8 p-0 bg-white/80 backdrop-blur-sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsWishlisted(!isWishlisted);
              }}
            >
              <Heart className={`h-4 w-4 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
              <span className="sr-only">Add to wishlist</span>
            </Button>
          )}
          
          {config.enableShare && (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 w-8 p-0 bg-white/80 backdrop-blur-sm"
              onClick={(e) => {
                e.stopPropagation();
                handleShare();
              }}
            >
              <Share2 className="h-4 w-4" />
              <span className="sr-only">Share product</span>
            </Button>
          )}
        </div>

        {product.inventory <= 5 && product.inventory > 0 && (
          <Badge variant="destructive" className="absolute bottom-2 left-2">
            Only {product.inventory} left
          </Badge>
        )}
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <IconComponent className="h-4 w-4" />
            <span className="capitalize">{product.category.replace('-', ' ')}</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium">{product.rating}</span>
            <span className="text-xs text-muted-foreground">({product.reviewCount})</span>
          </div>
        </div>

        <CardTitle 
          className="line-clamp-2 group-hover:text-opacity-80 transition-colors cursor-pointer"
          style={{ color: branding.textColor }}
          onClick={() => onClick(product)}
        >
          {product.title}
        </CardTitle>

        <p className="text-sm text-muted-foreground line-clamp-2">
          {product.description}
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-1 mb-3">
          {product.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        {product.category === 'course' && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
            {product.studentsCount && (
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{product.studentsCount} students</span>
              </div>
            )}
            {product.duration && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{product.duration}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span 
              className="text-2xl font-bold"
              style={{ color: branding.primaryColor }}
            >
              ${product.price}
            </span>
            {product.originalPrice && (
              <span className="text-sm text-muted-foreground line-through">
                ${product.originalPrice}
              </span>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <div className="flex gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onClick(product)}
            className="flex-1"
          >
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Button>
          <Button
            size="sm"
            onClick={() => onAddToCart(product)}
            disabled={product.inventory === 0}
            style={{ backgroundColor: branding.primaryColor }}
            className="flex-1 text-white hover:opacity-90"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            {product.inventory === 0 ? 'Sold Out' : 'Add to Cart'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

// Checkout Flow Component
const CheckoutFlow: React.FC<{
  cart: CartItem[];
  onClose: () => void;
  onComplete: (orderDetails: any) => void;
  branding: BrandingConfig;
}> = ({ cart, onClose, onComplete, branding }) => {
  const [step, setStep] = useState(1);
  const [customerInfo, setCustomerInfo] = useState({
    email: '',
    firstName: '',
    lastName: ''
  });

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const steps = ['Cart', 'Information', 'Payment'];

  const handleComplete = () => {
    const orderDetails = {
      id: `order_${Date.now()}`,
      items: cart,
      customer: customerInfo,
      total,
      status: 'completed',
      createdAt: new Date().toISOString()
    };
    onComplete(orderDetails);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        {steps.map((stepName, index) => (
          <div key={stepName} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                index + 1 <= step
                  ? 'text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
              style={{
                backgroundColor: index + 1 <= step ? branding.primaryColor : undefined
              }}
            >
              {index + 1 <= step ? <Check className="h-4 w-4" /> : index + 1}
            </div>
            <span className="ml-2 text-sm font-medium">{stepName}</span>
            {index < steps.length - 1 && (
              <div className="w-12 h-px bg-gray-200 mx-4" />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {step === 1 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Your Cart</h3>
          <div className="space-y-4">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <img src={item.image} alt={item.title} className="w-16 h-16 object-cover rounded" />
                <div className="flex-1">
                  <h4 className="font-medium">{item.title}</h4>
                  <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${item.price * item.quantity}</p>
                </div>
              </div>
            ))}
          </div>
          <Separator className="my-4" />
          <div className="flex justify-between items-center text-lg font-semibold">
            <span>Total:</span>
            <span style={{ color: branding.primaryColor }}>${total}</span>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Customer Information</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={customerInfo.email}
                onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Enter your email"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={customerInfo.firstName}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="First name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={customerInfo.lastName}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Last name"
                  required
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Payment</h3>
          <div className="p-6 bg-gray-50 rounded-lg text-center">
            <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 mb-4">
              Payment processing integration would be implemented here using Stripe or similar service.
            </p>
            <Button
              onClick={handleComplete}
              style={{ backgroundColor: branding.primaryColor }}
              className="text-white"
            >
              Complete Purchase (${total})
            </Button>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          onClick={step === 1 ? onClose : () => setStep(step - 1)}
        >
          {step === 1 ? 'Close' : 'Back'}
        </Button>
        {step < 3 && (
          <Button
            onClick={() => setStep(step + 1)}
            style={{ backgroundColor: branding.primaryColor }}
            className="text-white"
          >
            Continue
          </Button>
        )}
      </div>
    </div>
  );
};

// Main Widget Component
const CreatorStorefrontWidget: React.FC<CreatorStorefrontWidgetProps> = ({
  creatorId,
  config = {},
  branding = {},
  products = [],
  onProductClick,
  onPurchaseComplete,
  onAnalyticsEvent,
  className = '',
  embedded = false
}) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentView, setCurrentView] = useState<'storefront' | 'admin'>('storefront');

  // Default configurations
  const defaultConfig: WidgetConfig = {
    creatorId,
    layout: 'grid',
    columns: 3,
    showFilters: true,
    showSearch: true,
    showCategories: true,
    maxProducts: 20,
    enableWishlist: true,
    enableShare: true,
    checkoutMode: 'modal',
    analyticsEnabled: true,
    ...config
  };

  const defaultBranding: BrandingConfig = {
    primaryColor: '#3b82f6',
    secondaryColor: '#f59e0b',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    fontFamily: 'system-ui',
    borderRadius: '0.5rem',
    companyName: 'Creator Store',
    ...branding
  };

  // Sample products if none provided
  const sampleProducts: Product[] = products.length > 0 ? products : [
    {
      id: '1',
      title: 'Complete Web Development Course',
      description: 'Learn modern web development from scratch with React, Node.js, and more.',
      price: 199,
      originalPrice: 299,
      category: 'course',
      image: '/api/placeholder/400/240',
      tags: ['web development', 'react', 'nodejs'],
      rating: 4.8,
      reviewCount: 234,
      studentsCount: 1250,
      duration: '12 hours',
      difficulty: 'intermediate',
      features: ['Lifetime access', 'Certificate', 'Mobile friendly'],
      isOnSale: true,
      inventory: 100,
      isDigital: true,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-15'
    },
    {
      id: '2',
      title: 'UI/UX Design Templates Pack',
      description: 'Professional design templates for web and mobile applications.',
      price: 49,
      category: 'digital-product',
      image: '/api/placeholder/400/240',
      tags: ['design', 'templates', 'ui/ux'],
      rating: 4.9,
      reviewCount: 89,
      features: ['50+ templates', 'Figma files', 'Commercial license'],
      isOnSale: false,
      inventory: 500,
      isDigital: true,
      createdAt: '2024-01-10',
      updatedAt: '2024-01-20'
    },
    {
      id: '3',
      title: 'Personal Brand Consultation',
      description: '1-on-1 consultation to build and enhance your personal brand.',
      price: 150,
      category: 'service',
      image: '/api/placeholder/400/240',
      tags: ['consulting', 'branding', 'marketing'],
      rating: 5.0,
      reviewCount: 12,
      duration: '60 minutes',
      features: ['Video call', 'Action plan', 'Follow-up email'],
      isOnSale: false,
      inventory: 10,
      isDigital: false,
      createdAt: '2024-01-05',
      updatedAt: '2024-01-25'
    }
  ];

  // Filter products based on search and category
  const filteredProducts = useMemo(() => {
    let filtered = sampleProducts;

    if (searchQuery) {
      filtered = filtered.filter(product =>
        product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    return filtered.slice(0, defaultConfig.maxProducts);
  }, [sampleProducts, searchQuery, selectedCategory, defaultConfig.maxProducts]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(sampleProducts.map(p => p.category)));
    return [{ value: 'all', label: 'All Categories' }, ...cats.map(cat => ({
      value: cat,
      label: cat.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
    }))];
  }, [sampleProducts]);

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    onProductClick?.(product);
    onAnalyticsEvent?.('product_view', { productId: product.id });
  };

  const handleAddToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    
    onAnalyticsEvent?.('add_to_cart', { productId: product.id });
  };

  const handleCheck