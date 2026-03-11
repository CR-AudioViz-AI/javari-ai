# Build CRAIverse Virtual Asset Trading Engine

```markdown
# CRAIverse Virtual Asset Trading Engine Documentation

## Purpose
The CRAIverse Virtual Asset Trading Engine is designed to facilitate the trading of various virtual assets such as NFTs, digital collectibles, and utility tokens across multiple blockchain networks. It supports different order types and asset attributes to enable a flexible trading experience.

## Usage
To utilize the trading engine, import the necessary modules and create an instance of the engine. You can then interact with various virtual assets, create trading orders, and manage existing ones based on market conditions.

```typescript
import { TradingEngine } from './src/modules/craiverse/trading/index';

// Example initialization
const tradingEngine = new TradingEngine();
```

## Parameters/Props

### Enumerations
- **AssetType**: Defines the type of virtual asset.
  - `NFT`
  - `VIRTUAL_REAL_ESTATE`
  - `DIGITAL_COLLECTIBLE`
  - `UTILITY_TOKEN`
  - `GOVERNANCE_TOKEN`

- **OrderType**: Specifies the types of trading orders.
  - `MARKET`
  - `LIMIT`
  - `STOP`
  - `AUCTION`

- **OrderStatus**: Describes the status of an order.
  - `PENDING`
  - `PARTIAL`
  - `FILLED`
  - `CANCELLED`
  - `EXPIRED`

- **BlockchainNetwork**: Lists supported blockchain networks.
  - `ETHEREUM`
  - `POLYGON`
  - `SOLANA`
  - `ARBITRUM`

### Interfaces
- `VirtualAsset`: Represents a virtual asset with properties including:
  - `id`: Unique identifier.
  - `contractAddress`: Address of the smart contract.
  - `tokenId`: Token identifier.
  - `name`: Asset name.
  - `description`: Asset description.
  - `image`: Asset image URL.
  - `metadata`: Additional asset metadata.
  - `type`: Type of asset (`AssetType`).
  - `network`: Associated blockchain network (`BlockchainNetwork`).
  - `owner`: Current owner of the asset.
  - `creator`: Creator of the asset.
  - `royalties`: Royalty percentage.
  - `isListed`: Whether the asset is listed for sale.
  - `currentPrice`: Current price (optional).
  - `lastSalePrice`: Last sale price (optional).
  - `rarity`: Rarity score (optional).
  - `attributes`: Asset attributes list (optional).
  - `createdAt`: Creation date.
  - `updatedAt`: Last update date.

- `TradingOrder`: Represents a trading order with properties including:
  - `id`: Unique order identifier.
  - `userId`: ID of the user placing the order.
  - `assetId`: ID of the asset being traded.
  - `type`: Type of order (`OrderType`).
  - `side`: Side of the order (`buy` or `sell`).
  - `quantity`: Quantity of the asset.
  - `price`: Price per asset.
  - `status`: Current status of the order (`OrderStatus`).
  - `expiresAt`: Expiration date of the order (optional).
  - `filledQuantity`: Quantity filled (optional).

## Return Values
The engine returns various objects based on the interactions, including:
- List of `VirtualAsset` objects upon retrieval.
- Confirmation of `TradingOrder` creation, including status updates.

## Examples

### Creating a Virtual Asset
```typescript
const newAsset: VirtualAsset = {
  id: '1',
  contractAddress: '0x...',
  tokenId: '101',
  name: 'Amazing NFT',
  description: 'An amazing NFT.',
  image: 'http://example.com/image.png',
  metadata: {},
  type: AssetType.NFT,
  network: BlockchainNetwork.ETHEREUM,
  owner: '0x...',
  creator: '0x...',
  royalties: 5,
  isListed: true,
  currentPrice: '0.1',
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

### Placing an Order
```typescript
const order: TradingOrder = {
  id: 'order1',
  userId: 'user1',
  assetId: '1',
  type: OrderType.LIMIT,
  side: 'buy',
  quantity: '1',
  price: '0.1',
  status: OrderStatus.PENDING,
  expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
};
```
```