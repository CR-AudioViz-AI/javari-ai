# Create Creator Affiliate Network Service

```markdown
# Creator Affiliate Network Service

## Purpose
The Creator Affiliate Network Service provides a robust framework for managing affiliate programs, tracking affiliate links, referrals, and commission payouts. It allows creators to establish multi-tier affiliate programs that enable their affiliates to earn commissions through sales, referrals, and other activities.

## Usage
To use this service, you need to import the necessary types and initialize the Supabase client to interact with the database for managing affiliate data. The service supports the creation and management of affiliate programs, the handling of affiliate links, tracking of referrals, and processing commission payouts.

## Parameters / Props

### AffiliateProgram
- **id**: `string` - Unique identifier for the program.
- **creator_id**: `string` - ID of the creator managing the program.
- **agent_id**: `string` - ID of the agent associated with the program.
- **name**: `string` - Name of the affiliate program.
- **description**: `string` - A brief description of the program.
- **base_commission_rate**: `number` - Base commission rate for the program.
- **tier_structure**: `AffiliateTier[]` - Array of tiers defining commission levels.
- **cookie_duration**: `number` - Duration for which affiliate cookies are valid (in days).
- **min_payout**: `number` - Minimum amount required for payout.
- **status**: `'active' | 'paused' | 'ended'` - Current status of the program.
- **created_at**: `string` - Timestamp of creation.
- **updated_at**: `string` - Timestamp of the last update.

### AffiliateTier
- **level**: `number` - Tier level.
- **commission_rate**: `number` - Commission rate for this tier.
- **requirements**: `Object` - Conditions to achieve the tier.
- **name**: `string` - Name of the tier.
- **benefits**: `string[]` - List of benefits at this tier.

### AffiliateLink
- **id**: `string` - Unique identifier for the link.
- **program_id**: `string` - ID of the associated program.
- **affiliate_id**: `string` - ID of the affiliate.
- **tracking_code**: `string` - Unique tracking code for the link.
- **custom_parameters**: `Record<string, any>` - Custom parameters for tracking.
- **clicks**: `number` - Total clicks on the link.
- **conversions**: `number` - Number of conversions from clicks.
- **revenue**: `number` - Revenue generated through the link.
- **is_active**: `boolean` - Status of the link.
- **created_at**: `string` - Timestamp of creation.

### Referral
- **id**: `string` - Unique identifier for the referral.
- **program_id**: `string` - ID of the program associated with the referral.
- **affiliate_id**: `string` - ID of the referring affiliate.
- **user_id**: `string` - ID of the user referred.
- **agent_id**: `string` - ID of the agent associated.
- **purchase_amount**: `number` - Amount of the purchase.
- **commission_amount**: `number` - Amount of commission earned.
- **tier_level**: `number` - Tier level for the commission.
- **status**: `'pending' | 'confirmed' | 'cancelled'` - Current status of the referral.
- **tracking_data**: `Object` - Data related to tracking the referral.
- **created_at**: `string` - Timestamp of creation.

### Payout
- **id**: `string` - Unique identifier for the payout.
- **affiliate_id**: `string` - ID of the affiliate receiving the payout.
- **amount**: `number` - Amount being paid out.
- **currency**: `string` - Currency of the payout.
- **status**: `'pending' | 'processing' | 'completed' | 'failed'` - Current status of the payout.
- **payment_method**: `string` - Method used for the payout.
- **payment_details**: `Record<string, any>` - Additional details of payment.
- **processed_at**: `string` - Timestamp when the payout was processed.
- **created_at**: `string` - Timestamp of creation.

## Return Values
The service functions return structured data corresponding to the interface definitions, allowing for easy management and retrieval of information about affiliates, programs, links, referrals, and payouts.

## Examples
```typescript
const program: AffiliateProgram = {
  id: uuidv4(),
  creator_id: 'creator_123',
  agent_id: 'agent_456',