# Build CRAIverse Virtual Marketplace Module

```markdown
# CRAIverse Virtual Marketplace Module

## Purpose
The CRAIverse Virtual Marketplace Module is a React component built to display and manage marketplace items within a decentralized application. It allows users to fetch, filter, and interact with various virtual assets, enhancing the user experience in a virtual marketplace environment.

## Usage
To use the Marketplace Module, import it into your application and include it within your component tree. Ensure you have the necessary dependencies, including `wagmi` for wallet interactions and `supabase` for data fetching.

```tsx
import Marketplace from '@/app/craiverse/marketplace/page';

// Then, include <Marketplace /> within your component.
```

## Parameters/Props
The Marketplace component does not take any external props directly. However, it internally manages state with the following significant aspects:

- **Account Management**: Utilizes `useAccount` from `wagmi` to manage user accounts connected to wallets.
- **Item Listing**: Fetches items from Supabase with filters based on user preferences, such as category and price range.
- **Transaction Management**: Handles user transactions and displays them as part of the marketplace activity.

### Filter Options Interface
The module utilizes the following filter parameters:

- `category`: (string) The specific category of the item (e.g., 'land', 'avatar').
- `priceMin`: (string) Minimum price filter.
- `priceMax`: (string) Maximum price filter.
- `currency`: (string) Currency in which items are priced (e.g., 'ETH', 'MATIC').
- `rarity`: (string) Rarity level of the items (e.g., 'rare', 'legendary').
- `verified`: (boolean) Filter for verified items.
- `sortBy`: (string) Sort criteria (e.g., 'price_asc', 'popular').

## Return Values
The main function of the `MarketplaceService` class is `getItems`, which returns a promise that resolves to an array of marketplace items (`MarketplaceItem[]`). Each `MarketplaceItem` object contains the following properties:

- `id`: Unique identifier for the item.
- `name`: Name of the item.
- `description`: Brief detail about the item.
- `category`: Category to which the item belongs.
- `price`: Price of the item.
- `currency`: Currency type.
- `seller_address`: Address of the seller.
- `created_at`: Timestamp when the item was created.
- `transaction_history`: List containing transaction info related to the item.

## Examples
### Fetching Items
You can fetch items by calling `getItems` with the desired filters:
```tsx
const filters: Partial<FilterOptions> = {
  category: 'avatar',
  priceMin: '0.1',
  priceMax: '1.0',
  currency: 'ETH',
  verified: true,
  sortBy: 'price_asc',
};

const items = await marketplaceService.getItems(filters);
console.log(items);
```

### Sample Marketplace Item
An example of a `MarketplaceItem` structure:
```json
{
  "id": "123",
  "name": "Virtual Avatar",
  "description": "A unique virtual character",
  "category": "avatar",
  "price": "0.5",
  "currency": "ETH",
  "seller_address": "0xabc...",
  "seller_name": "CryptoSeller",
  "created_at": "2023-01-01T00:00:00Z",
  "transaction_history": []
}
```

With this module, developers can create a rich virtual marketplace experience, allowing users to engage with digital assets seamlessly.
```