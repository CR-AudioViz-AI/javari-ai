# Create Multi-Chain Cryptocurrency Payment Module

# Multi-Chain Cryptocurrency Payment Module

## Purpose
The Multi-Chain Cryptocurrency Payment Module facilitates cross-chain cryptocurrency payments by supporting multiple blockchain networks. It enables the execution of atomic swaps and manages payment processing across Ethereum, Polygon, Binance Smart Chain, Avalanche, Arbitrum, and Optimism.

## Usage
To utilize the module, instantiate the necessary classes and configure the blockchain parameters based on the networks being used. The module allows for the creation of payment requests and handling of payment statuses, including atomic swaps.

## Parameters / Props

### Enums
- **SupportedChain**: Enum representing supported blockchains.
  - `ETHEREUM`
  - `POLYGON`
  - `BSC`
  - `AVALANCHE`
  - `ARBITRUM`
  - `OPTIMISM`

- **PaymentStatus**: Enum for the various payment statuses.
  - `PENDING`
  - `CONFIRMED`
  - `FAILED`
  - `CANCELLED`
  - `REFUNDED`

- **SwapStatus**: Enum indicating the status of an atomic swap.
  - `INITIATED`
  - `LOCKED`
  - `REDEEMED`
  - `REFUNDED`
  - `EXPIRED`

- **DeFiProtocol**: Enum for different DeFi protocols.
  - `UNISWAP_V3`
  - `PANCAKESWAP`
  - `AAVE`
  - `COMPOUND`
  - `CURVE`

### Interfaces
- **ChainConfig**: Configuration object for each blockchain.
  - `chainId`: Integer identifier for the chain.
  - `name`: Name of the blockchain.
  - `rpcUrl`: JSON-RPC URL for blockchain interaction.
  - `explorerUrl`: URL for the blockchain explorer.
  - `nativeCurrency`: Object containing:
    - `name`: Name of the native currency.
    - `symbol`: Symbol of the native currency.
    - `decimals`: Decimals for the currency.
  - `contracts`: Object containing contract addresses for:
    - `multicall`
    - `weth`
    - `router`

- **PaymentRequest**: Structure for a payment request.
  - `id`: Unique identifier for the payment request.
  - `fromChain`: Source blockchain for the payment.
  - `toChain`: Destination blockchain for the payment.
  - `fromToken`: Token being sent from the source chain.
  - `toToken`: Token being received on the target chain.
  - `amount`: Amount to be sent.
  - `recipient`: Address of the recipient.
  - `sender`: Address of the sender.
  - `deadline`: Optional timeout for the payment.
  - `slippageTolerance`: Tolerance for slippage in swaps.
  - `gasLimit`: Optional gas limit for transactions.
  - `metadata`: Any additional metadata.

- **AtomicSwapParams**: Parameters required for an atomic swap.
  - `initiatorChain`: Chain initiating the swap.
  - `participantChain`: Chain participating in the swap.
  - `initiatorToken`: Token to send by the initiator.
  - `participantToken`: Token to receive by the participant.
  - `initiatorAmount`: Amount to send from the initiator.
  - `participantAmount`: Amount to receive by the participant.
  - `hashLock`: Hash lock for security.
  - `timeLock`: Time limit for the swap.
  - `initiator`: Address of the initiator.
  - `participant`: Address of the participant.

## Return Values
The module operates primarily through asynchronous functions and returns promises resolving to payment confirmations or statuses. Specific implementations will determine the return types.

## Examples

### Example of Creating a Payment Request
```typescript
const paymentRequest: PaymentRequest = {
  id: 'unique-request-id',
  fromChain: SupportedChain.ETHEREUM,
  toChain: SupportedChain.POLYGON,
  fromToken: '0xTokenAddress1',
  toToken: '0xTokenAddress2',
  amount: '100',
  recipient: '0xRecipientAddress',
  sender: '0xSenderAddress',
  deadline: 1625251234,
  slippageTolerance: 1,
  gasLimit: '200000',
  metadata: {}
};
```

### Example of Atomic Swap Parameters
```typescript
const atomicSwapParams: AtomicSwapParams = {
  initiatorChain: SupportedChain.BSC,
  participantChain: SupportedChain.AVALANCHE,
  initiatorToken: '0xTokenAddress1',
  participantToken: '0xTokenAddress2',
  initiatorAmount: '50',
  participantAmount: '150',
  hashLock: '0xHashLockValue',
  timeLock: 7200,
  initiator: '