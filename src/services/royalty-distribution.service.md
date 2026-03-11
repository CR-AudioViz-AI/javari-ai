# Create Advanced Royalty Distribution Service

# Royalty Distribution Service

## Purpose
The Royalty Distribution Service is designed to calculate and distribute royalties among various stakeholders involved in content creation. It supports multiple calculation modes, tracking of distribution status, and manages stakeholder agreements effectively.

## Usage
To use the Royalty Distribution Service in your application, instantiate the service and utilize its methods for managing stakeholders, agreements, and revenue streams. It allows you to automate the calculation and distribution of royalties based on predefined rules and agreements.

## Parameters / Props

### Enums
- **DistributionMode**: Defines the modes of royalty distribution.
  - `PERCENTAGE`: Distribution based on a percentage of total revenue.
  - `FIXED_RATE`: A fixed amount distributed to the stakeholder.
  - `HYBRID`: A combination of both percentage and fixed rate.

- **StakeholderType**: Defines the types of stakeholders.
  - `ARTIST`, `COLLABORATOR`, `PRODUCER`, `SONGWRITER`, `PUBLISHER`, `LABEL`, `PLATFORM`, `EXTERNAL_LICENSEE`.

- **DistributionStatus**: Tracks the status of the distribution process.
  - `PENDING`, `CALCULATING`, `CALCULATED`, `PROCESSING`, `COMPLETED`, `FAILED`, `DISPUTED`.

### Interfaces
- **Stakeholder**: Represents an entity entitled to revenue.
  - `id`: Unique identifier.
  - `userId`: Associated user's ID.
  - `type`: Type of stakeholder.
  - `name`: Stakeholder's name.
  - `email`: Contact email.
  - `paymentMethod`: Method used for payment.
  - `isActive`: Boolean indicating if the stakeholder is active.

- **RoyaltyAgreement**: Defines the agreement terms for revenue distribution.
  - `id`, `contentId`, `stakeholderId`, `percentage`, `fixedRate`, `minimumAmount`, `maximumAmount`, `priority`, `mode`, `effectiveDate`, `expirationDate`, `conditions`, `isActive`.

- **RevenueStream**: Represents income generated to be distributed.
  - `id`, `contentId`, `source`, `grossAmount`, `netAmount`, `currency`, `periodStart`, `periodEnd`, `metadata`.

- **CalculatedDistribution**: Represents the computed distribution amounts for stakeholders.

## Return Values
Methods in the Royalty Distribution Service return various types of data based on the operation, including:
- Success or error messages for stakeholder additions or updates.
- Calculated distribution amounts for each stakeholder on processing revenue streams.
- Status updates regarding the distribution process.

## Examples
```typescript
const royaltyService = new RoyaltyDistributionService();

// Adding a stakeholder
const stakeholder: Stakeholder = {
  id: '123',
  userId: 'user_456',
  type: StakeholderType.ARTIST,
  name: 'John Doe',
  email: 'johndoe@example.com',
  paymentMethod: 'bank_transfer',
  isActive: true
};

// Create a stakeholder in the system
royaltyService.addStakeholder(stakeholder);

// Creating a revenue stream
const revenueStream: RevenueStream = {
  id: 'rev1',
  contentId: 'content_789',
  source: 'streaming_service',
  grossAmount: 1000,
  netAmount: 800,
  currency: 'USD',
  periodStart: new Date('2023-01-01'),
  periodEnd: new Date('2023-01-31'),
  metadata: {}
};

// Processing the revenue stream
royaltyService.processRevenueStream(revenueStream);
```

This service streamlines the management of royalties, ensuring stakeholders are fairly compensated for their contributions.