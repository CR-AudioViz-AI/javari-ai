================================================================================
COMPREHENSIVE BUILD-BLOCKER ANALYSIS - REMAINING 6 ORIGINAL TARGET FILES
Generated: 2026-02-23 22:30 EST
================================================================================

BUILD STATUS: ✅ PASSING (14 patches applied, all discovered blockers fixed)
RUNTIME STATUS: 🔴 CRITICAL (6 files will crash at runtime)

================================================================================
FILE 1: app/api/javari/learn-from-docs/route.ts (448 lines)
================================================================================

STATUS: ⚠️ PARTIALLY FIXED - Patch 3 applied module-level removal ONLY

MODULE-LEVEL INITIALIZERS:
✅ Lines 13-18: getSupabase() lazy initializer - PRESENT (GOOD)
✅ Lines 20-24: getOpenAI() lazy initializer - PRESENT (GOOD)

🔴 CRITICAL ISSUE: HANDLERS NOT UPDATED
Lazy initializers exist but 7 functions reference undefined 'supabase'/'openai'

UNDEFINED VARIABLE REFERENCES (will crash at runtime):
1. GET handler (line 120): "await supabase.from..." ❌ ReferenceError
2. learnSingleDoc (lines 159, 353, 371, 389): "supabase..." ❌ 4 crashes
3. learnBatchDocs (line 233): "supabase.from..." ❌ ReferenceError
4. processQueuedDocs (line 295): "supabase.rpc..." ❌ ReferenceError
5. processDocument (lines 344, 353, 371, 389): "openai.embeddings", "supabase..." ❌ 2 crashes
6. getQueueStatus (line 418): "supabase.from..." ❌ ReferenceError

REQUIRED FIX (7 function updates):
- GET handler (line 109): INSERT "const supabase = getSupabase();"
- learnSingleDoc (line 148): INSERT "const supabase = getSupabase();"
- learnBatchDocs (line 222): INSERT "const supabase = getSupabase();"
- processQueuedDocs (line 282): INSERT "const supabase = getSupabase();"
- processDocument (line 338): INSERT "const openai = getOpenAI(); const supabase = getSupabase();"
- getQueueStatus (line 417): INSERT "const supabase = getSupabase();"

RISK LEVEL: 🔴 CRITICAL - Core Javari learning system
FIX COMPLEXITY: MEDIUM (7 functions, systematic updates)
BUILD IMPACT: ✅ Not blocking (already has lazy initializers)
RUNTIME IMPACT: 🔴 CRITICAL - All learning functions crash immediately
ESTIMATED TIME: 10 minutes

================================================================================
FILE 2: app/api/enhancements/route.ts (747 lines)
================================================================================

STATUS: 🔴 NOT FIXED

MODULE-LEVEL INITIALIZERS:
❌ Lines 12-15: const supabase = createClient(...) - MODULE-LEVEL
❌ Line 17: const anthropic = new Anthropic({...}) - MODULE-LEVEL

CLIENT USAGE LOCATIONS (31 total):
SUPABASE (26+ usages):
- POST handler: 158, 178, 188, 198, 204, 215, 232
- GET handler: 267, 285, 297, 312, 330, 347, 360, 374, 386
- PATCH handler: 431, 441, 465, 489, 512, 521, 531, 565, 586, 605, 611, 629, 656, 664, 694, 710, 726
- PUT handler: 565, 586, 605, 611, 629, 656, 664, 694, 710, 726

ANTHROPIC (1 usage):
- analyzeEnhancement function: 52

REQUIRED FIX:
1. REMOVE lines 12-17 (module-level clients)
2. ADD lazy initializers after imports:
   function getSupabase() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || ''); }
   function getAnthropic() { return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }); }
3. UPDATE 5 functions:
   - analyzeEnhancement (line 50): "const anthropic = getAnthropic();"
   - POST handler (line 145): "const supabase = getSupabase();"
   - GET handler (line 260): "const supabase = getSupabase();"
   - PATCH handler (line 420): "const supabase = getSupabase();"
   - PUT handler (line 557): "const supabase = getSupabase();"

RISK LEVEL: 🔴 HIGH - Critical enhancement management system
FIX COMPLEXITY: MEDIUM-HIGH (5 handlers, heavy supabase usage)
BUILD IMPACT: ✅ Not blocking (would only fail if build touches it)
RUNTIME IMPACT: 🔴 CRITICAL - All enhancement operations will fail
ESTIMATED TIME: 15 minutes

================================================================================
FILE 3: app/api/javari/auto-heal/route.ts (375 lines)
================================================================================

STATUS: 🔴 NOT FIXED

MODULE-LEVEL INITIALIZERS:
❌ Lines 19-21: const supabase = createClient(supabaseUrl, supabaseKey) - MODULE-LEVEL
❌ Lines 23-25: const openai = new OpenAI({...}) - MODULE-LEVEL

CLIENT USAGE LOCATIONS:
OPENAI (1 usage):
- analyzeAndFix function: 86

SUPABASE (10+ usages):
- POST handler: 182, 214, 231, 248, 263, 276, 292, 319, 328, 337

REQUIRED FIX:
1. REMOVE lines 19-25 (module-level clients + env vars)
2. ADD lazy initializers:
   function getSupabase() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!); }
   function getOpenAI() { return new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' }); }
3. UPDATE 2 functions:
   - analyzeAndFix (line 55): "const openai = getOpenAI();"
   - POST handler (line 151): "const supabase = getSupabase();"

RISK LEVEL: 🟡 MEDIUM - Auto-healing is auxiliary feature
FIX COMPLEXITY: LOW (2 functions, straightforward)
BUILD IMPACT: ✅ Not blocking
RUNTIME IMPACT: 🟡 HIGH - Auto-heal features crash when triggered
ESTIMATED TIME: 5 minutes

================================================================================
FILE 4: app/api/javari/conversations/summary/route.ts (184 lines)
================================================================================

STATUS: 🔴 NOT FIXED

MODULE-LEVEL INITIALIZERS:
❌ Lines 18-20: const supabase = createClient(supabaseUrl, supabaseKey) - MODULE-LEVEL
❌ Lines 22-24: const openai = new OpenAI({...}) - MODULE-LEVEL

EXPORT CONFIG:
⚠️ Line 15: export const runtime = 'edge' - PRESERVE THIS

CLIENT USAGE LOCATIONS:
SUPABASE:
- POST handler: 43 (fetch conversation)

OPENAI:
- POST handler: Likely used for summary generation

REQUIRED FIX:
1. REMOVE lines 18-24 (module-level clients + env vars)
2. ADD lazy initializers:
   function getSupabase() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!); }
   function getOpenAI() { return new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' }); }
3. UPDATE 1 function:
   - POST handler (line 30): "const supabase = getSupabase(); const openai = getOpenAI();"

RISK LEVEL: 🟡 MEDIUM
FIX COMPLEXITY: LOW (1 handler, simple)
BUILD IMPACT: ✅ Not blocking
RUNTIME IMPACT: 🟡 MEDIUM - Conversation summaries fail
ESTIMATED TIME: 5 minutes

================================================================================
FILE 5: app/api/javari/stock-analysis/route.ts (295 lines)
================================================================================

STATUS: 🔴 NOT FIXED

MODULE-LEVEL INITIALIZERS:
❌ Lines 18-20: const openai = new OpenAI({...}) - MODULE-LEVEL
❌ Lines 23-26: const supabase = createClient(...) - MODULE-LEVEL

EXPORT CONFIG:
⚠️ Line 14: export const runtime = 'edge' - PRESERVE THIS
⚠️ Line 15: export const dynamic = 'force-dynamic' - PRESERVE THIS

CLIENT USAGE LOCATIONS:
OPENAI:
- Likely POST handler for stock analysis AI

SUPABASE:
- Likely POST handler for storing/retrieving analysis

REQUIRED FIX:
1. REMOVE lines 18-26 (module-level clients)
2. ADD lazy initializers:
   function getOpenAI() { return new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' }); }
   function getSupabase() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!); }
3. UPDATE handler(s):
   - Likely POST handler: "const openai = getOpenAI(); const supabase = getSupabase();"

RISK LEVEL: 🟡 MEDIUM - Stock analysis is auxiliary feature
FIX COMPLEXITY: LOW (likely 1 handler)
BUILD IMPACT: ✅ Not blocking
RUNTIME IMPACT: 🟡 MEDIUM - Stock analysis crashes
ESTIMATED TIME: 5 minutes

================================================================================
FILE 6: app/api/tickets/route.ts (644 lines)
================================================================================

STATUS: 🔴 NOT FIXED

MODULE-LEVEL INITIALIZERS:
❌ Lines 12-15: const supabase = createClient(...) - MODULE-LEVEL
❌ Line 17: const anthropic = new Anthropic({...}) - MODULE-LEVEL

CLIENT USAGE LOCATIONS:
ANTHROPIC:
- analyzeAndFix function: 52+ (AI ticket analysis)

SUPABASE:
- Multiple handlers (ticket CRUD operations)

REQUIRED FIX:
1. REMOVE lines 12-17 (module-level clients)
2. ADD lazy initializers:
   function getSupabase() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || ''); }
   function getAnthropic() { return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }); }
3. UPDATE functions:
   - analyzeAndFix function: "const anthropic = getAnthropic();"
   - Handler(s) using supabase: "const supabase = getSupabase();"

RISK LEVEL: 🔴 HIGH - Critical support ticket system
FIX COMPLEXITY: MEDIUM (multiple handlers)
BUILD IMPACT: ✅ Not blocking
RUNTIME IMPACT: 🔴 HIGH - Ticket system crashes
ESTIMATED TIME: 10 minutes

================================================================================
PRIORITY RANKING (By Risk × Impact)
================================================================================

TIER 1 - CRITICAL (Fix First):
1. learn-from-docs/route.ts - Core Javari learning, 7 broken functions
2. enhancements/route.ts - Critical feature, 5 handlers broken
3. tickets/route.ts - Support system, multiple handlers broken

TIER 2 - HIGH (Fix Second):
4. auto-heal/route.ts - Auto-healing, 2 functions broken

TIER 3 - MEDIUM (Fix Third):
5. conversations/summary/route.ts - Conversation features, 1 handler
6. stock-analysis/route.ts - Auxiliary feature, 1 handler

================================================================================
EXECUTION STRATEGY
================================================================================

RECOMMENDED APPROACH: Sequential fixes in priority order

BATCH 1 (Tier 1 - ~40 minutes):
- Patch 15: learn-from-docs handlers (7 updates)
- Patch 16: enhancements (remove + 5 handlers)
- Patch 17: tickets (remove + handlers)

BATCH 2 (Tier 2-3 - ~15 minutes):
- Patch 18: auto-heal (remove + 2 handlers)
- Patch 19: conversations/summary (remove + 1 handler)
- Patch 20: stock-analysis (remove + 1 handler)

TOTAL ESTIMATED TIME: ~55 minutes for all 6 files

================================================================================
CURRENT STATUS SUMMARY
================================================================================

✅ BUILD: PASSING (251 pages generated successfully)
🔴 RUNTIME: 6 files will crash when functions are called
⚠️ RISK: Core Javari features are broken at runtime

RECOMMENDATION: Fix all 6 files to restore runtime stability
