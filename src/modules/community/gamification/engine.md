# Build Community Gamification Engine

# Community Gamification Engine

## Purpose
The Community Gamification Engine enhances community engagement by rewarding users for various activities. It tracks user activities, awards points, and manages badges and achievements to foster participation and improve overall user experience.

## Usage
This engine is designed to be integrated into a community platform where user activity can be monitored and gamified. It utilizes a point-based system for rewarding interactions such as posts, comments, likes, and participations in events. The system also manages badges and achievements based on user activity.

## Parameters/Props

### PointConfig
- **activityType**: `ActivityType` - Type of user activity.
- **basePoints**: `number` - Base points awarded for the activity.
- **multipliers**: `object` - Multipliers for additional points.
  - **qualityBonus**: `number` - Bonus points for content quality.
  - **streakMultiplier**: `number` - Extra points for streaks.
  - **communityBonus**: `number` - Bonus points for community interactions.
- **dailyLimit**: `number` (optional) - Maximum points that can be earned in a day for this activity.

### Badge
- **id**: `string` - Unique identifier for the badge.
- **name**: `string` - Name of the badge.
- **description**: `string` - Description of the badge.
- **icon**: `string` - URL or path to the badge icon.
- **rarity**: `BadgeRarity` - Rarity level of the badge.
- **requirements**: `object` - Conditions to earn the badge.
  - **activityType**: `ActivityType` (optional) - Specific activity for earning the badge.
  - **threshold**: `number` - Required activity count.
  - **timeframe**: `number` (optional) - Timeframe in days for activity.
  - **conditions**: `Record<string, any>` (optional) - Additional conditions for earning.
- **points**: `number` - Points awarded for earning this badge.
- **isActive**: `boolean` - Indicates whether the badge is currently active.
- **createdAt**: `Date` - Timestamp of badge creation.

### Achievement
- **id**: `string` - Unique identifier for the achievement.
- **name**: `string` - Name of the achievement.
- **description**: `string` - Description of the achievement.
- **type**: `AchievementType` - Type of achievement (e.g., milestone, streak).
- **icon**: `string` - URL or path to the achievement icon.
- **requirements**: `object` - Conditions for unlocking the achievement.
  - **target**: `number` - Required target for achievement.
  - **metric**: `string` - Metric for tracking.
  - **timeframe**: `number` (optional) - Timeframe for completion.

## Return Values
The engine will return objects representing user activity points, badge progress, and achievement statuses based on the defined configurations and user interactions.

## Examples
```typescript
// Example of creating a PointConfig
const postCreationPoints: PointConfig = {
  activityType: ActivityType.POST_CREATION,
  basePoints: 10,
  multipliers: {
    qualityBonus: 2,
    streakMultiplier: 1.5,
    communityBonus: 1.2,
  },
  dailyLimit: 5,
};

// Example of defining a Badge
const firstPostBadge: Badge = {
  id: 'badge_001',
  name: 'First Post',
  description: 'Awarded for creating the first post.',
  icon: '/icons/first_post.png',
  rarity: BadgeRarity.COMMON,
  requirements: {
    threshold: 1,
    activityType: ActivityType.POST_CREATION,
  },
  points: 50,
  isActive: true,
  createdAt: new Date(),
};

// Example of defining an Achievement
const streakAchievement: Achievement = {
  id: 'achievement_001',
  name: 'Daily Streak',
  description: 'Log in for 7 consecutive days.',
  type: AchievementType.STREAK,
  icon: '/icons/daily_streak.png',
  requirements: {
    target: 7,
    metric: 'loginCount',
  },
};
```