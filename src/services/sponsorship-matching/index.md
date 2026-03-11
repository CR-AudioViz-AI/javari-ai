# Create Brand-Creator Sponsorship Matching Service

# Brand-Creator Sponsorship Matching Service Documentation

## Purpose
The Brand-Creator Sponsorship Matching Service is an AI-powered service designed to connect content creators with brands for sponsorship opportunities. It evaluates creators and brands based on audience demographics, content alignment, and engagement metrics to facilitate meaningful collaborations.

## Usage
To utilize the service, you must have a configured environment with the required dependencies, specifically `OpenAI`, `@supabase/supabase-js`, and `events`. The service can be instantiated and invoked to find suitable matches between creators and brands.

## Parameters/Props

### CreatorProfile
- **id**: `string` — Unique identifier for the creator.
- **userId**: `string` — Associated user ID in the system.
- **handle**: `string` — Creator's public social media handle.
- **platforms**: `Platform[]` — List of platforms the creator is active on.
- **audienceSize**: `number` — Total number of audience members.
- **audienceDemographics**: `AudienceDemographics` — Detailed audience analytics.
- **contentCategories**: `string[]` — Categories of content produced.
- **engagementRate**: `number` — Rate of audience engagement.
- **averageViews**: `number` — Average views per content piece.
- **contentStyle**: `ContentStyle` — Describes the creator's style.
- **collaborationHistory**: `CollaborationRecord[]` — Previous partnership history.
- **verificationStatus**: `'verified' | 'pending' | 'unverified'` — Creator's verification status.
- **createdAt**: `Date` — Creation timestamp.
- **updatedAt**: `Date` — Last update timestamp.

### BrandProfile
- **id**: `string` — Unique identifier for the brand.
- **companyId**: `string` — Associated company identifier.
- **name**: `string` — Brand name.
- **industry**: `string` — Type of industry the brand operates in.
- **targetAudience**: `AudienceDemographics` — Brand's targeted audience insights.
- **brandValues**: `string[]` — Core values represented by the brand.
- **campaignBudget**: `BudgetRange` — Financial range for campaigns.
- **preferredPlatforms**: `Platform[]` — Platforms the brand prefers for collaboration.
- **contentRequirements**: `ContentRequirements` — Expectations for brand content.
- **collaborationPreferences**: `CollaborationPreferences` — Specific collaboration wants/needs.
- **complianceRequirements**: `string[]` — Regulatory compliance needs.
- **createdAt**: `Date` — Creation timestamp.
- **updatedAt**: `Date` — Last update timestamp.

## Return Values
The service returns matching pairs of creators and brands along with relevant metrics indicating compatibility, making it easier for both parties to decide on potential partnerships. The output typically includes:
- List of matched `CreatorProfile` and `BrandProfile` pairs.
- Compatibility scores based on demographics and engagement metrics.
- Recommendations for optimal collaboration strategies.

## Examples
```typescript
import { matchCreatorsWithBrands } from './sponsorship-matching';

// Example creator profile
const creator: CreatorProfile = {
  id: 'c1',
  userId: 'u1',
  handle: '@creator_handle',
  platforms: [{ name: 'instagram', handle: '@creator_handle', followersCount: 10000 }],
  audienceSize: 10000,
  audienceDemographics: { ageGroups: {}, genderDistribution: {}, geographicDistribution: {}, interests: [], psychographics: {}, languagePreferences: [], deviceUsage: {} },
  contentCategories: ['fashion', 'lifestyle'],
  engagementRate: 5.0,
  averageViews: 5000,
  contentStyle: 'vlog',
  collaborationHistory: [],
  verificationStatus: 'verified',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Example brand profile
const brand: BrandProfile = {
  id: 'b1',
  companyId: 'cmp1',
  name: 'BrandX',
  industry: 'fashion',
  targetAudience: { ageGroups: {}, genderDistribution: {}, geographicDistribution: {}, interests: [], psychographics: {}, languagePreferences: [], deviceUsage: {} },
  brandValues: ['sustainability', 'quality'],
  campaignBudget: { min: 2000, max: 5000 },
  preferredPlatforms: [{ name: 'instagram', handle: 'brand_handle', followersCount: 50000 }],
  contentRequirements: { format: 'photo', tone: 'casual' },
  collaborationPreferences: { openToExperiment: true },
  complianceRequirements: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Perform matching
const matches = match