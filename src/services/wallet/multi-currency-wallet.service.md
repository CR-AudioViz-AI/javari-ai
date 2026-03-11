# Build Multi-Currency Wallet Service

# Multi-Currency Wallet Service Documentation

## Purpose
The Multi-Currency Wallet Service enables users to manage multiple currencies within a single wallet account. It provides functionalities for handling wallet balances, currency exchange, transactions, and optimization strategies. This service is designed for both personal and business use cases.

## Usage
To use the Multi-Currency Wallet Service, you need to instantiate the service with a Supabase client, and then utilize its methods to manage wallets, transactions, and balances.

```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import { MultiCurrencyWalletService } from './src/services/wallet/multi-currency-wallet.service';

const supabaseClient = new SupabaseClient('URL', 'ANON_KEY');
const walletService = new MultiCurrencyWalletService(supabaseClient);
```

## Parameters / Props

### Currency
- **code**: `string` - The currency code (e.g., 'USD').
- **name**: `string` - The currency name (e.g., 'United States Dollar').
- **symbol**: `string` - The currency symbol (e.g., '$').
- **decimals**: `number` - Number of decimal places.
- **isActive**: `boolean` - Indicates if the currency is currently active.

### WalletBalance
- **id**: `string` - Unique identifier for the balance.
- **walletId**: `string` - Associated wallet ID.
- **currency**: `string` - Currency type.
- **balance**: `number` - Total balance.
- **lockedBalance**: `number` - Amount locked in transactions.
- **availableBalance**: `number` - Balance available for use.
- **lastUpdated**: `Date` - Last updated timestamp.

### TransactionRequest
- **fromWalletId**: `string` - ID of the wallet from which to initiate the transaction.
- **toWalletId**: `string` - (Optional) ID of the recipient wallet.
- **fromCurrency**: `string` - Currency being used from the sending wallet.
- **toCurrency**: `string` - (Optional) Currency being received in the receiving wallet.
- **amount**: `number` - Amount to transact.
- **type**: `string` - Transaction type ('transfer', 'exchange', etc.).
- **description**: `string` - (Optional) Transaction description.
- **metadata**: `Record<string, any>` - (Optional) Additional transaction metadata.

### OptimizationStrategy
- **type**: `string` - Strategy type ('threshold', 'ml_driven', or 'manual').
- **parameters**: `Record<string, any>` - Strategy parameters.

## Return Values
The service methods typically return:
- Wallet attributes for wallet management.
- Transaction records on successful transactions.
- Balance information for currency balances.

## Examples

### Creating a Wallet
```typescript
const walletAccount = await walletService.createWallet({
    userId: 'user_id_123',
    name: 'My Wallet',
    type: 'personal',
    baseCurrency: 'USD',
});
```

### Making a Transaction
```typescript
const transaction = await walletService.makeTransaction({
    fromWalletId: 'wallet_id_123',
    toWalletId: 'wallet_id_456',
    fromCurrency: 'USD',
    toCurrency: 'EUR',
    amount: 100,
    type: 'transfer',
    description: 'Payment for services',
});
```

### Checking Wallet Balance
```typescript
const balance = await walletService.getBalance('wallet_id_123', 'USD');
```

This service provides a comprehensive framework to manage multi-currency wallets efficiently.