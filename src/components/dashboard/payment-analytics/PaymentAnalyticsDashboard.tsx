"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts"
import {
  CreditCard,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Users,
  Globe,
  RefreshCw,
  Download,
  Filter,
  Search,
  Eye,
  Settings,
  Zap,
  Shield,
  Target,
  Brain
} from "lucide-react"

interface Transaction {
  id: string
  amount: number
  currency: string
  status: "completed" | "pending" | "failed" | "cancelled"
  paymentMethod: "card" | "bank_transfer" | "digital_wallet" | "crypto"
  timestamp: string
  merchantId: string
  customerId: string
  country: string
  riskScore: number
  processingTime: number
}

interface RevenueData {
  date: string
  revenue: number
  transactions: number
  averageValue: number
  growth: number
}

interface PaymentMethodStats {
  method: string
  volume: number
  success_rate: number
  average_value: number
  processing_cost: number
  conversion_rate: number
}

interface GeographicData {
  country: string
  code: string
  volume: number
  revenue: number
  transactions: number
  coordinates: [number, number]
}

interface PredictionData {
  type: "revenue" | "fraud" | "churn" | "optimization"
  title: string
  description: string
  confidence: number
  impact: "high" | "medium" | "low"
  timeframe: string
  recommendation: string
}

interface PaymentAnalyticsDashboardProps {
  className?: string
  refreshInterval?: number
  enableRealTime?: boolean
  onTransactionClick?: (transaction: Transaction) => void
  onExportData?: (type: string) => void
}

const mockTransactions: Transaction[] = [
  {
    id: "tx_001",
    amount: 299.99,
    currency: "USD",
    status: "completed",
    paymentMethod: "card",
    timestamp: new Date().toISOString(),
    merchantId: "merchant_001",
    customerId: "customer_001",
    country: "US",
    riskScore: 0.15,
    processingTime: 1.2
  },
  {
    id: "tx_002",
    amount: 149.50,
    currency: "USD",
    status: "failed",
    paymentMethod: "digital_wallet",
    timestamp: new Date(Date.now() - 300000).toISOString(),
    merchantId: "merchant_002",
    customerId: "customer_002",
    country: "GB",
    riskScore: 0.45,
    processingTime: 2.8
  }
]

const mockRevenueData: RevenueData[] = [
  { date: "2024-01-01", revenue: 12500, transactions: 156, averageValue: 80.13, growth: 12.5 },
  { date: "2024-01-02", revenue: 13200, transactions: 168, averageValue: 78.57, growth: 5.6 },
  { date: "2024-01-03", revenue: 11800, transactions: 142, averageValue: 83.10, growth: -10.6 }
]

const mockPaymentMethods: PaymentMethodStats[] = [
  { method: "Credit Card", volume: 45.2, success_rate: 94.2, average_value: 127.50, processing_cost: 2.9, conversion_rate: 89.1 },
  { method: "Digital Wallet", volume: 28.7, success_rate: 96.8, average_value: 89.30, processing_cost: 1.5, conversion_rate: 92.4 },
  { method: "Bank Transfer", volume: 18.1, success_rate: 91.5, average_value: 234.80, processing_cost: 0.8, conversion_rate: 76.3 },
  { method: "Cryptocurrency", volume: 8.0, success_rate: 88.9, average_value: 456.20, processing_cost: 3.5, conversion_rate: 68.7 }
]

const mockPredictions: PredictionData[] = [
  {
    type: "revenue",
    title: "Revenue Growth Forecast",
    description: "Projected 18% increase in monthly revenue based on current trends",
    confidence: 87,
    impact: "high",
    timeframe: "Next 30 days",
    recommendation: "Increase payment processing capacity by 25%"
  },
  {
    type: "fraud",
    title: "Fraud Risk Alert",
    description: "Elevated fraud risk detected in EU region transactions",
    confidence: 92,
    impact: "medium",
    timeframe: "Next 7 days",
    recommendation: "Enable additional verification for EU transactions"
  }
]

export function PaymentAnalyticsDashboard({
  className = "",
  refreshInterval = 30000,
  enableRealTime = true,
  onTransactionClick,
  onExportData
}: PaymentAnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState("overview")
  const [timeRange, setTimeRange] = useState("24h")
  const [isRealTime, setIsRealTime] = useState(enableRealTime)
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions)
  const [revenueData, setRevenueData] = useState<RevenueData[]>(mockRevenueData)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("all")

  const refreshData = useCallback(async () => {
    // Simulate API call
    setLastUpdate(new Date())
    // In real implementation, fetch data from Supabase or payment processor
  }, [])

  useEffect(() => {
    if (!isRealTime) return

    const interval = setInterval(refreshData, refreshInterval)
    return () => clearInterval(interval)
  }, [isRealTime, refreshInterval, refreshData])

  const totalRevenue = revenueData.reduce((sum, day) => sum + day.revenue, 0)
  const totalTransactions = revenueData.reduce((sum, day) => sum + day.transactions, 0)
  const averageOrderValue = totalRevenue / totalTransactions
  const successRate = (transactions.filter(t => t.status === "completed").length / transactions.length) * 100

  const MetricsGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            <span className="text-green-600 flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" />
              +12.5% from last period
            </span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Transactions</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalTransactions.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            <span className="text-green-600 flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" />
              +8.2% from last period
            </span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${averageOrderValue.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">
            <span className="text-red-600 flex items-center">
              <TrendingDown className="h-3 w-3 mr-1" />
              -2.1% from last period
            </span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
          <Progress value={successRate} className="mt-2" />
        </CardContent>
      </Card>
    </div>
  )

  const TransactionMonitor = () => (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Zap className="h-5 w-5 mr-2" />
              Real-time Transaction Monitor
            </CardTitle>
            <CardDescription>
              Live transaction feed with status indicators
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="realtime">Real-time</Label>
            <Switch
              id="realtime"
              checked={isRealTime}
              onCheckedChange={setIsRealTime}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.slice(0, 5).map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onTransactionClick?.(transaction)}
            >
              <div className="flex items-center space-x-4">
                <div className="relative">
                  {transaction.status === "completed" && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {transaction.status === "pending" && (
                    <Clock className="h-5 w-5 text-yellow-500" />
                  )}
                  {transaction.status === "failed" && (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
                <div>
                  <div className="font-medium">{transaction.id}</div>
                  <div className="text-sm text-muted-foreground">
                    {transaction.paymentMethod} • {transaction.country}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold">
                  ${transaction.amount.toFixed(2)} {transaction.currency}
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(transaction.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  const RevenueTracker = () => (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          Revenue Analytics
        </CardTitle>
        <CardDescription>Revenue trends and forecasting</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#8884d8"
                fill="#8884d8"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )

  const PaymentMethodOptimizer = () => (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center">
          <CreditCard className="h-5 w-5 mr-2" />
          Payment Method Performance
        </CardTitle>
        <CardDescription>Optimization insights and recommendations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {mockPaymentMethods.map((method, index) => (
            <div key={method.method} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium">{method.method}</div>
                <Badge variant={method.success_rate > 90 ? "default" : "secondary"}>
                  {method.success_rate}% success
                </Badge>
              </div>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Volume</div>
                  <div className="font-medium">{method.volume}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Avg. Value</div>
                  <div className="font-medium">${method.average_value}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Cost</div>
                  <div className="font-medium">{method.processing_cost}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Conversion</div>
                  <div className="font-medium">{method.conversion_rate}%</div>
                </div>
              </div>
              <Progress value={method.success_rate} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  const PredictiveInsights = () => (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Brain className="h-5 w-5 mr-2" />
          AI Predictive Insights
        </CardTitle>
        <CardDescription>Machine learning powered predictions and recommendations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockPredictions.map((prediction, index) => (
            <Alert key={index} className={`border-l-4 ${
              prediction.impact === "high" ? "border-l-red-500" :
              prediction.impact === "medium" ? "border-l-yellow-500" :
              "border-l-green-500"
            }`}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                {prediction.title}
                <Badge variant="outline" className="ml-2">
                  {prediction.confidence}% confidence
                </Badge>
              </AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                <p>{prediction.description}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{prediction.timeframe}</span>
                  <Badge variant={
                    prediction.impact === "high" ? "destructive" :
                    prediction.impact === "medium" ? "default" :
                    "secondary"
                  }>
                    {prediction.impact} impact
                  </Badge>
                </div>
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  <strong>Recommendation:</strong> {prediction.recommendation}
                </div>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  const AlertsPanel = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Shield className="h-5 w-5 mr-2" />
          System Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-2">
            <Alert className="border-l-4 border-l-yellow-500">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>High Transaction Volume</AlertTitle>
              <AlertDescription>
                Transaction volume 40% above normal. Consider scaling payment infrastructure.
              </AlertDescription>
            </Alert>
            <Alert className="border-l-4 border-l-red-500">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Fraud Detection</AlertTitle>
              <AlertDescription>
                Suspicious activity detected in region EU-WEST. Review flagged transactions.
              </AlertDescription>
            </Alert>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )

  const TransactionTable = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Detailed transaction records and analytics</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => onExportData?.("transactions")}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                <SelectItem value="card">Credit Card</SelectItem>
                <SelectItem value="digital_wallet">Digital Wallet</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="crypto">Cryptocurrency</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center space-x-2 mt-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions
            .filter(t => 
              selectedPaymentMethod === "all" || t.paymentMethod === selectedPaymentMethod
            )
            .filter(t => 
              !searchTerm || 
              t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
              t.customerId.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-3 h-3 rounded-full ${
                    transaction.status === "completed" ? "bg-green-500" :
                    transaction.status === "pending" ? "bg-yellow-500" :
                    "bg-red-500"
                  }`} />
                  <div>
                    <div className="font-medium">{transaction.id}</div>
                    <div className="text-sm text-muted-foreground">
                      {transaction.customerId} • {transaction.paymentMethod}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">
                    ${transaction.amount.toFixed(2)} {transaction.currency}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(transaction.timestamp).toLocaleDateString()}
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive payment monitoring and optimization dashboard
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div