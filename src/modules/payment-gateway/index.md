# Build Multi-Blockchain Payment Gateway

# Multi-Blockchain Payment Gateway Documentation

## Purpose
The Multi-Blockchain Payment Gateway provides a unified interface to facilitate cryptocurrency transactions across multiple blockchain networks. It allows application developers to manage payment requests, monitor transaction statuses, and connect users’ wallets seamlessly.

## Usage
To integrate the Multi-Blockchain Payment Gateway, import the necessary enumerations and interfaces from the module. Utilize the `PaymentRequest` and `Transaction` interfaces to create payment requests and handle transaction data.

## Parameters/Props

### Enums
- **BlockchainNetwork**: Lists supported blockchain networks:
  - `BITCOIN`
  - `ETHEREUM`
  - `BINANCE_SMART_CHAIN`
  - `POLYGON`
  - `AVALANCHE`
  - `SOLANA`
  - `CARDANO`

- **CryptoCurrency**: Lists supported cryptocurrencies:
  - `BTC`, `ETH`, `BNB`, `MATIC`, `AVAX`, `SOL`, `ADA`, `USDT`, `USDC`, `DAI`

- **PaymentStatus**: Represents payment status:
  - `PENDING`, `CONFIRMED`, `FAILED`, `EXPIRED`, `CANCELLED`

- **DeFiProtocol**: Lists supported DeFi protocols:
  - `UNISWAP`, `PANCAKESWAP`, `SUSHISWAP`, `COMPOUND`, `AAVE`, `CURVE`

- **WalletType**: Defines wallet connection types:
  - `METAMASK`, `WALLET_CONNECT`, `COINBASE`, `PHANTOM`, `TRUST_WALLET`

### Interfaces
- **Transaction**: Represents a transaction record.
  - `id`: Unique transaction identifier.
  - `hash`: (optional) Blockchain transaction hash.
  - `from`: Sender's wallet address.
  - `to`: Recipient's wallet address.
  - `amount`: Transaction amount.
  - `currency`: Instance of `CryptoCurrency`.
  - `network`: Instance of `BlockchainNetwork`.
  - `status`: Instance of `PaymentStatus`.
  - `gasPrice`: (optional) Price per gas unit.
  - `gasLimit`: (optional) Maximum gas limit.
  - `fee`: (optional) Transaction fee.
  - `timestamp`: Date and time of the transaction.
  - `confirmations`: (optional) Number of block confirmations.
  - `blockNumber`: (optional) Block number at which the transaction was included.
  - `metadata`: (optional) Additional transaction data as a key-value object.

- **PaymentRequest**: Represents a request to initiate a payment.
  - `amount`: Amount of cryptocurrency to send.
  - `currency`: Instance of `CryptoCurrency`.
  - `recipient`: Address of the payment recipient.
  - `network`: (optional) Instance of `BlockchainNetwork`.
  - `memo`: (optional) Transaction memo.
  - `expiresAt`: (optional) Expiration date/time of the request.
  - `autoConvert`: (optional) Automatically convert currencies on payment.
  - `targetCurrency`: (optional) Desired target currency for conversion.
  - `gasPrice`: (optional) Gas price preference: 'slow', 'standard', 'fast'.
  - `useSmartContract`: (optional) Boolean to indicate smart contract usage.
  - `contractAddress`: (optional) Smart contract address.
  - `defiProtocol`: (optional) Instance of `DeFiProtocol`.

- **WalletConnection**: Represents a connected wallet.
  - `address`: Wallet address of the user.

## Return Values
The gateway returns structured information based on the performed actions, including details about the transaction status, available wallets, and payment confirmation status.

## Examples

### Creating a Payment Request
```typescript
const paymentRequest: PaymentRequest = {
  amount: "0.5",
  currency: CryptoCurrency.ETH,
  recipient: "0xRecipientAddress",
  network: BlockchainNetwork.ETHEREUM,
  memo: "Payment for services",
  expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour expiry
  gasPrice: 'standard',
  useSmartContract: false
};
```

### Handling a Transaction
```typescript
const transaction: Transaction = {
  id: "123456",
  from: "0xYourAddress",
  to: "0xRecipientAddress",
  amount: "0.5",
  currency: CryptoCurrency.ETH,
  network: BlockchainNetwork.ETHEREUM,
  status: PaymentStatus.PENDING,
  timestamp: new Date()
};
```

This documentation provides a basic overview and example usages of the Multi-Blockchain Payment Gateway functionalities. For detailed implementation, refer to the specific interfaces and enums listed in the module.