// app/api/javari/ingest-roadmap/route.ts
// Javari AI — MASTER ECOSYSTEM ROADMAP v4.0
// Purpose: Seeds the complete CR AudioViz AI ecosystem into roadmap_tasks.
//          88 tasks, 10 phases, full platform. Safe to re-run (title-dedup).
// Date: 2026-03-09 — Henderson Standard Full Ecosystem Delivery

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function slugify(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9\s-]/g,"").trim()
    .replace(/\s+/g,"-").replace(/-+/g,"-").slice(0,48);
}
function taskId(phase: string, title: string, idx: number): string {
  return `rm-${phase}-${slugify(title)}-${String(idx).padStart(3,"0")}`;
}

type Task = { title: string; description: string };
type Phase = { phase: string; priority: number; tasks: Task[] };

const ROADMAP: Phase[] = [
  {
    "phase": "revenue_foundation",
    "priority": 1,
    "tasks": [
      {
        "title": "Wire Stripe Checkout to All Pricing Tiers",
        "description": "Connect Stripe checkout sessions to Free/Creator/Pro/Enterprise tiers on javariai.com. Handle success/cancel redirects, webhook for payment confirmation, and auto-provision subscription in Supabase users table."
      },
      {
        "title": "Build User Onboarding Flow",
        "description": "Post-signup 5-step onboarding: (1) choose use case, (2) name their first project, (3) pick avatar, (4) run first AI task, (5) celebrate first win. Track completion in user_onboarding_state table. Skip option available."
      },
      {
        "title": "Build Credits Purchase UI",
        "description": "Credits store page: credit bundle options ($5=500cr, $20=2500cr, $50=7000cr, $100=15000cr), Stripe + PayPal checkout, instant credit grant on webhook, purchase history, and balance widget in nav."
      },
      {
        "title": "Build Subscription Management Portal",
        "description": "Account billing page: current plan display, upgrade/downgrade flow with proration preview, cancel with retention offer, invoice history download, and Stripe customer portal integration."
      },
      {
        "title": "Build Revenue Dashboard for Admin",
        "description": "Admin MRR dashboard: total revenue, MRR/ARR trend, churn rate, LTV per tier, credit purchase volume, daily signups vs conversions. All data from Stripe webhooks + Supabase."
      },
      {
        "title": "Implement Affiliate Program Tracking",
        "description": "Affiliate system: unique referral links per user, 20% recurring commission for 12 months, affiliate dashboard with click/signup/revenue tracking, monthly payout via Stripe Connect, and affiliate signup page."
      },
      {
        "title": "Build White-Label Enterprise Portal",
        "description": "Enterprise white-label: custom domain support, logo/color theming, SSO configuration, dedicated admin console, custom contract upload, SLA dashboard, and sales contact flow."
      }
    ]
  },
  {
    "phase": "javari_ai_core",
    "priority": 2,
    "tasks": [
      {
        "title": "Build AvatarOS \u2014 Javari Avatar Creator",
        "description": "Full avatar creation system: AI face generation with style controls (photorealistic/cartoon/anime/brand), voice selection with preview, avatar naming and backstory, personality sliders (formal/casual/energetic/calm), export as PNG/SVG/video loop/GIF. Avatars power all Javari AI interactions."
      },
      {
        "title": "Build Avatar Marketplace",
        "description": "Users can sell custom avatars in the marketplace. Listing flow, pricing, preview card, purchase/download, creator earnings tracked. Premium pre-built avatars by Cindy's design direction."
      },
      {
        "title": "Build Javari Chat Polish \u2014 Real Conversation UI",
        "description": "Upgrade /javari chat: streaming responses, message reactions, conversation branching, pin messages, conversation folders/labels, search history, export conversation as PDF/Markdown, and shareable conversation links."
      },
      {
        "title": "Build Multi-Agent Collaboration UI",
        "description": "Visual multi-agent workspace: side-by-side agent panels, real-time activity streams, agent assignment UI (Architect/Builder/Reviewer/Documenter), progress bars per agent, merge results view."
      },
      {
        "title": "Build Javari Voice Mode",
        "description": "Voice input/output for Javari: Web Speech API for input, ElevenLabs/Cartesia for avatar voice output, push-to-talk mode, always-on mode (with permission), voice activity detection, transcript display."
      },
      {
        "title": "Build MemoryOS User Profile Intelligence",
        "description": "Persistent user memory: extract preferences/goals/projects from conversations, store in user_memories table, surface in every new chat as context. User can view/edit/delete memories. Memory badge shows count."
      },
      {
        "title": "Build Javari Mobile PWA",
        "description": "Progressive Web App: offline mode with cached conversations, install prompt, push notifications for task completions, mobile-optimized chat UI, gesture navigation, home screen icon with splash screen."
      }
    ]
  },
  {
    "phase": "creator_tools_suite",
    "priority": 3,
    "tasks": [
      {
        "title": "Build AI Copywriter \u2014 Full Production Tool",
        "description": "Complete AI copywriter: 40+ copy templates (landing page, email, social, ad, product description, press release), tone selector, brand voice training, SEO scoring, export to DOCX/PDF, save to projects."
      },
      {
        "title": "Build Logo Generator Pro",
        "description": "AI logo generation: style selector (minimal/bold/playful/corporate), color palette picker, icon style (abstract/lettermark/mascot/wordmark), generate 4 variations, SVG + PNG export, brand kit bundler."
      },
      {
        "title": "Build Presentation Maker",
        "description": "AI slide deck builder: topic input, slide count selector, theme picker (10 professional themes), AI content generation per slide, drag-drop editor, speaker notes, export to PPTX/PDF, embed charts."
      },
      {
        "title": "Build Resume Builder Pro",
        "description": "AI resume builder: import LinkedIn/existing resume, ATS-optimized formatting, job description matching with keyword highlighting, 12 professional templates, cover letter generator, export to PDF/DOCX."
      },
      {
        "title": "Build Social Media Content Studio",
        "description": "Social content factory: platform-specific formats (Instagram/LinkedIn/Twitter/TikTok/Pinterest), AI caption generator, hashtag optimizer, post scheduler with calendar view, analytics integration, bulk generation mode."
      },
      {
        "title": "Build PDF Tools Suite",
        "description": "Complete PDF toolkit: merge, split, compress, password protect/unlock, convert to/from Word/Excel/PowerPoint, OCR scanned PDFs, fill forms, add watermarks, e-signature fields."
      },
      {
        "title": "Build Email Template Studio",
        "description": "Email template builder: drag-drop designer, 50+ starter templates, merge tag support, mobile preview, HTML export, direct ESP integrations (Mailchimp/Klaviyo/SendGrid), A/B variant generator."
      },
      {
        "title": "Build Video Script Writer",
        "description": "Video script generator: YouTube/TikTok/Reel/Course formats, hook library, scene breakdown, teleprompter mode, voiceover timing estimator, thumbnail concept generator, SEO title/description."
      },
      {
        "title": "Build Brand Color Palette Generator",
        "description": "Brand color system: AI palette generation from logo/mood/industry, color psychology notes, accessibility contrast checker, CSS variables export, Figma/Sketch compatible, brand guide PDF generator."
      },
      {
        "title": "Build Background Remover + Image Studio",
        "description": "Image processing suite: background removal (AI-powered), background replacement, image enhancement, upscaling, format conversion, batch processing, watermark remover, product photo studio mode."
      },
      {
        "title": "Build Voice Transcriber + AI Notes",
        "description": "Audio transcription: upload MP3/MP4/WAV, live microphone recording, speaker diarization, punctuation restoration, AI summary + action items extraction, export to Notion/Google Docs/PDF."
      },
      {
        "title": "Build Document Intelligence \u2014 Summarizer",
        "description": "Document AI: PDF/DOCX upload, executive summary generation, key points extraction, Q&A mode against document, comparison across multiple documents, translation to 50 languages, citation export."
      }
    ]
  },
  {
    "phase": "social_impact_modules",
    "priority": 4,
    "tasks": [
      {
        "title": "Build Javari First Responders Portal \u2014 Full",
        "description": "Complete first responder platform: incident report generator, shift scheduling AI assistant, equipment tracking, training certification manager, mental health check-in (anonymous), PTSD resource hub, family communication tools, grant application assistant for department funding. Mission: serve those who serve us."
      },
      {
        "title": "Build Javari Veterans Connect \u2014 Full",
        "description": "Complete veterans platform: DD-214 benefits decoder, VA claim status tracker, transition career coach (civilian job matching), housing resource finder by state, mental health crisis line integration, business formation wizard for veteran-owned businesses, networking hub with other vets, storytelling module to capture service stories. Mission: honor service, build futures."
      },
      {
        "title": "Build Javari Faith Communities Platform",
        "description": "Complete faith platform: sermon preparation AI assistant, bulletin/newsletter generator, volunteer coordination, event management, giving/tithing dashboard, small group management, prayer request wall (private/public), ministry resource library, livestream integration helper. Mission: strengthen communities of faith."
      },
      {
        "title": "Build Javari Animal Rescue Network",
        "description": "Complete animal rescue platform: pet listing with AI-written bios, adoption application processor, foster family matching, medical record tracker, fundraising campaign builder, social media content for featured animals, volunteer scheduling, intake/outcome statistics dashboard. Mission: every animal finds a home."
      },
      {
        "title": "Build Javari Nonprofits Hub",
        "description": "Nonprofit management suite: grant writing assistant with federal database search, donor management CRM, impact reporting generator, board meeting AI assistant, volunteer hours tracker, 990 form helper, fundraising campaign builder, social media content calendar."
      },
      {
        "title": "Build Grant Application Assistant",
        "description": "Federal and private grant finder: search $600M+ opportunity database, eligibility checker, narrative generator with success rate optimization, budget justification builder, submission deadline tracker, multi-grant portfolio manager, success story library."
      },
      {
        "title": "Build Javari Education Platform",
        "description": "Education suite: curriculum planner, lesson plan generator, student assessment creator, IEP/504 accommodation assistant, parent communication templates, classroom newsletter, substitute teacher packet generator, professional development tracker."
      },
      {
        "title": "Build Javari Health Wellness Coach",
        "description": "Health coaching platform: symptom journal (NOT medical advice \u2014 always disclaimer), wellness goal tracker, medication reminder builder, doctor visit prep assistant, mental health mood tracker, sleep quality journal, nutrition log with AI suggestions, insurance claim helper."
      },
      {
        "title": "Build Javari Family Hub",
        "description": "Family management platform: shared family calendar, chore chart builder, meal planner with shopping list, homework helper (grade-appropriate), family memory book, emergency contact card generator, college application assistant, family constitution/values document."
      }
    ]
  },
  {
    "phase": "marketplace_ecosystem",
    "priority": 5,
    "tasks": [
      {
        "title": "Build MarketplaceOS \u2014 Complete Platform",
        "description": "Full marketplace: digital products (templates/prompts/tools), services (AI-assisted gigs), avatar packs, training courses, plugin modules. Seller onboarding, listing wizard, Stripe Connect payouts, review system, featured placement auction, affiliate tracking per listing, creator analytics dashboard."
      },
      {
        "title": "Build Javari Cards \u2014 Tarot + Vision System",
        "description": "Complete Javari Cards: tarot deck with AI interpretation engine, oracle cards, vision boards, daily card pull with personalized reading, life map generator, intention setting wizard, manifestation journal, card collection gallery, custom deck creator, gifting flow."
      },
      {
        "title": "Build Javari Spirits \u2014 Full Platform",
        "description": "Complete spirits platform: whiskey/wine/craft beer/cocktail database, AI taste profile engine, personalized recommendations, collection tracker, tasting notes journal, food pairing suggestions, event pairing planner, affiliate links to 300+ alcohol retailers, community reviews."
      },
      {
        "title": "Build Javari Music Studio",
        "description": "AI music platform: lyrics generator (genre/mood/theme), chord progression suggester, song structure planner, beat name generator, music bio writer, Spotify pitch deck builder, press kit generator, playlist curator for events, sync licensing guide."
      },
      {
        "title": "Build Javari Games Hub",
        "description": "Complete games platform: curated game library by category/mood/players, AI game recommender based on preferences, tournament bracket builder, game night planner, review system, trivia generator, party game AI host mode, leaderboards."
      },
      {
        "title": "Build Javari Entertainment Platform",
        "description": "Entertainment hub: movie/TV recommendation engine, watch party planner, review and rating system, watch history tracker, binge schedule optimizer, discussion community, content calendar for cord-cutters, streaming service comparison."
      },
      {
        "title": "Build Javari Travel Planner",
        "description": "AI travel platform: itinerary generator by budget/duration/style, flight and hotel search integration, packing list builder, travel document checklist, local restaurant/activity recommendations, group trip coordinator, travel journal, safety information by destination."
      },
      {
        "title": "Build Javari Realty Intelligence",
        "description": "Real estate platform: neighborhood analysis, property valuation estimator, first-time buyer guide, mortgage calculator with AI explanation, moving checklist, home maintenance tracker, rental market analyzer, investment property calculator, agent finder integration."
      },
      {
        "title": "Build Javari Shopping Assistant",
        "description": "Smart shopping platform: product comparison engine, deal alert system, price history tracker, AI gift recommender, wishlist manager, budget tracker, ethical shopping guide, local vs online optimizer, return policy analyzer."
      }
    ]
  },
  {
    "phase": "business_tools",
    "priority": 6,
    "tasks": [
      {
        "title": "Build Javari Business Formation Wizard",
        "description": "Complete business formation: LLC/Corp/Sole Prop comparison, state-by-state filing guide, name availability checker, EIN application guide, operating agreement generator, business bank account checklist, registered agent finder, annual compliance reminder system."
      },
      {
        "title": "Build Javari Legal Document Suite",
        "description": "Legal document platform: NDA generator, service agreement templates, privacy policy + terms of service generators, independent contractor agreement, cease and desist, DMCA takedown, bill of sale, lease agreement. Always includes 'consult an attorney' disclaimer."
      },
      {
        "title": "Build Javari Invoice + Finance Manager",
        "description": "Business finance suite: professional invoice generator, recurring invoice scheduler, expense tracker, profit/loss estimator, contractor payment tracker, mileage log, tax deduction finder, quarterly estimated tax calculator, financial health score."
      },
      {
        "title": "Build Javari HR Workforce Tools",
        "description": "HR platform: job description generator, offer letter templates, employee handbook builder, performance review framework, termination checklist, onboarding checklist, wage calculator, PTO tracker, org chart builder."
      },
      {
        "title": "Build Javari Marketing Intelligence",
        "description": "Marketing platform: competitor analysis, ad copy generator (Facebook/Google/LinkedIn), landing page copy optimizer, email campaign planner, SEO keyword research, content calendar, influencer outreach templates, PR pitch generator, brand audit tool."
      },
      {
        "title": "Build Javari Supply Chain Manager",
        "description": "Supply chain tools: vendor comparison, purchase order generator, inventory tracking, lead time calculator, supplier communication templates, cost-of-goods tracker, quality control checklist, import/export guide, disruption risk assessor."
      },
      {
        "title": "Build Javari Construction Project Manager",
        "description": "Construction tools: project timeline builder, materials estimator, subcontractor bid comparison, safety compliance checklist, change order tracker, lien waiver generator, permit application guide, project photo journal, client progress report builder."
      },
      {
        "title": "Build Javari Insurance Advisor",
        "description": "Insurance guidance platform: coverage needs analyzer (home/auto/life/business), policy comparison guide, claim documentation assistant, renewal reminder system, gap analysis tool, broker finder by specialty. Always includes licensed professional disclaimer."
      },
      {
        "title": "Build Javari Cover Letter + Job Search Suite",
        "description": "Job search platform: AI cover letter generator matched to job description, interview prep coach, salary negotiation scripts, LinkedIn profile optimizer, networking email templates, 30-60-90 day plan builder, follow-up sequence generator, job application tracker."
      }
    ]
  },
  {
    "phase": "community_and_engagement",
    "priority": 7,
    "tasks": [
      {
        "title": "Build CRAIverse \u2014 Virtual World Foundation",
        "description": "Virtual world platform: user avatar system with customization, virtual rooms/spaces, community hubs by interest/geography, virtual events hosting, digital land/space ownership, avatar-to-avatar interaction, community announcements, leaderboards, achievement badges."
      },
      {
        "title": "Build Javari Social Network",
        "description": "Creator social network: user profiles with portfolio, follow/following system, activity feed, post types (text/image/video/tool-output), reactions, comments, DMs, community groups, trending content, creator spotlight, share-to-external."
      },
      {
        "title": "Build Community Leaderboards + Gamification",
        "description": "Engagement system: XP points for platform actions, level-up system with perks, weekly leaderboards by category, achievement badges (creator/helper/builder/etc), streak tracking, community challenges, referral rewards, VIP status tiers."
      },
      {
        "title": "Build Javari Partner Network",
        "description": "Partner ecosystem: agency partner tiers (Referral/Silver/Gold/Platinum), co-marketing portal, white-label license management, partner training certification, co-sell tracking, MDF request system, partner directory for clients to find help."
      },
      {
        "title": "Build Javari News Intelligence Platform",
        "description": "AI-powered news: multi-source aggregator, bias comparison (same story from left/center/right sources), AI summary, personalized topic feed, fact-check integration, newsletter builder from curated news, daily briefing email, breaking news alerts."
      },
      {
        "title": "Build Javari Scrapbook \u2014 Memory Keeper",
        "description": "Digital memory platform: photo/video/document upload, AI-generated captions and stories from uploads, timeline view, memory book PDF export, collaborative family albums, annual recap generator, milestone celebration cards, private sharing with family."
      },
      {
        "title": "Build Javari Outdoors + Adventure Planner",
        "description": "Outdoors platform: trail finder and trip planner, gear checklist generator, weather integration, group coordination tools, trip journal with photo mapping, Leave No Trace guide, permit application guide, emergency contact plan, wildlife identification helper."
      }
    ]
  },
  {
    "phase": "platform_infrastructure",
    "priority": 8,
    "tasks": [
      {
        "title": "Build Universal Notification System",
        "description": "NotificationOS: in-app notifications (bell icon), email notifications via Resend, SMS via Twilio (opt-in), push notifications via Web Push, notification preferences center, digest mode, real-time updates via Supabase Realtime, admin broadcast capability."
      },
      {
        "title": "Build Search + Discovery Engine",
        "description": "Platform-wide search: full-text search across tools/apps/marketplace/docs, AI-powered semantic search, search suggestions, recent searches, popular searches, filter by category/type/price, keyboard shortcut (Cmd+K), instant results panel."
      },
      {
        "title": "Build Javari API \u2014 Public Developer Access",
        "description": "Public API platform: REST API for all major Javari capabilities, API key management dashboard, rate limiting by tier, interactive API docs (Swagger/Postman), SDK generator for JS/Python, webhook subscriptions, API usage analytics."
      },
      {
        "title": "Build Mobile Apps \u2014 iOS and Android",
        "description": "Native mobile: React Native app with full platform access, biometric auth, offline mode, push notifications, camera integration for image tools, audio recording for transcriber, widget for quick credit balance, app store optimization."
      },
      {
        "title": "Create Platform Knowledge Base + Help Center",
        "description": "Self-service support: 200+ help articles organized by module, video walkthrough library, AI-powered chat support (Javari answers help questions), community forum, changelog with release notes, status page for uptime monitoring, ticket submission for complex issues."
      },
      {
        "title": "Build Analytics and Usage Intelligence",
        "description": "User analytics: session tracking, feature usage heatmaps, funnel analysis (signup\u2192first tool\u2192paid), cohort retention curves, A/B test framework, credit consumption patterns, most-used tools by tier, churn prediction signals."
      },
      {
        "title": "Build Javari Webhook System",
        "description": "Webhook platform: subscribe to platform events (user.signup/payment.complete/task.done/etc), delivery with retry logic, payload signing for security, webhook log viewer, test endpoint, per-endpoint rate limits."
      },
      {
        "title": "Build Admin Control Tower Expansion",
        "description": "Super admin dashboard: user management (search/ban/impersonate), credit grant/revoke, feature flag management, A/B test control, system announcements, bulk email to segments, cost analysis by model/feature, abuse detection queue."
      },
      {
        "title": "Build Javari Verify \u2014 Identity and Trust System",
        "description": "Trust layer: email verification enforcement, phone number verification, business verification for enterprise accounts, creator verification badge, human/bot detection, fraud scoring on signups, IP reputation checking."
      }
    ]
  },
  {
    "phase": "content_and_media",
    "priority": 9,
    "tasks": [
      {
        "title": "Build Javari TV \u2014 Streaming Content Hub",
        "description": "Streaming platform: curated educational video library, creator-uploaded content, Javari AI tutorial series, live event streaming, VOD with chapter markers, playlist builder, continue watching, subscriber-only content gate, monetization for creators."
      },
      {
        "title": "Build Javari Movie Database + Reviews",
        "description": "Film platform: movie/show database with AI-enriched metadata, personal ratings and reviews, watchlist manager, AI recommendation engine, social sharing of reviews, themed collections (e.g. 'Best Movies for Entrepreneurs'), trivia integration."
      },
      {
        "title": "Build Javari Video Analysis Tool",
        "description": "Video intelligence: upload video for AI analysis, transcript generation, content summary, sentiment analysis, key moment extraction, compliance checking, thumbnail generation, clip extraction, chapter marker suggestion."
      },
      {
        "title": "Build Javari Documentation Hub",
        "description": "Living docs platform: all platform documentation AI-searchable, auto-generated from code comments, version history, community contributions, AI doc writer that generates from natural language description, export to PDF/Confluence/Notion."
      },
      {
        "title": "Build Javari Newsletter Builder",
        "description": "Newsletter platform: drag-drop email builder, AI content generation for sections, subscriber list management, send scheduling, open/click analytics, automated sequences, RSS-to-newsletter, curated content sourcing from saved articles."
      }
    ]
  },
  {
    "phase": "specialty_verticals",
    "priority": 10,
    "tasks": [
      {
        "title": "Build Javari Fitness + Wellness Platform",
        "description": "Fitness platform: workout plan generator (home/gym/travel), nutrition plan builder, progress photo journal, PR tracker, recovery planner, supplement guide, habit tracker, accountability partner matching, challenge creator."
      },
      {
        "title": "Build Javari Dating Intelligence Platform",
        "description": "Relationship platform: profile bio optimizer, conversation starter generator, date idea planner by city/budget, relationship goal tracker, compatibility questionnaire, breakup recovery guide, communication style analyzer."
      },
      {
        "title": "Build Javari Home Services Marketplace",
        "description": "Home services: contractor finder by specialty/ZIP, project cost estimator, service request generator with scope of work, review system, seasonal maintenance checklist, DIY vs hire decision guide, warranty tracker."
      },
      {
        "title": "Build Javari Property Management Hub",
        "description": "Property management: lease agreement generator, rent collection tracker, maintenance request system, tenant screening checklist, property expense tracker, ROI calculator, eviction process guide (with legal disclaimer), utility management."
      },
      {
        "title": "Build Javari Legal Docs + Contracts",
        "description": "Legal document library: 100+ legal templates across 15 categories, state-specific variations, plain-English explanations, fill-in fields with AI suggestions, e-signature integration (DocuSign API), storage and version history, attorney referral for complex matters."
      },
      {
        "title": "Build Javari Manufacturing Tools",
        "description": "Manufacturing platform: production planning assistant, BOM (bill of materials) generator, quality control checklist builder, ISO compliance guide, supplier evaluation matrix, capacity planning calculator, lean manufacturing templates, safety compliance tracker."
      },
      {
        "title": "Build Javari Card Vault \u2014 Collectibles Manager",
        "description": "Collectibles platform: card collection tracker (TCG/sports/vintage), AI-powered card identification from photo, price lookup integration, collection value calculator, grading submission guide, trade matching, set completion tracker, insurance documentation generator."
      },
      {
        "title": "Build Javari MTG Manager",
        "description": "Magic: The Gathering platform: deck builder with AI suggestions, card database search, collection tracker, price alert system, draft simulator, tournament prep assistant, trade value calculator, format legality checker."
      },
      {
        "title": "Build Javari Vinyl Vault \u2014 Record Collector",
        "description": "Vinyl platform: collection catalog, condition grader, value tracker, Discogs integration, want list manager, listening log, genre explorer, pressing variation guide, seller comparison, storage recommendation."
      },
      {
        "title": "Build Javari Watch Works \u2014 Horology Platform",
        "description": "Watch platform: collection tracker with AI identification, movement database, service history log, value trend tracker, authentication guide, strap pairing suggestions, brand comparison, auction watch integration."
      },
      {
        "title": "Build Javari Militaria Vault",
        "description": "Military collectibles platform: item catalog with AI identification, provenance documentation, authenticity verification guide, historical context enrichment, valuation estimator, museum donation guide, veteran story capture alongside items."
      },
      {
        "title": "Build Javari Pets \u2014 Pet Care Platform",
        "description": "Pet platform: health record tracker, vaccination reminder, vet finder by specialty, pet product recommendation engine, adoption listing integration, training guide by breed, food comparison, pet insurance guide, lost pet alert system."
      },
      {
        "title": "Build Javari Disney Vault \u2014 Fan Platform",
        "description": "Disney fan platform: collection tracker (pins/figures/art/memorabilia), park visit planner with AI optimization, character encounter tracker, Disney history encyclopedia, limited release alert system, community trading board."
      },
      {
        "title": "Build Javari Nonprofits Resource Hub",
        "description": "Nonprofit-specific tools: 501(c)(3) application guide, board resolution templates, volunteer management, donor acknowledgment letters, annual report generator, social media content for awareness campaigns, grant calendar with deadline tracking."
      }
    ]
  }
];

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-ingest-secret");
  if (secret !== "henderson-standard-2026") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let idx = 0;
  const allRows: Array<{
    id: string; phase_id: string; title: string; description: string;
    depends_on: string[]; status: "pending"; source: string;
    priority: number; updated_at: number;
  }> = [];

  const sorted = [...ROADMAP].sort((a, b) => a.priority - b.priority);
  for (const phase of sorted) {
    for (const t of phase.tasks) {
      allRows.push({
        id: taskId(phase.phase, t.title, idx++),
        phase_id: phase.phase,
        title: t.title,
        description: t.description,
        depends_on: [] as string[],
        status: "pending" as const,
        source: "master_roadmap_v4",
        priority: phase.priority,
        updated_at: Date.now(),
      });
    }
  }

  const { data: existing } = await supabase.from("roadmap_tasks").select("title");
  const existingTitles = new Set((existing ?? []).map((r: { title: string }) => r.title));
  const toInsert = allRows.filter(r => !existingTitles.has(r.title));

  const inserted: string[] = [];
  const failed: string[] = [];

  for (let i = 0; i < toInsert.length; i += 10) {
    const batch = toInsert.slice(i, i + 10);
    const { error } = await supabase.from("roadmap_tasks").upsert(batch, {
      onConflict: "id", ignoreDuplicates: false,
    });
    if (error) { batch.forEach(r => failed.push(`${r.title}: ${error.message}`)); }
    else { batch.forEach(r => inserted.push(r.title)); }
  }

  return NextResponse.json({
    ok: true,
    version: "master_roadmap_v4.0",
    message: `Henderson Standard: ${inserted.length} tasks queued. Your Story. Our Design.`,
    total_tasks: allRows.length,
    inserted: inserted.length,
    skipped: allRows.length - toInsert.length,
    failed: failed.length,
    failed_items: failed.slice(0, 5),
    phases: sorted.map(p => ({
      phase: p.phase, priority: p.priority, total: p.tasks.length,
    })),
  });
}

export async function GET() {
  const { data, error } = await supabase
    .from("roadmap_tasks").select("phase_id, status").order("phase_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const summary: Record<string, Record<string, number>> = {};
  let total = 0; let completed = 0;
  for (const row of data ?? []) {
    total++;
    if (row.status === "completed") completed++;
    if (!summary[row.phase_id]) summary[row.phase_id] = {};
    summary[row.phase_id][row.status] = (summary[row.phase_id][row.status] ?? 0) + 1;
  }
  return NextResponse.json({
    total, completed,
    completion_pct: total > 0 ? Math.round((completed / total) * 100) : 0,
    phases: summary,
  });
}
