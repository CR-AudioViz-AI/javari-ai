# Deploy Marketplace Inventory Management Microservice

# Marketplace Inventory Management Microservice Documentation

## Purpose
The Marketplace Inventory Management Microservice is designed to manage inventory for a marketplace application. It allows for the handling of inventory items, license allocations, purchase requests, reservations, and inventory transactions. This service facilitates real-time updates and scalable interactions through a Redis database and Supabase.

## Usage
To use the Marketplace Inventory Management Microservice, integrate the provided interfaces and event types into your application. Set up a Supabase client for database interactions and Redis for caching and event notifications.

## Interfaces

### `InventoryItem`
Represents an item in the marketplace inventory.

**Properties:**
- `id`: Unique identifier for the inventory item.
- `agentId`: Identifier of the associated agent.
- `licenseType`: Type of license ('basic', 'professional', or 'enterprise').
- `totalQuota`: Total quotas available for the item.
- `availableQuota`: Quotas currently available for sale.
- `reservedQuota`: Quotas currently reserved.
- `pricePerUnit`: Price per unit of the license.
- `currency`: Currency of the price.
- `version`: Version of the item for tracking changes.
- `isActive`: Status indicating if the item is active.
- `createdAt`: Timestamp when the item was created.
- `updatedAt`: Timestamp when the item was last updated.
- `expiresAt`: Optional expiration date.

### `LicenseAllocation`
Tracks allocated licenses to users.

**Properties:**
- `id`: Unique identifier for the allocation.
- `inventoryItemId`: References the inventory item.
- `userId`: Identifier of the user receiving the allocation.
- `quotaAllocated`: Total quota allocated to the user.
- `quotaUsed`: Quota used by the user.
- `status`: Current status ('active', 'suspended', 'expired').
- `purchaseTransactionId`: Associated purchase transaction.
- `allocatedAt`: Timestamp when the license was allocated.
- `expiresAt`: Optional expiration date.

### `PurchaseRequest`
Represents a request to purchase inventory.

**Properties:**
- `id`: Unique identifier for the purchase request.
- `userId`: Identifier of the user making the request.
- `inventoryItemId`: References the inventory item.
- `quantity`: Number of licenses requested.
- `maxPricePerUnit`: Maximum price user is willing to pay.
- `metadata`: Optional additional meta information.
- `timestamp`: Timestamp when the request was made.

### `Reservation`
Handles temporary reservations on inventory items.

**Properties:**
- `id`: Unique identifier for the reservation.
- `inventoryItemId`: References the inventory item.
- `userId`: Identifier of the reserving user.
- `quantity`: Quantity reserved.
- `reservedAt`: Timestamp of the reservation.
- `expiresAt`: Expiration date of the reservation.
- `status`: Current status of the reservation ('pending', 'confirmed', 'expired', 'cancelled').

### `InventoryTransaction`
Records transactions related to inventory.

**Properties:**
- `id`: Unique identifier for the transaction.
- `type`: Type of transaction ('purchase', 'refund', 'quota_replenish', 'quota_consume').
- `inventoryItemId`: References the inventory item.
- `userId`: Identifier of the user involved.
- `quantity`: Quantity of licenses transacted.
- `pricePerUnit`: Optional price for the transaction.
- `totalAmount`: Optional total amount for the transaction.
- `status`: Current transaction status ('pending', 'completed', 'failed', 'cancelled').
- `createdAt`: Timestamp when the transaction was created.
- `completedAt`: Optional timestamp when the transaction was completed.
- `metadata`: Optional additional meta information.

## Events

### `InventoryEvent`
Represents events related to inventory changes.

**Event Types:**
- `QUOTA_UPDATED`: Occurs when the available quota of an inventory item is updated.
  - **Payload**: `{ inventoryItemId: string; availableQuota: number }`
  
- `PURCHASE_COMPLETED`: Triggered when a purchase is successfully completed.
  - **Payload**: `{ transactionId: string }`

## Examples
```typescript
const newItem: InventoryItem = {
    id: 'item1',
    agentId: 'agent1',
    licenseType: 'professional',
    totalQuota: 100,
    availableQuota: 80,
    reservedQuota: 20,
    pricePerUnit: 29.99,
    currency: 'USD',
    version: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
};

const purchaseRequest: PurchaseRequest = {
    id: 'request1',
    userId: 'user1',
    inventoryItemId: 'item1',
    quantity: 2,
    maxPricePerUnit: 30,
    timestamp: new Date(),
};
``