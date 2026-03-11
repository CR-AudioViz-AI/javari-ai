# Deploy CRAIverse Virtual Economy Microservice

```markdown
# CRAIverse Virtual Economy Microservice

## Purpose
The CRAIverse Virtual Economy Microservice is designed to provide a comprehensive economic simulation service for managing virtual currencies, resource scarcity, market dynamics, and player-driven economies. This microservice supports functionalities such as user wallets, trading, and market transactions.

## Usage
This microservice can be utilized in projects that require a robust backend for virtual economies, enabling features like currency exchange, resource management, and trade transactions among users.

## Parameters/Props
### Currency
- **id**: `string` - Unique identifier for the currency.
- **name**: `string` - Name of the currency.
- **symbol**: `string` - Symbol representing the currency.
- **totalSupply**: `number` - Total amount of the currency available.
- **circulatingSupply**: `number` - Amount of currency currently in circulation.
- **exchangeRate**: `number` - Rate of exchange for this currency.
- **lastUpdated**: `Date` - Timestamp of the last update for the currency.
- **metadata**: `Record<string, any>` - Additional information related to the currency.

### Resource
- **id**: `string` - Unique identifier for the resource.
- **name**: `string` - Name of the resource.
- **type**: `'raw' | 'processed' | 'rare' | 'unique'` - Type classification of the resource.
- **scarcity**: `number` (0-1) - Scarcity rating of the resource.
- **baseValue**: `number` - Base value of the resource.
- **currentValue**: `number` - Current market value of the resource.
- **totalQuantity**: `number` - Total quantity of the resource available.
- **availableQuantity**: `number` - Quantity of the resource that can be traded.
- **renewalRate**: `number` (optional) - Rate at which the resource is renewed.
- **metadata**: `Record<string, any>` - Additional resource-related information.

### Wallet
- **userId**: `string` - Identifier for the user.
- **currencies**: `Record<string, number>` - Balances of various currencies owned by the user.
- **resources**: `Record<string, number>` - Balances of resources owned by the user.
- **tradingPower**: `number` - Indicates the trading capacity of the user.
- **creditScore**: `number` - User's credit score affecting trades.
- **lastActivity**: `Date` - Timestamp of user’s last interaction.

### MarketOrder
- **id**: `string` - Unique identifier for the market order.
- **userId**: `string` - Identifier of the user who created the order.
- **type**: `'buy' | 'sell'` - Type of the market order.
- **itemType**: `'currency' | 'resource'` - Type of item being traded.
- **itemId**: `string` - Identifier of the item.
- **quantity**: `number` - Quantity of the item in the order.
- **pricePerUnit**: `number` - Price for each unit of the item.
- **totalValue**: `number` - Total value of the order.
- **status**: `'pending' | 'partial' | 'completed' | 'cancelled'` - Current status of the order.
- **createdAt**: `Date` - Order creation timestamp.
- **expiresAt**: `Date` (optional) - Expiry timestamp of the order.

### TradeTransaction
- **id**: `string` - Unique identifier for the trade transaction.
- **buyerId**: `string` - Identifier of the buyer.
- **sellerId**: `string` - Identifier of the seller.
- **itemType**: `'currency' | 'resource'` - Type of item involved in the transaction.
- **itemId**: `string` - Identifier of the item traded.
- **quantity**: `number` - Quantity exchanged in the transaction.
- **pricePerUnit**: `number` - Price per unit during the transaction.
- **totalValue**: `number` - Total value of the transaction.
- **fees**: `number` - Fees incurred in the transaction.
- **timestamp**: `Date` - Timestamp of the transaction.
- **blockHash**: `string` (optional) - Hash of the relevant blockchain block.

## Examples

### Create a Currency
```typescript
const newCurrency: Currency = {
    id: "USD",
    name: "US Dollar",
    symbol: "$",
    totalSupply: 1000000,
    circulatingSupply: 500000,
    exchangeRate: