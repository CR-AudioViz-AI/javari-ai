# Build Creator Affiliate Marketing Platform

# Affiliate Marketing Platform Documentation

## Purpose
The **Affiliate Marketing Platform** is designed for creators to manage their affiliate marketing efforts efficiently. It provides functionalities for referral tracking, commission calculations, and payout management, enabling creators to maximize their earnings through effective marketing strategies.

## Usage
The platform can be invoked by importing the necessary modules from the `src/modules/affiliate-marketing` directory. It allows the creation, management, and tracking of affiliate links, commissions, and payouts through defined schemas.

### Importing the Module
```typescript
import { AffiliateSchema, ReferralLinkSchema, ReferralTrackingSchema } from '@/modules/affiliate-marketing';
```

## Parameters/Props

### Schemas
1. **AffiliateSchema**
   - `id`: UUID - Unique identifier for the affiliate.
   - `user_id`: UUID - Identifier for the user associated with the affiliate.
   - `referral_code`: string (6-20 chars) - Unique code for referral tracking.
   - `status`: Enum - Current status (`pending`, `active`, `suspended`, `terminated`).
   - `commission_rate`: number (0-1) - Commission rate for referrals.
   - `total_referrals`: integer (≥ 0) - Total number of referrals made.
   - `total_earnings`: number (≥ 0) - Total earnings from referrals.
   - `pending_earnings`: number (≥ 0) - Earnings awaiting approval.
   - `tier_level`: integer (1-5) - Level within the affiliate program.
   - `created_at`: datetime - Timestamp of creation.
   - `updated_at`: datetime - Timestamp of the last update.
   - `metadata`: record (optional) - Additional information as key-value pairs.

2. **ReferralLinkSchema**
   - `id`: UUID - Unique identifier for the referral link.
   - `affiliate_id`: UUID - Identifier for the associated affiliate.
   - `campaign_name`: string (1-100 chars) - Name of the marketing campaign.
   - `original_url`: URL - Original URL for referral.
   - `tracking_url`: URL - Tracking URL generated for the referral.
   - `utm_parameters`: record (optional) - UTM parameters for tracking.
   - `click_count`: integer (≥ 0) - Number of clicks on the link.
   - `conversion_count`: integer (≥ 0) - Number of conversions from the link.
   - `is_active`: boolean - Indicates if the link is active.
   - `expires_at`: datetime (optional) - Expiration date of the link.
   - `created_at`: datetime - Timestamp of creation.

3. **ReferralTrackingSchema**
   - `id`: UUID - Unique identifier for a tracking entry.
   - `affiliate_id`: UUID - Identifier for the associated affiliate.
   - `referral_link_id`: UUID - Identifier for the referral link clicked.
   - `visitor_id`: string (optional) - Identifier for the visitor.
   - `ip_address`: string (optional) - IP address of the visitor.
   - `user_agent`: string (optional) - User agent from which the link was clicked.
   - `referrer`: URL (optional) - Referrer URL of the visitor.
   - `landing_page`: URL - Landing page for the referral.

## Return Values
The methods operating with these schemas will return detailed objects conforming to their respective schemas, including validations for data integrity and consistency.

## Examples

### Create an Affiliate
```typescript
const newAffiliate = AffiliateSchema.parse({
  id: 'some-uuid',
  user_id: 'another-uuid',
  referral_code: 'MYCODE123',
  status: 'active',
  commission_rate: 0.1,
  total_referrals: 0,
  total_earnings: 0,
  pending_earnings: 0,
  tier_level: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});
```

### Create a Referral Link
```typescript
const newLink = ReferralLinkSchema.parse({
  id: 'link-uuid',
  affiliate_id: 'some-uuid',
  campaign_name: 'Spring Sale',
  original_url: 'https://example.com/product',
  tracking_url: 'https://tracking.example.com/track?ref=MYCODE123',
  utm_parameters: { utm_source: 'newsletter' },
  click_count: 0,
  conversion_count: 0,
  is_active: true,
  created_at: new Date().toISOString(),
});
```

### Track a Referral
```typescript
const trackingEntry = ReferralTrackingSchema.parse({
  id: 'tracking-uuid',
  affiliate_id: 'some-uuid',
  referral_link_id: 'link-uuid',
  visitor_id: 'visitor-uuid',
  ip