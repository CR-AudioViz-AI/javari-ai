// app/api/javari/ingest-roadmap/route.ts
// Javari AI — Master Ecosystem Roadmap Ingest
// Purpose: Seeds ALL 102 ecosystem tasks across 10 phases into roadmap_tasks.
// Safe to re-run — skips existing tasks by title dedup.
// Date: 2026-03-09 — Henderson Standard Full Ecosystem Delivery

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g,"").trim()
    .replace(/\s+/g,"-").replace(/-+/g,"-").slice(0,48);
}

function taskId(phase: string, title: string, idx: number): string {
  return `rm-${phase}-${slugify(title)}-${String(idx).padStart(2,"0")}`;
}

const ROADMAP = [
  {
    phase: "revenue_foundation", priority: 1,
    tasks: [
      { title: "Stripe Checkout + Subscription Flow end-to-end", description: "Wire Stripe checkout for all 4 tiers (Free/Creator/Pro/Enterprise). Webhooks for subscription.created, updated, deleted, invoice.paid, invoice.payment_failed. Proration logic. Supabase user_subscriptions table sync. Test in Stripe test mode then promote to live." },
      { title: "PayPal Subscription Billing complete integration", description: "PayPal subscription plans for all 4 tiers mirroring Stripe. Webhook handlers. Vault tokenization for recurring billing. Reconciliation logic with Stripe for duplicate prevention. Admin dashboard showing PayPal vs Stripe revenue split." },
      { title: "CreditsOS full implementation", description: "Universal credit currency: $1=100 credits. Purchase flows for 500/1000/5000/10000 credit packs via Stripe+PayPal. Per-action deduction table. Low-balance alerts at 10% remaining. Admin grant/revoke endpoint. Credits never expire on paid plans. Free plan: 50 credits/month reset." },
      { title: "Pricing page javariai.com with live checkout", description: "Beautiful pricing page at javariai.com/pricing. 4 tiers with feature comparison matrix. Toggle monthly/annual (annual saves 20%). Trust signals: 1000+ creators, 4.9 stars, SOC2 badge. CTA goes directly to Stripe checkout. Mobile-first. A/B test headline copy." },
      { title: "Subscription management portal for users", description: "Account settings page: current plan display, usage meters, upgrade/downgrade flow, billing history with invoice PDFs, cancel subscription with retention flow (offer 1 month free before cancel), payment method management." },
      { title: "Free trial 14-day for Creator and Pro tiers", description: "14-day free trial: no credit card required for first 7 days, card required for days 8-14. Trial banner in UI. Email sequence: day 1 welcome, day 7 reminder, day 13 last chance, day 14 convert or downgrade. Conversion tracking." },
      { title: "Enterprise sales flow and contact form", description: "Enterprise tier contact form: company size, use case, timeline, budget range. Auto-routes to Cindy's email. CRM entry creation. Follow-up sequence. Custom quote generator. White-label inquiry handling." },
      { title: "Affiliate program full implementation", description: "Affiliate portal: unique referral links per user, 20% recurring commission for 12 months. Stripe Connect payouts. Dashboard: clicks, conversions, earnings, payout history. Tier bonuses: 25% at $1k/mo referred, 30% at $5k/mo." },
      { title: "Marketplace commission engine", description: "Creator marketplace: 15% platform commission on all sales. Stripe Connect Express for creator payouts. Minimum payout threshold $25. Monthly auto-payout. Tax form collection (W9/W8). Sales analytics per creator." },
      { title: "Revenue analytics dashboard admin", description: "Real-time revenue dashboard: MRR, ARR, churn rate, LTV, CAC, cohort analysis, revenue by tier, credit purchase revenue, affiliate commissions paid, marketplace commissions. Export to CSV. Projections to $1M ARR milestone tracker." },
    ]
  },
  {
    phase: "javari_ai_core", priority: 1,
    tasks: [
      { title: "Javari onboarding first-run experience", description: "First session after signup: animated welcome from Javari avatar, ask 3 questions (what do you create? what is your goal? who do you serve?), build personalized workspace, show first suggested action. Completion unlocks 100 bonus credits." },
      { title: "Javari conversational UI complete polish", description: "Chat interface: streaming responses, message history with search, code block rendering with copy button, markdown support, file upload and analysis, image generation inline, export conversation as PDF/markdown, pin important messages." },
      { title: "Javari tool invocation from chat", description: "Natural language tool triggering: say write me a logo and Logo Generator launches inline. Say build my resume and Resume Builder opens with data pre-filled from profile. Tool results appear inline in chat. Seamless transitions." },
      { title: "AvatarOS Javari avatar face and voice system", description: "Avatar creation: AI face generation with 50+ style options, skin tones, hair, expressions. Voice selection: 12 preset voices. Voice cloning from 30-second sample. Avatar appears in video introductions and voice messages. Brand package export SVG PNG video." },
      { title: "Javari memory and context persistence", description: "Cross-session memory: remember user projects, preferences, past work, goals. Structured memory tags: project, preference, goal, style. Memory viewer where users can see and edit what Javari remembers. Forget specific memories. Memory privacy settings." },
      { title: "Multi-agent workflow builder visual", description: "Visual workflow builder: drag-and-drop agents (Researcher, Writer, Designer, Coder, Reviewer, Publisher). Connect with arrows. Set inputs/outputs per node. Schedule runs. Templates: Blog Post Pipeline, Social Campaign, Code Review Flow, Market Research Report." },
      { title: "Javari voice mode push to talk", description: "Voice interface: hold spacebar or tap microphone to speak. Whisper transcription. Javari responds with avatar lip-sync and selected voice. Works on mobile. Toggle between voice and text mode. Voice commands for navigation." },
      { title: "Javari proactive suggestions engine", description: "Javari notices inactivity, low credits, stalled projects and proactively offers help. Morning briefing: 3 personalized action items. All proactive messages dismissable with preference learning. Never annoying, always useful." },
      { title: "Javari autonomous task queue user-facing", description: "Users can assign long-running tasks: research competitors and write a report, generate 30 social posts for this month. Javari works in background, notifies when done. Queue visible in dashboard with progress and estimated time." },
      { title: "Javari feedback and rating system", description: "After every response: thumbs up/down, optional comment. Negative feedback triggers immediate improvement attempt and routes to improvement log. Positive feedback trains preferred patterns. User satisfaction score tracked monthly." },
    ]
  },
  {
    phase: "creator_tools_suite", priority: 2,
    tasks: [
      { title: "Logo Generator complete with AI and export", description: "Logo Generator: text prompt plus style options (minimalist/bold/vintage/tech/organic) plus color palette picker plus industry selector. Generates 6 variations. Edit colors, fonts, layout in browser. Export: SVG, PNG transparent and white BG, ICO, WebP. Save to project." },
      { title: "Social Media Post Creator all platforms", description: "Social posts tool: input topic/product/event, AI generates platform-optimized copy for Instagram, LinkedIn, Twitter/X, Facebook, TikTok, Pinterest. Tone selector. Hashtag suggestions. Character counters. Batch generate 30 days of content in one click." },
      { title: "Resume Builder AI-powered complete", description: "Resume builder: import LinkedIn URL or paste existing resume, AI rewrites for target role, ATS optimization scoring, 15 beautiful templates, cover letter generation, LinkedIn summary generator. Export PDF. Track applications. Before/after view." },
      { title: "Cover Letter Generator with job matching", description: "Paste job description plus select or paste resume, AI writes tailored cover letter matching keywords, quantifies achievements, adapts tone to company culture. 5 style options. One-click customize. Export PDF and DOCX." },
      { title: "Invoice and Proposal Generator business docs", description: "Invoice: logo, itemized services, tax calculation, payment terms, PDF export. Proposal: executive summary, scope, timeline, pricing tiers, signature line. Templates by industry. Client portal to view and sign. Payment link embedded." },
      { title: "Presentation Maker AI slides complete", description: "Presentation builder: topic plus audience plus goal generates full slide deck in 60 seconds. 20 themes. Edit in browser: slides, text, AI images, charts, icons. Speaker notes generated. Export PPTX, PDF, Google Slides. Record narration with avatar." },
      { title: "PDF Tools suite 12 operations complete", description: "PDF toolkit: merge, split, compress, convert Word and Excel and PPT to and from PDF, add watermark, password protect, extract text, OCR scanned PDFs, sign, form fill, page rotate. Batch processing. No file size limit on Pro plus." },
      { title: "Video Analysis and Summary tool", description: "Upload video or paste YouTube URL. AI transcribes, summarizes, extracts key moments, generates chapter markers, creates show notes, pulls quotes, identifies speakers. Export: summary PDF, transcription TXT, chapters CSV. Works on any language." },
      { title: "Email Template Builder drag and drop", description: "Email builder: drag-drop blocks (header, text, image, button, divider, social). AI writes copy from brief. 50 starter templates by use case. Export HTML. ESP integrations: Mailchimp, ConvertKit, Klaviyo, Resend. Preview in multiple clients." },
      { title: "AI Copywriter full content package generator", description: "Input product/service/audience/goal/tone and get complete copy package: headline 10 variations, subheadline, body copy, bullet points, CTA, meta description, social snippets, email subject lines. One-click save to project. Plagiarism check." },
      { title: "Brand Color Palette Generator", description: "Input brand name plus industry plus mood words. Generates 5 palette options with primary/secondary/accent/neutral colors. Hex codes plus RGB plus CSS variables. WCAG accessibility checker. Download swatch file. Preview on sample landing page." },
      { title: "Image Caption Generator social AI", description: "Upload image. AI generates captions for Instagram (3 length options), Twitter/X, LinkedIn, Pinterest. Alt text for accessibility. Hashtag set. Tone options: casual/professional/funny/inspirational. Bulk upload mode: 50 images at once." },
      { title: "Background Remover instant AI tool", description: "Upload image. Instant background removal using AI. Preview on transparent/white/custom color/custom image background. Download PNG transparent or any format. Bulk mode: 100 images. Batch add same background to product photos." },
      { title: "Subtitle and Transcript Generator multi-language", description: "Upload video/audio. Generates accurate transcript with speaker labels and timestamps. Edit in-browser with sync highlighting. Export: SRT, VTT, TXT, PDF. Translate to 50 languages. Burn subtitles into video. Auto-caption for social media." },
      { title: "Voice Transcriber real-time and upload", description: "Real-time transcription: speak and see text appear instantly. Upload audio: MP3, WAV, M4A, OGG. Speaker diarization. Punctuation and formatting AI. Edit transcript. Export TXT, DOCX, PDF. Meeting notes mode: auto-extracts action items." },
    ]
  },
  {
    phase: "marketplace_and_ecosystem", priority: 2,
    tasks: [
      { title: "MarketplaceOS full seller and buyer experience", description: "Marketplace: seller onboarding (verify identity, Stripe Connect, set payout), create listing (digital products, templates, prompts, avatars, AI agents), buyer browse/search/filter, checkout, instant delivery, review system, dispute resolution, seller analytics dashboard." },
      { title: "Javari Spirits alcohol recommendation platform full", description: "Spirits platform: searchable database of 50k+ spirits, AI taste profile builder from quiz, personalized recommendations, food pairing, cocktail recipes. Affiliate links to purchase (Drizly, Total Wine, ReserveBar). Age verification gate. Awin affiliate integration." },
      { title: "Javari Cards tarot and vision system full build", description: "Cards platform: 78-card tarot deck with AI interpretations, 30 oracle decks, life mapping tool, daily card pull with personalized message from Javari avatar, compatibility readings, career spread, annual forecast. Premium: save readings, journal entries." },
      { title: "Javari Music AI composition and discovery full", description: "Music platform: AI music generation from mood/genre/tempo/instruments prompt. Royalty-free library. Podcast intro generator. Social media clip generator (15s, 30s, 60s). License manager. Affiliate: Spotify, Apple Music, instrument sales." },
      { title: "Javari Games Hub integration and platform full", description: "Games hub: embed framework for HTML5 games, leaderboards, achievements, daily challenges, tournament mode, social sharing. Subscription: unlimited play on Pro plus. F2P with credit rewards for ad views." },
      { title: "Javari Travel AI trip planner and booking", description: "Travel platform: destination research (AI itinerary builder), hotel/flight search via Skyscanner/Booking.com affiliate, AI packing list, visa requirements checker, local experiences guide, budget calculator, travel insurance quote affiliate." },
      { title: "Javari Health AI wellness platform full", description: "Health platform: symptom checker (informational only), mental wellness check-ins, meditation audio library, fitness plan generator, nutrition guide, sleep tracker, mood journal. Telehealth referral affiliate. HIPAA disclaimer prominent throughout." },
      { title: "Javari Legal document automation full", description: "Legal tools: NDA generator, freelance contract, LLC operating agreement, privacy policy, terms of service, employment offer letter, lease agreement, bill of sale. Plain-English explanations. State-specific variants. E-signature affiliate." },
      { title: "Javari Real Estate property intelligence full", description: "Realty platform: neighborhood research, property value estimator, mortgage calculator, rent vs buy analysis, investment property ROI, market trend reports, agent finder referral fee, mortgage pre-qualification affiliate." },
      { title: "Javari Education AI learning platform full", description: "Education hub: AI tutor for K-12 subjects, college essay writer, study guide generator, flashcard creator, practice test builder, career path planner, scholarship finder. Affiliate: Coursera, Udemy, LinkedIn Learning, Chegg." },
      { title: "Javari Fitness AI personal trainer full", description: "Fitness platform: personalized workout plans (home/gym/outdoor), video exercise library 500+, form checker via camera, calorie/macro tracker, meal plan generator, progress photo analyzer. Affiliate: supplements, equipment." },
      { title: "Javari Entertainment streaming guide full", description: "Entertainment platform: AI movie/show recommender, streaming service comparison, watchlist manager, review aggregator, watch party coordinator. Affiliate: streaming subscriptions, movie tickets, merchandise." },
      { title: "Javari Shopping AI deal finder full", description: "Shopping platform: product research assistant, price comparison across Amazon/Walmart/Target/eBay, deal alerts, cashback tracker, gift idea generator, product review summarizer. Amazon affiliate links integrated. Wishlists. Budget tracker." },
      { title: "Javari Dating profile optimizer full", description: "Dating platform: profile analyzer (upload current profile, AI scores and rewrites bio, selects best photos), conversation starter generator, date idea suggestions by city, relationship goal clarity quiz, compatibility assessment. Affiliate: Bumble/Hinge/Match.com." },
      { title: "Javari Arena AI model comparison platform full", description: "Arena: side-by-side comparison of AI models (Claude, GPT-4, Gemini, Llama, Mistral) on user prompts. Blind voting. Community leaderboard. Performance by category. Speed/cost comparison. API cost calculator. Prompt library with community voting." },
    ]
  },
  {
    phase: "mission_social_impact", priority: 1,
    tasks: [
      { title: "Javari Veterans Connect complete platform full", description: "Veterans platform: benefits navigator (VA claims, GI Bill, healthcare enrollment), job board with veteran-friendly employers, resume translator military to civilian, PTSD/mental health resources, peer community, legal aid directory, housing assistance. 100% free always." },
      { title: "Javari First Responders platform full build", description: "First responders hub: stress management tools (EMS/Police/Fire specific), peer support network, PTSD resources, disability claims help, scholarships, equipment reviews, job board, retirement planning, family resources. Partner with IAFF, FOP." },
      { title: "Javari Faith Communities platform full build", description: "Faith platform: sermon prep AI assistant, bulletin creator, event poster maker, volunteer coordinator, donation tracking, Bible/Quran/Torah study tools, prayer request board, congregation newsletter. Multi-faith, multi-denomination. Free for all congregations." },
      { title: "Javari Animal Rescue network full build", description: "Animal rescue platform: adoptable pet listings (integrates with Petfinder API), foster application system, volunteer coordinator, medical expense crowdfunding, lost pet finder, spay/neuter clinic locator, rescue organization directory. Free for all registered rescues." },
      { title: "Javari Nonprofits grant writing suite full", description: "Nonprofit tools: AI grant proposal writer (matches org mission to grant requirements), grant database with 50k+ opportunities, 990 form analyzer, impact report generator, donor management, volunteer hour tracker, board meeting minutes generator." },
      { title: "Javari Family life management platform full", description: "Family platform: chore chart builder, family calendar sync, allowance tracker, age-appropriate homework helper, recipe planner plus grocery list, family meeting agenda builder, digital family vault for important documents, memory book creator." },
      { title: "Grant application pipeline automated full", description: "Javari prepares and tracks grant applications: federal (NEA, IMLS, SBA, USDA), state arts councils, private foundations (Ford, Gates, Knight, Kresge). Auto-fills applications from org profile. Deadline tracker. Reporting templates. Track $600M+ opportunity pipeline." },
      { title: "Social impact metrics and reporting dashboard", description: "Impact dashboard: users served per mission category (veterans, first responders, faith, rescue, nonprofits, families), services delivered, estimated economic value of assistance, stories collected, testimonials. Annual impact report generator. Press release builder." },
    ]
  },
  {
    phase: "platform_infrastructure", priority: 2,
    tasks: [
      { title: "Universal notification system email SMS push", description: "Full NotificationOS: transactional email via Resend (welcome, password reset, subscription confirmation, invoice, task complete), SMS via Twilio (2FA, low credit alert, task done), browser push notifications. Preference center per user." },
      { title: "Admin super dashboard complete all controls", description: "Super admin: user management (search, impersonate, ban, refund, grant credits), revenue overview real-time MRR/ARR, system health monitors, AI cost breakdown by model/task, error logs with stack traces, deployment status all repos, security event log." },
      { title: "User analytics and behavior tracking GDPR", description: "Analytics: page views, feature usage heatmap, tool completion rates, conversion funnel signup to paid, cohort retention analysis, NPS survey automation, churn prediction score per user. All GDPR-compliant. Consent management." },
      { title: "CRAIverse virtual world foundation MVP", description: "CRAIverse MVP: user avatar creation (select from AvatarOS), personal space/room customization, social feed, avatar-to-avatar messaging, virtual marketplace stalls, community events calendar, geographic targeting (Fort Myers hub first), XP and achievement system." },
      { title: "Mobile app React Native foundation iOS Android", description: "Mobile app (iOS plus Android): login/signup, Javari chat, tool launcher, notification center, credit balance, quick create (social post, image caption, voice transcribe). Push notifications. Biometric auth. App Store and Play Store submission." },
      { title: "API public developer platform with docs", description: "Public API: RESTful plus GraphQL endpoints for core Javari functions. API key management portal. Rate limiting tiers. Interactive API docs (Swagger/Redoc). SDKs: JavaScript, Python, PHP. Webhook subscriptions. Usage dashboard for developers." },
      { title: "White label enterprise solution package", description: "White-label package: custom domain, custom branding (logo, colors, fonts), custom AI persona name and voice, custom tool selection, user management, SSO integration, custom pricing, dedicated support channel. Pricing: $499/mo base plus $5/seat." },
      { title: "SEO and content marketing engine complete", description: "SEO infrastructure: sitemap generation, schema markup, meta tag optimization per page, blog platform with AI-assisted content, keyword tracking, Google Search Console integration, page speed optimization, Core Web Vitals monitoring, automated SEO reports." },
      { title: "CRAIverse location-based community modules", description: "Geographic targeting: users opt-in location, see nearby creators and businesses, local event listings, local business directory with Javari AI integration offers, neighborhood groups, local marketplace, geofenced notifications for Fort Myers and Cape Coral pilot." },
      { title: "Javari Academy training and certification ecosystem", description: "Javari Academy: 60+ certification courses on using the platform (Creator Certification, AI Marketing Pro, Business Automation Specialist, Nonprofit AI Navigator). AI-delivered by Amara avatar. Quizzes, badges, LinkedIn-shareable certificates. Revenue: $97-$997 per cert." },
    ]
  },
  {
    phase: "branding_and_ux", priority: 2,
    tasks: [
      { title: "Unified design system across all repos", description: "Create and enforce consistent design system: color tokens (Javari Blue #3B82F6, slate-950 BG, slate-900 cards), typography (Inter font), spacing scale, component library in javari-components repo. Apply across all 100 repos. Visual consistency throughout." },
      { title: "Homepage javariai.com complete redesign hero", description: "Homepage: hero with animated Javari avatar plus dynamic text rotation (Your AI Creative Partner, Your Story Our Design, Build Anything Automate Everything), feature grid, social proof strip, pricing preview, mission statement section, full footer." },
      { title: "Onboarding email sequence 10 email complete", description: "Onboarding sequence: Day 0 Welcome, Day 1 Try first tool, Day 3 Meet Javari avatar video, Day 5 First week recap, Day 7 Upgrade prompt if free, Day 14 Success story and community invite, Day 21 Power user tips, Day 30 Review request and referral ask." },
      { title: "In-app tooltips and feature discovery system", description: "Tooltip system: first-time user popovers for every major feature, skippable tours, What is this hover tooltips on every icon, contextual help panel, video walkthroughs accessible from question mark icon, feature announcements for new releases, changelog accessible from footer." },
      { title: "Error pages and empty states all branded Javari", description: "Branded experiences: 404 page with Javari avatar saying Oops I looked everywhere, 500 page with I am working on it plus status page link, empty state for every data table with helpful CTA, loading skeletons matching content shape, optimistic UI for all mutations." },
      { title: "Social media presence brand kit and templates", description: "Social media kit: Javari brand voice guide (Helpful Warm Direct Never corporate), 30 days of social posts for launch, post templates for every tool announcement, testimonial graphic templates, animated story templates for Instagram/TikTok." },
      { title: "Partner and press kit complete professional", description: "Press kit at javariai.com/press: company overview, founder bios (Roy plus Cindy), product screenshots high-res, logo files all formats, mission statement, key stats, contact for press inquiries. Partner kit: integration documentation, co-marketing templates, revenue share overview." },
      { title: "Accessibility audit WCAG 2.2 AA full platform", description: "Accessibility pass: keyboard navigation all interactive elements, ARIA labels all icons, color contrast check all text (4.5:1 minimum), alt text all images, focus indicators visible, screen reader testing VoiceOver plus NVDA, skip navigation link, accessible error messages." },
    ]
  },
  {
    phase: "collector_apps", priority: 3,
    tasks: [
      { title: "Javari Vinyl Vault record collector platform full", description: "Vinyl platform: Discogs API integration for catalog search, personal collection tracker, want list, condition grader with AI photo analysis, value estimator, trade board, nearest record stores map, new release alerts, artist discography explorer, affiliate links." },
      { title: "Javari Watch Works horology platform full", description: "Watch platform: personal collection tracker with value tracking, service history log, authentication guide, market price monitor (Chrono24 data), brand encyclopedia, movement identifier from photo, strap guide, insurance valuation export, affiliate links." },
      { title: "Javari Card Vault trading cards platform full", description: "Card vault: multi-category (Pokemon, Magic, Sports, YuGiOh), photo scanning with AI card identification, PSA/BGS grading lookup, market price (TCGPlayer, eBay sold), portfolio value tracker, want/trade lists, bulk import from CSV, insurance export." },
      { title: "Javari MTG Manager Magic the Gathering full", description: "MTG Manager: deck builder with legality checker, card search with Scryfall API, collection tracker, draft simulator, price tracker with alerts, tournament record keeper, meta analysis dashboard, trade calculator, proxy printer for casual play." },
      { title: "Javari Militaria Vault collector platform full", description: "Militaria platform: item catalog by era/country/type, authentication guides, valuation reference, preservation guides, museum donation options, research tools, auction house directory, fellow collector network, educational history context for each item type." },
      { title: "Javari Outdoors adventure platform full", description: "Outdoors hub: trail finder (AllTrails integration), gear checklist builder, campsite locator, weather integration, trip journal, photo map, group trip planner, LNT education, permit system links. Affiliate: REI, Backcountry, gear reviews by AI." },
      { title: "Javari Movie AI film platform full", description: "Movie platform: personalized recommendations (quiz-based taste profile), watch history tracker, movie night picker for groups via link, film analysis AI (themes, cinematography, director style), watchlist cross all streaming services, friends activity feed." },
      { title: "Javari Pets care and adoption platform full", description: "Pets platform: pet profile manager (health records, vet appointments, medications, weight), breed guide AI, symptom checker non-medical, local vet finder, pet-friendly places map, lost pet alert network, breed matcher quiz. Affiliate: Chewy, PetSmart, pet insurance." },
    ]
  },
  {
    phase: "business_verticals", priority: 3,
    tasks: [
      { title: "Javari Construction project management platform", description: "Construction platform: project timeline builder, material estimator with current pricing, subcontractor directory, permit checklist by state, change order generator, lien waiver templates, invoice system, photo documentation with AI progress notes, client portal." },
      { title: "Javari Manufacturing operations platform full", description: "Manufacturing platform: production planning tools, BOM bill of materials builder, supplier management, quality control checklist system, ISO documentation templates, equipment maintenance tracker, inventory management, shift scheduling, compliance documentation." },
      { title: "Javari Supply Chain intelligence platform full", description: "Supply chain platform: supplier risk assessment, lead time tracker, inventory optimization calculator, demand forecasting AI, disruption alert system, alternative supplier finder, trade compliance checker, logistics cost calculator, ESG supplier scoring." },
      { title: "Javari HR and Workforce platform full", description: "HR platform: job description AI writer, interview question generator by role, offer letter templates, onboarding checklist builder, performance review generator, PIP documentation, org chart builder, employee handbook generator, exit interview form." },
      { title: "Javari Business Formation full stack", description: "Business formation: entity type selector quiz, state-by-state filing guide, registered agent finder, EIN application walkthrough, operating agreement generator, first-year compliance calendar, business bank account comparison, bookkeeper finder." },
      { title: "Javari Insurance comparison and guidance full", description: "Insurance platform: coverage needs calculator (business, health, life, auto, home), comparison engine pulling live quotes, policy plain-English explainer, claim documentation guide, renewal reminder system. Affiliate: Next Insurance, Hiscox, Lemonade, Policygenius." },
      { title: "Javari Property Hub real estate management full", description: "Property management: rental income tracker, expense categorization, maintenance request system, lease generator, tenant screening checklist, rent increase calculator, depreciation schedule, Schedule E preparation guide, cap rate calculator, local property manager finder." },
      { title: "Javari Home Services contractor platform full", description: "Home services: project cost estimator by type and zip code, licensed contractor finder, project scope document generator, payment milestone schedule, lien waiver templates, warranty tracker, home maintenance calendar, emergency contact list builder." },
      { title: "Javari Business Admin operations suite full", description: "Business admin tools: meeting agenda builder, decision log tracker, OKR framework builder, team communication templates, vendor management tracker, expense report generator, board meeting minutes AI writer, company overview one-pager generator." },
      { title: "Javari Intel competitive intelligence platform full", description: "Market intelligence: competitor monitoring (website changes, job postings, press releases), keyword rank tracker, social mention monitoring, pricing change alerts, patent filing tracker, funding announcement alerts, industry news digest, opportunity scoring dashboard." },
    ]
  },
  {
    phase: "launch_and_scale", priority: 1,
    tasks: [
      { title: "All app URL structure and cross-linking complete", description: "Navigation architecture: every app has consistent header with Javari logo, back to dashboard link, account menu. Apps cross-link to related tools. Tool suggestions sidebar in all apps. Breadcrumb navigation. URL structure: /tools/[tool-name], /apps/[app-name]." },
      { title: "Universal search across entire platform", description: "Universal search: one search bar in header searches across tools, apps, marketplace listings, help docs, projects, and conversation history. Keyboard shortcut Cmd+K. Recent searches. Popular searches. AI-suggested search refinements." },
      { title: "Help center and documentation 200 articles", description: "Help center: searchable knowledge base with 200+ articles (how-to guides, video walkthroughs, troubleshooting), AI chat assistant trained on all docs, community forum, feature request board, bug report form, status page uptime monitoring, changelog with email subscription." },
      { title: "Performance optimization all critical paths Lighthouse 90", description: "Performance pass: critical CSS inlined, images lazy-loaded with blur placeholder, API routes under 200ms p95, homepage LCP under 2.5s, Lighthouse score 90+ all pages. Vercel Edge Runtime for auth and middleware. Redis caching for expensive queries." },
      { title: "Security hardening OWASP full audit complete", description: "Security audit: rate limiting on all API routes, CSRF protection, input sanitization, file upload virus scanning, API key rotation procedure, penetration test checklist, CSP headers, HSTS, security.txt. SOC2 readiness assessment." },
      { title: "Multi-language support foundation Spanish Portuguese", description: "i18n foundation: extract all UI strings to locale files, implement next-intl, detect browser language, language switcher in settings. Initial languages: English, Spanish (large US Hispanic market), Portuguese (Brazil opportunity). AI translation review pipeline." },
      { title: "Sitemap and SEO infrastructure all apps", description: "SEO infrastructure: sitemap.xml generated from all public routes, robots.txt configured, OpenGraph tags all pages, Twitter cards, structured data (Organization, SoftwareApplication, Offer schemas), canonical URLs, hreflang for multilingual." },
      { title: "Product Hunt and launch campaign full execution", description: "Launch execution: Product Hunt launch (Roy as maker, full description, gallery, 50 upvotes seeded from network), Hacker News Show HN post, TechCrunch/VentureBeat press pitch (Cindy leads), Twitter/X launch thread, LinkedIn announcement, email blast to waitlist." },
    ]
  }
];

export async function POST(req: NextRequest) {
  // Simple auth check
  const secret = req.headers.get("x-ingest-secret");
  if (secret !== "henderson-standard-2026") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let idx = 0;
  const allRows = [];

  for (const phase of ROADMAP) {
    for (const t of phase.tasks) {
      allRows.push({
        id:          taskId(phase.phase, t.title, idx++),
        phase_id:    phase.phase,
        title:       t.title,
        description: t.description,
        depends_on:  [] as string[],
        status:      "pending" as const,
        source:      "roadmap",
        updated_at:  Date.now(),
      });
    }
  }

  // Deduplicate by title
  const { data: existing } = await supabase
    .from("roadmap_tasks")
    .select("title");

  const existingTitles = new Set((existing ?? []).map((r: { title: string }) => r.title));
  const toInsert = allRows.filter(r => !existingTitles.has(r.title));

  const insertLogs: string[] = [];
  const failed: string[] = [];

  for (const row of toInsert) {
    const { error } = await supabase.from("roadmap_tasks").upsert(row, {
      onConflict: "id",
      ignoreDuplicates: false,
    });
    if (error) {
      failed.push(`${row.title}: ${error.message}`);
    } else {
      insertLogs.push(row.title);
    }
  }

  return NextResponse.json({
    ok:           true,
    total:        allRows.length,
    inserted:     insertLogs.length,
    skipped:      allRows.length - toInsert.length,
    failed:       failed.length,
    failed_items: failed.slice(0, 5),
    phases:       [...new Set(allRows.map(r => r.phase_id))],
    message:      `Henderson Standard Master Ecosystem Roadmap — ${insertLogs.length} tasks queued`,
  });
}

export async function GET() {
  const { data, error } = await supabase
    .from("roadmap_tasks")
    .select("phase_id, status")
    .order("phase_id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const summary: Record<string, Record<string, number>> = {};
  for (const row of data ?? []) {
    if (!summary[row.phase_id]) summary[row.phase_id] = {};
    summary[row.phase_id][row.status] = (summary[row.phase_id][row.status] ?? 0) + 1;
  }

  return NextResponse.json({ phases: summary, total: data?.length ?? 0 });
}
