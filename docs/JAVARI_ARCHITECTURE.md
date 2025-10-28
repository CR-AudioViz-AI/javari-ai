# JAVARI AI - COMPLETE SYSTEM ARCHITECTURE
**Last Updated:** Tuesday, October 28, 2025 - 12:10 PM EST  
**Document:** CR AudioViz AI Bible - Master Architecture

═══════════════════════════════════════════════════════════════

## 🎯 VISION

Build a Fortune 50 quality, autonomous, self-healing AI assistant that provides:
- Complete user customization
- Multi-language support
- Comprehensive integrations
- Credit management & billing
- Calendar & reminder system
- Complete documentation
- Key rotation & security management

**Goal:** Reach $1M ARR within 14 months through exceptional UX and automation

═══════════════════════════════════════════════════════════════

## 📐 SYSTEM ARCHITECTURE

### 1. USER PROFILE SYSTEM

**Location:** Bottom left corner of interface

**Components:**
```typescript
components/
├── user-profile/
│   ├── UserProfileButton.tsx      // Main button with user name
│   ├── UserProfileMenu.tsx        // Dropdown menu
│   ├── LanguageSelector.tsx       // English/Spanish toggle
│   └── user-profile-context.tsx   // Global user state
```

**Menu Structure:**
```
┌─ User Profile Menu ──────────────┐
│ 👤 Roy Henderson                 │
├──────────────────────────────────┤
│ 🌐 Language: English ▼           │
│ 📚 Get Help                      │
│ 💳 View Plans & Credits          │
│ ⚙️  Settings                     │
│ 📁 Assets & Documents            │
│ 🔐 Security & Keys               │
├──────────────────────────────────┤
│ 🚪 Sign Out                      │
└──────────────────────────────────┘
```

---

### 2. CREDITS & BILLING SYSTEM

**Location:** Below header, above Javari interface

**Components:**
```typescript
components/
├── credits/
│   ├── CreditsBar.tsx             // Always visible credits display
│   ├── CreditsModal.tsx           // Detailed credits info
│   ├── TopUpModal.tsx             // Buy more credits
│   └── PlansComparison.tsx        // Plan selection
```

**Credits Bar Display:**
```
┌─────────────────────────────────────────────────────┐
│ 💎 Credits: 1,250 / 5,000  |  Plan: Pro  |  Learn More │
└─────────────────────────────────────────────────────┘
```

**Database Schema:**
```sql
-- User credits tracking
CREATE TABLE user_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  credits_remaining INTEGER NOT NULL DEFAULT 0,
  credits_total INTEGER NOT NULL DEFAULT 0,
  plan_tier TEXT NOT NULL, -- 'free', 'starter', 'pro', 'enterprise'
  billing_cycle TEXT, -- 'monthly', 'annual'
  next_billing_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credits usage log
CREATE TABLE credits_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  credits_used INTEGER NOT NULL,
  action_type TEXT NOT NULL, -- 'chat', 'code_generation', 'file_analysis'
  session_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plans definition
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_name TEXT NOT NULL UNIQUE,
  plan_tier TEXT NOT NULL,
  credits_per_month INTEGER NOT NULL,
  price_monthly DECIMAL(10,2),
  price_annual DECIMAL(10,2),
  features JSONB,
  is_popular BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 3. SETTINGS SYSTEM - THE POWER CENTER

**Location:** `/settings` page

**Components:**
```typescript
app/
├── settings/
│   ├── page.tsx                   // Main settings dashboard
│   ├── behavior/
│   │   └── page.tsx               // Javari behavior customization
│   ├── integrations/
│   │   └── page.tsx               // API integrations management
│   ├── security/
│   │   └── page.tsx               // Keys, tokens, rotation
│   ├── calendar/
│   │   └── page.tsx               // Calendar & scheduling
│   └── reminders/
│       └── page.tsx               // Reminders & notifications
```

**Settings Navigation:**
```
┌─ Settings ─────────────────────────────────────┐
│                                                 │
│  🎭 Behavior & Personality                     │
│     Customize how Javari responds to you       │
│                                                 │
│  🔗 Integrations                               │
│     Connect Gmail, Vercel, Supabase, etc.      │
│                                                 │
│  🔐 Security & API Keys                        │
│     Manage all tokens and credentials          │
│                                                 │
│  📅 Calendar & Scheduling                      │
│     Set up reminders and automation            │
│                                                 │
│  🔔 Reminders & Notifications                  │
│     Configure alerts for tasks                 │
│                                                 │
│  🌐 Language & Localization                    │
│     Choose your preferred language             │
│                                                 │
│  📊 Usage & Analytics                          │
│     View your activity and stats               │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### 3.1 BEHAVIOR CUSTOMIZATION

**Database Schema:**
```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  
  -- Behavior Customization
  response_style TEXT, -- 'beginner', 'intermediate', 'expert'
  code_preference TEXT, -- 'full_replaceable', 'snippets', 'explanations'
  communication_tone TEXT, -- 'professional', 'casual', 'technical'
  
  -- Custom Prompt (User's own instructions)
  custom_system_prompt TEXT,
  
  -- Language
  preferred_language TEXT DEFAULT 'en',
  
  -- UI Preferences
  theme TEXT DEFAULT 'light', -- 'light', 'dark', 'auto'
  sidebar_default_open BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Preset Behavior Templates:**
```typescript
const BEHAVIOR_PRESETS = {
  beginner: {
    name: "Beginner Friendly",
    description: "Explain everything like I'm 12. Use simple terms and examples.",
    systemPrompt: "You are speaking with someone new to development. Use simple language, explain technical terms, provide step-by-step instructions with examples."
  },
  
  professional: {
    name: "Seasoned Professional",
    description: "Just give me the final output. I know what I'm doing.",
    systemPrompt: "You are speaking with an experienced developer. Be concise, technical, and focus on efficient solutions. Skip explanations of basic concepts."
  },
  
  fullCode: {
    name: "Complete Code",
    description: "Always give me full, replaceable code files.",
    systemPrompt: "Always provide complete, production-ready code files. Never use placeholders or partial code. Include all imports, error handling, and types."
  },
  
  custom: {
    name: "Custom",
    description: "Create your own instructions for how Javari should work with you.",
    systemPrompt: "" // User fills this in
  }
};
```

#### 3.2 INTEGRATIONS MANAGEMENT

**Database Schema:**
```sql
CREATE TABLE user_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  
  -- Integration Details
  integration_type TEXT NOT NULL, -- 'vercel', 'supabase', 'gmail', 'github', 'custom'
  integration_name TEXT NOT NULL,
  
  -- Credentials (encrypted)
  api_key TEXT,
  api_secret TEXT,
  access_token TEXT,
  refresh_token TEXT,
  additional_config JSONB,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  connection_status TEXT, -- 'connected', 'disconnected', 'error'
  
  -- Auto-rotation settings
  auto_rotate_keys BOOLEAN DEFAULT false,
  rotation_schedule TEXT, -- 'weekly', 'monthly', 'quarterly'
  last_rotated_at TIMESTAMPTZ,
  next_rotation_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integration activity log
CREATE TABLE integration_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID REFERENCES user_integrations(id),
  user_id UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL, -- 'connected', 'disconnected', 'key_rotated', 'api_call'
  success BOOLEAN,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Supported Integrations:**
```typescript
const INTEGRATIONS = {
  vercel: {
    name: "Vercel",
    description: "Deploy and manage your projects",
    requiredFields: ["apiToken", "teamId"],
    capabilities: ["deploy", "logs", "domains", "environment_variables"]
  },
  
  supabase: {
    name: "Supabase",
    description: "Manage your database and backend",
    requiredFields: ["projectUrl", "anonKey", "serviceRoleKey"],
    capabilities: ["database", "auth", "storage", "edge_functions"]
  },
  
  gmail: {
    name: "Gmail",
    description: "Read and send emails",
    requiredFields: ["oauth_token"],
    capabilities: ["read_email", "send_email", "search"]
  },
  
  github: {
    name: "GitHub",
    description: "Manage repositories and code",
    requiredFields: ["personalAccessToken"],
    capabilities: ["repos", "commits", "pull_requests", "actions"]
  },
  
  stripe: {
    name: "Stripe",
    description: "Payment processing and billing",
    requiredFields: ["secretKey", "webhookSecret"],
    capabilities: ["payments", "subscriptions", "customers"]
  },
  
  custom: {
    name: "Custom Integration",
    description: "Add any API you want Javari to access",
    requiredFields: ["name", "baseUrl", "authType"],
    capabilities: ["custom"]
  }
};
```

#### 3.3 KEY ROTATION SYSTEM

**Automatic Key Rotation:**
```typescript
// Service to automatically rotate keys
class KeyRotationService {
  async rotateKey(integrationId: string) {
    // 1. Generate new key in the service (Vercel, Supabase, etc.)
    // 2. Update the new key in user_integrations table
    // 3. Test the new key
    // 4. If successful, revoke old key
    // 5. Log the rotation in integration_activity
    // 6. Schedule next rotation
  }
  
  async scheduleRotations() {
    // Runs daily via cron job
    // Finds integrations where next_rotation_at <= NOW()
    // Executes rotation
  }
}
```

---

### 4. CALENDAR & REMINDER SYSTEM

**Database Schema:**
```sql
CREATE TABLE user_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  
  -- Reminder Details
  title TEXT NOT NULL,
  description TEXT,
  reminder_type TEXT NOT NULL, -- 'update_app', 'change_code', 'build_site', 'rotate_keys', 'custom'
  
  -- Scheduling
  due_date TIMESTAMPTZ NOT NULL,
  recurrence_rule TEXT, -- 'daily', 'weekly', 'monthly', 'yearly', or cron expression
  
  -- Related Resources
  related_integration_id UUID REFERENCES user_integrations(id),
  related_project TEXT,
  action_url TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'cancelled', 'snoozed'
  completed_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  
  -- Notifications
  notify_email BOOLEAN DEFAULT true,
  notify_in_app BOOLEAN DEFAULT true,
  notification_time INTERVAL DEFAULT '1 day', -- Notify X time before due date
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calendar events (optional)
CREATE TABLE user_calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT false,
  event_type TEXT, -- 'meeting', 'deadline', 'reminder', 'build'
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Reminder Types:**
```typescript
const REMINDER_TYPES = {
  update_app: "Update Application",
  change_code: "Update Code",
  build_site: "Build New Site",
  replace_old: "Replace Old with New",
  rotate_keys: "Rotate API Keys",
  backup: "Backup Data",
  review_costs: "Review Costs",
  check_performance: "Check Performance",
  custom: "Custom Reminder"
};
```

---

### 5. HELP & DOCUMENTATION SYSTEM

**Location:** `/help` page

**Structure:**
```
app/
├── help/
│   ├── page.tsx                   // Help dashboard
│   ├── getting-started/
│   │   └── page.tsx               // Getting started guide
│   ├── features/
│   │   ├── chat/page.tsx          // Chat features
│   │   ├── code-generation/page.tsx
│   │   ├── integrations/page.tsx
│   │   └── reminders/page.tsx
│   ├── settings/
│   │   └── page.tsx               // Settings documentation
│   ├── billing/
│   │   └── page.tsx               // Credits & billing help
│   └── faq/
│       └── page.tsx               // Frequently asked questions
```

**Database Schema:**
```sql
CREATE TABLE documentation_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- Markdown content
  category TEXT NOT NULL,
  tags TEXT[],
  search_keywords TEXT[],
  order_index INTEGER,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User help interactions
CREATE TABLE help_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  page_slug TEXT,
  interaction_type TEXT, -- 'view', 'search', 'helpful', 'not_helpful'
  search_query TEXT,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 6. ASSETS & DOCUMENTS LIBRARY

**Location:** `/assets` page

**Components:**
```typescript
app/
├── assets/
│   ├── page.tsx                   // Assets dashboard
│   ├── documents/
│   │   └── page.tsx               // All documents
│   ├── code-snippets/
│   │   └── page.tsx               // Saved code
│   ├── images/
│   │   └── page.tsx               // Images & media
│   └── exports/
│       └── page.tsx               // Exported files
```

**Database Schema:**
```sql
CREATE TABLE user_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  
  -- Asset Details
  asset_type TEXT NOT NULL, -- 'document', 'code', 'image', 'export'
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT, -- If stored in storage
  content TEXT, -- If text-based
  
  -- Metadata
  file_size INTEGER,
  mime_type TEXT,
  tags TEXT[],
  
  -- Organization
  folder TEXT DEFAULT 'root',
  is_favorite BOOLEAN DEFAULT false,
  
  -- Related
  session_id UUID,
  created_from TEXT, -- 'chat', 'manual_upload', 'export'
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 7. SPLIT-SCREEN SIDEBAR SYSTEM

**Already Built:**
- ✅ `components/split-screen/split-screen-context.tsx`
- ✅ `components/split-screen/Sidebar.tsx`
- ✅ `components/split-screen/SplitScreenLayout.tsx`

**Features:**
- Display code, files, diffs, images, JSON
- Auto-open when Javari finds something important
- Manual toggle button
- Smooth animations
- Responsive design

---

### 8. LANGUAGE SYSTEM

**Supported Languages (Phase 1):**
- English (en)
- Spanish (es)

**Future Languages (Post-Funding):**
- French (fr)
- German (de)
- Portuguese (pt)
- Chinese (zh)
- Japanese (ja)

**Implementation:**
```typescript
// lib/i18n/translations.ts
const translations = {
  en: {
    common: {
      welcome: "Welcome to Javari AI",
      loading: "Loading...",
      save: "Save",
      cancel: "Cancel"
    },
    settings: {
      title: "Settings",
      behavior: "Behavior & Personality",
      integrations: "Integrations"
    }
  },
  
  es: {
    common: {
      welcome: "Bienvenido a Javari AI",
      loading: "Cargando...",
      save: "Guardar",
      cancel: "Cancelar"
    },
    settings: {
      title: "Configuración",
      behavior: "Comportamiento y Personalidad",
      integrations: "Integraciones"
    }
  }
};
```

---

## 🗂️ COMPLETE FILE STRUCTURE

```
javari-ai/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   ├── chat/
│   │   ├── credits/
│   │   ├── integrations/
│   │   ├── reminders/
│   │   └── settings/
│   ├── assets/
│   ├── chat/
│   ├── dashboard/
│   ├── help/
│   ├── plans/
│   ├── settings/
│   └── layout.tsx
│
├── components/
│   ├── credits/
│   ├── help/
│   ├── settings/
│   ├── split-screen/
│   ├── user-profile/
│   └── ui/
│
├── lib/
│   ├── i18n/
│   ├── integrations/
│   ├── reminders/
│   └── utils.ts
│
├── docs/
│   ├── ARCHITECTURE.md (this file)
│   ├── API_DOCUMENTATION.md
│   ├── DEPLOYMENT_GUIDE.md
│   ├── TIMESTAMP_SYSTEM.md
│   └── SESSION_*.md
│
└── public/
    └── assets/
```

---

## 🔄 BUILD PHASES

### Phase 1: Foundation (Current)
- [x] Split-screen sidebar
- [x] Timestamp system
- [ ] User profile system
- [ ] Settings framework
- [ ] Credits bar

### Phase 2: Core Features
- [ ] Behavior customization
- [ ] Integration management
- [ ] Help system
- [ ] Assets library

### Phase 3: Advanced Features
- [ ] Calendar & reminders
- [ ] Key rotation automation
- [ ] Multi-language support
- [ ] Analytics dashboard

### Phase 4: Polish & Optimization
- [ ] Performance optimization
- [ ] Mobile responsiveness
- [ ] Accessibility (WCAG 2.2 AA)
- [ ] Security audit

---

## 📊 SUCCESS METRICS

**Technical:**
- 99.9% uptime
- <200ms response time
- Zero security vulnerabilities
- 100% test coverage on critical paths

**Business:**
- $1M ARR within 14 months
- 95%+ user satisfaction
- <5% churn rate
- 10,000+ active users

**User Experience:**
- NPS score >50
- <2 minutes to first value
- >70% feature adoption
- <1% support ticket rate

═══════════════════════════════════════════════════════════════

**This is the living CR AudioViz AI Bible. Updated continuously as we build.**
