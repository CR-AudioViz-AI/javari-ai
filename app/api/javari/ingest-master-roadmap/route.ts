// app/api/javari/ingest-master-roadmap/route.ts
// Javari AI — Master Ecosystem Roadmap Ingest (108 tasks, 9 phases)
// Purpose: One-shot endpoint to seed complete ecosystem into roadmap_tasks.
//          Safe to call repeatedly — skips existing titles via dedup.
// Date: 2026-03-09

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim()
    .replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 48);
}
function taskId(phase: string, title: string, idx: number): string {
  return `eco-${phase.slice(0, 12)}-${slugify(title)}-${String(idx).padStart(3, "0")}`;
}

interface TaskDef { title: string; description: string; }
interface PhaseDef { phase: string; tasks: TaskDef[]; }

const MASTER_ROADMAP: PhaseDef[] = [
  {
    phase: "revenue_foundation",
    tasks: [
      { title: "Stripe Checkout Subscription Flow end-to-end", description: "Build complete Stripe integration: checkout session creation, subscription lifecycle (create/upgrade/downgrade/cancel), webhook handlers for all events (payment_intent.succeeded, customer.subscription.updated, invoice.payment_failed), grace period logic, and success/cancel redirect pages. Test with Stripe test cards. Store subscription state in Supabase profiles table." },
      { title: "PayPal Subscription Billing complete integration", description: "Wire PayPal Subscriptions API: plan creation, subscription approval flow, webhook handlers for BILLING.SUBSCRIPTION.ACTIVATED/CANCELLED/PAYMENT.SALE.COMPLETED, IPN verification, and parity with Stripe tier mapping. Users can pay with either processor." },
      { title: "Pricing page javariai.com with live checkout", description: "Build /pricing on javariai.com: Free/Creator/Pro/Enterprise tiers with feature comparison matrix, live Stripe checkout buttons, PayPal alternative, annual/monthly toggle with 20% discount display, FAQ section, and money-back guarantee badge." },
      { title: "Credits system purchase track display deduct", description: "Full CreditsOS: credit purchase UI (buy 100/500/1000/5000 credits), dollar-to-credit exchange rate display, per-action deduction middleware, real-time balance widget in nav, low-balance email alert at 20% remaining, credit history ledger page, and admin grant/revoke endpoint." },
      { title: "Affiliate program tracking links dashboard payouts", description: "Build affiliate system: unique referral link generation per user, click and conversion tracking via UTM params and cookies, 30% recurring commission for 12 months, affiliate dashboard showing clicks/signups/earnings, Stripe Connect payout at $50 minimum, and Javari Spirits integration with Awin 300+ alcohol programs." },
      { title: "White-label enterprise sales page and lead capture", description: "Build /enterprise page: white-label pitch, case study placeholders, pricing calculator (seats x tier), contact sales form with Supabase CRM integration, calendar booking embed, and automated follow-up email sequence trigger." },
      { title: "Grant application engine federal and private foundation", description: "Build grant discovery and application assistant: 200+ grants database relevant to CR AudioViz AI mission (veterans, first responders, education, nonprofits, faith communities, animal welfare), AI-powered application writer using platform narrative, deadline tracker, and status board. Seed with SAMHSA, VA, NEA, NSF, NIH, and 50+ private foundations." },
      { title: "Revenue dashboard real-time MRR ARR churn LTV", description: "Admin revenue analytics: MRR/ARR cards, churn rate trend, LTV by tier, top revenue users, monthly cohort retention heatmap, Stripe + PayPal unified view, credit economy flow (purchased vs spent vs expired), and 12-month projection model." },
    ]
  },
  {
    phase: "javari_core",
    tasks: [
      { title: "Javari onboarding flow first session magic", description: "Build /account/onboarding: 4-step wizard (name + goals, select 3 interests from 20 modules, set first project, meet Javari avatar), personalized welcome message from Javari, first credit grant (100 free credits), and redirect to relevant first tool based on selected interests." },
      { title: "AvatarOS Javari avatar face voice personality", description: "Build AvatarOS full spec: AI face generation (5 base styles: professional, creative, mentor, guardian, visionary), voice selection (8 voices via ElevenLabs or OpenAI TTS), personality tuning sliders (formal/casual, brief/thorough, proactive/reactive), avatar preview with sample interaction, and branding export (PNG, animated SVG, video loop MP4)." },
      { title: "Javari chat production quality conversational UI", description: "Complete Javari chat interface: streaming responses with typewriter effect, conversation history sidebar with search, message starring and export, file upload with drag-drop (images, PDFs, docs), code blocks with syntax highlighting and copy button, markdown rendering, suggested follow-up actions, and session memory." },
      { title: "Multi-agent orchestration UI see agents working", description: "Build multi-agent visibility layer: real-time agent activity panel showing Architect/Builder/Reviewer/Documenter agents working in parallel, step-by-step progress with expandable details, cost ticker per agent, pause/resume/abort controls, and task handoff visualization." },
      { title: "Tool marketplace 60 plus tools browsable and launchable", description: "Build /tools with full tool catalog: category filters (Writing, Design, Business, Legal, Health, Finance, Education, Entertainment), search, tool cards with description/credits/rating, featured tools carousel, recently used section, and deep links into each tool." },
      { title: "Knowledge base user uploads plus platform docs RAG", description: "Build /dashboard/knowledge: drag-drop document upload (PDF, DOCX, TXT, MD), automatic chunking and embedding via OpenAI text-embedding-3-small, storage in Supabase vector table, per-document source attribution in Javari responses, and admin view of platform canonical docs." },
      { title: "NotificationOS email SMS browser push in-app", description: "Complete notification system: Resend for transactional email (welcome, password reset, credit alerts, task completion), Twilio for SMS (opt-in only), Web Push API for browser notifications, in-app notification bell with unread count, notification preferences page, and admin broadcast capability." },
      { title: "Mobile responsive audit and fix every page", description: "Audit and fix mobile responsiveness across all pages: test at 375px, 768px, 1024px breakpoints. Fix nav hamburger menu, tool cards wrapping, chat input on iOS, table overflow, modal sizing. Achieve 100% mobile usability on Chrome, Safari, and Firefox mobile." },
      { title: "SEO foundation meta tags OG images sitemap robots", description: "Add SEO to all public pages: unique title/description meta tags, Open Graph images (1200x630 branded), Twitter card tags, JSON-LD structured data for Organization and SoftwareApplication, auto-generated sitemap.xml, robots.txt, and canonical URLs. Register in Google Search Console." },
      { title: "Performance optimization Core Web Vitals green", description: "Optimize to green Core Web Vitals: lazy-load below-fold images, implement Next.js Image for all images, split code by route, cache Supabase queries with SWR, compress API responses, add CDN headers for static assets, and achieve LCP under 2.5s, FID under 100ms, CLS under 0.1 on production." },
    ]
  },
  {
    phase: "creator_tools",
    tasks: [
      { title: "AI Copywriter landing pages ads emails social", description: "Build full AI Copywriter tool: 20+ content templates (landing page hero, email subject line, Facebook ad, Google ad, product description, blog intro, YouTube description, cold email, LinkedIn post, Instagram caption), tone selector (professional/casual/bold/empathetic), length control, regenerate button, copy/export." },
      { title: "AI Image Generator multi-model with style controls", description: "Wire image generation tool: DALL-E 3, Stable Diffusion (via Replicate), and Flux models selectable, aspect ratio selector (1:1, 16:9, 9:16, 4:3), style presets (photorealistic, illustration, 3D render, watercolor, minimalist, cinematic), negative prompts, batch generation (1-4 images), history gallery." },
      { title: "Logo Generator brand identity system builder", description: "Build logo generation tool: business name and tagline input, industry selector (50 categories), style selector (modern/classic/playful/bold/minimal), color scheme picker, AI logo generation via Replicate/DALL-E, SVG and PNG export, brand kit builder (logo + colors + fonts), and business card preview." },
      { title: "Background Remover batch with smart edge detection", description: "Build background remover: drag-drop or upload up to 10 images at once, AI background removal via remove.bg API or Replicate rembg model, background replacement options (transparent, white, custom color, custom image), before/after slider preview, batch download as ZIP." },
      { title: "PDF Tools Suite 20 PDF operations", description: "Build PDF toolkit: merge, split, compress, convert (PDF to Word/Excel/PPT and reverse), rotate, watermark, password protect/unlock, extract images, add page numbers, e-sign with drawn or typed signature, OCR text extraction, and metadata editor." },
      { title: "Resume Builder Pro ATS-optimized templates", description: "Build resume builder: 15 ATS-optimized templates, AI content suggestions for each section, job description import with keyword matching, ATS score indicator, one-click PDF export, cover letter companion generator, and career objective AI writer." },
      { title: "Social Media Manager schedule analyze grow", description: "Build social media tool: multi-platform post composer (Facebook, Instagram, Twitter/X, LinkedIn, TikTok), AI caption generator with hashtag suggestions, visual content calendar, post scheduling queue, engagement analytics, competitor analysis tool, and content repurposing." },
      { title: "Email Marketing Platform campaign to conversion", description: "Build email campaign tool: drag-drop email builder with 20 templates, subscriber list management, segmentation by tag/behavior, send scheduling, open/click rate analytics, A/B subject line testing, automation sequences (welcome series, abandoned cart, re-engagement), and unsubscribe management." },
      { title: "Video Creator AI script to screen", description: "Build video creation tool: script input to AI storyboard to slide-based video with voiceover (OpenAI TTS), background music library (royalty-free), caption generation, thumbnail AI designer, export as MP4 (720p/1080p), and publishing checklist for YouTube/TikTok/Instagram." },
      { title: "Podcast Studio record edit distribute", description: "Build podcast tool: browser-based recording with noise reduction toggle, AI episode title and description generator, transcript generation (Whisper API), chapter markers from transcript, audiogram creator for social clips, RSS feed generator, and submission guide for Spotify/Apple/Amazon." },
      { title: "AI Writing Assistant long-form content engine", description: "Build long-form writer: blog post generator (with SEO optimization), eBook chapter writer, course content creator, white paper generator, research summary tool, tone and style consistency checker, word count tracker, and Google Docs-style collaboration export." },
      { title: "Voice Transcriber multilingual with speaker detection", description: "Build transcription tool: audio/video file upload (MP3, MP4, M4A, WAV, up to 100MB), Whisper API transcription, speaker diarization labels, timestamp export (SRT, VTT, TXT), translation to 10 languages, searchable transcript, and one-click summary generation." },
      { title: "Brand Color Palette Generator AI-powered identity", description: "Build brand palette tool: industry and mood input, AI-generated 5-color palette with hex codes, color psychology explanation for each choice, accessibility contrast checker (WCAG AA/AAA), CSS variables export, Tailwind config export, and brand guideline PDF generator." },
      { title: "AI Chatbot Builder deploy anywhere in 5 minutes", description: "Build no-code chatbot creator: knowledge base from uploaded docs or URL, personality and tone settings, branding (name, avatar, colors), embed snippet generator (iframe and JS widget), conversation analytics, escalation to human toggle, and white-label option. Uses Javari AI as backend." },
      { title: "Invoice Generator professional billing system", description: "Build invoice tool: business profile setup, client management, line item builder with tax calculation, multiple currencies, branded PDF export, payment link via Stripe, recurring invoice scheduling, payment status tracking (sent/viewed/paid/overdue), and expense tracker with receipt upload." },
      { title: "Contract Generator AI legal document builder", description: "Build contract tool: 25 template types (freelance agreement, NDA, service agreement, partnership agreement, employment offer, rental agreement), variable substitution, AI plain-English explainer for each clause, e-signature via drawn or typed signature, PDF export, and version history." },
      { title: "Business Plan Generator investor-ready in 30 minutes", description: "Build business plan tool: guided wizard (business model, market analysis, competitive landscape, financial projections, team bios), AI content generation per section, market size research via web search, financial model with revenue/expense templates, export to PDF and DOCX, and pitch deck companion generator." },
      { title: "Subtitle Generator video accessibility tool", description: "Build subtitle tool: video URL or file upload, Whisper transcription, automatic subtitle timing, style editor (font, size, color, position), SRT and VTT export, burned-in subtitle video export, translation into 10 languages, and accessibility compliance checker." },
      { title: "Image Caption Generator accessibility and social", description: "Build caption tool: image upload to AI description for alt text (accessibility) and social captions (Instagram/Twitter/LinkedIn tone variants), hashtag recommendations, SEO alt text optimization, bulk processing for up to 20 images, and export as CSV for content teams." },
      { title: "Presentation Maker pitch deck to board deck", description: "Build presentation tool: 15 professional templates, AI content generation per slide, image suggestions from Unsplash API, chart builder, speaker notes AI, export to PPTX and PDF, drag-drop editor, slide animation selector, and collaboration link sharing." },
    ]
  },
  {
    phase: "social_impact",
    tasks: [
      { title: "Javari First Responders platform full build", description: "Build complete first responders platform: peer support network with anonymous posting option, mental health resource library (PTSD, depression, burnout), shift scheduling tools, incident report templates, wellness check-in tracker, family resource section, and connection to professional support services. Grant-eligible for SAMHSA and FEMA Community Resilience funds." },
      { title: "Javari Veterans Connect full platform build", description: "Build veterans platform: service record organizer, VA benefits navigator with eligibility checker, job board with veteran preference filtering, mental health peer support forum, transition assistance tools (resume builder pre-configured for military experience), community events calendar, and honor wall. Grant-eligible for VA, DoD, and Bob Woodruff Foundation." },
      { title: "Javari Faith Communities church and ministry platform", description: "Build faith platform: sermon preparation AI assistant, bulletin and newsletter generator, event management with registration, donor management with giving reports, volunteer coordinator, small group organizer, prayer request board (private/public), scripture search and study tools. Grant-eligible for Lilly Endowment and faith-focused foundations." },
      { title: "Javari Animal Rescue adoption and rescue operations", description: "Build animal rescue platform: animal profile management with photo upload, adoption application processor, foster network coordinator, veterinary record tracker, donation campaign builder with Stripe integration, volunteer management, lost and found pet board, and rescue transport coordinator. Targeting PetSmart Charities and Petco Foundation grants." },
      { title: "Javari Nonprofits full nonprofit management suite", description: "Build nonprofit platform: donor CRM with gift history, grant tracking pipeline, impact reporting generator, board meeting tools, volunteer hour tracker, 990 preparation assistant, fundraising campaign builder, email list for donor communications, social media content calendar, and IRS compliance checklist." },
      { title: "Javari Education learning platform for underserved", description: "Build education platform: AI tutoring assistant (K-12 and adult learners), lesson plan generator for teachers, student progress tracker, parent communication portal, scholarship finder with application assistant, literacy and numeracy assessment tools, certificate of completion generator, and multilingual support (Spanish, French, Haitian Creole for Florida market)." },
      { title: "Javari Health AI wellness and care navigation", description: "Build health platform: symptom checker (with clear consult a doctor framing), medication reminder system, appointment organizer, health goal tracker, caregiver resource library, insurance navigation assistant, telehealth provider directory, mental health check-in with mood journaling, nutrition and meal planning, and crisis resource directory with 988 Lifeline integration." },
      { title: "Javari Family organization and connection hub", description: "Build family platform: shared family calendar, chore assignment tracker, family photo album (R2 storage), emergency contact manager, family budget tracker, kids homework helper (age-appropriate AI tutor), recipe organizer, family newsletter generator, and legacy story builder where grandparents record memories for future generations." },
    ]
  },
  {
    phase: "marketplace",
    tasks: [
      { title: "MarketplaceOS full creator marketplace", description: "Build complete marketplace: creator onboarding (Stripe Connect setup), digital product listings (templates, prompts, AI tools, courses, designs), service listings (AI projects, consulting, design), physical product listings, commission engine (15% platform fee), buyer checkout with Stripe/PayPal, ratings and reviews, seller analytics dashboard, and featured listing promotion system." },
      { title: "Javari Music AI music creation and streaming", description: "Build music platform: AI music generation via Suno or Udio API, genre and mood selector, lyrics writer AI, album artwork generator, music player with waveform visualizer, playlist builder, artist profile pages, streaming stats, royalty tracking, music licensing marketplace, and podcast background music library." },
      { title: "Javari Entertainment streaming guide and discovery", description: "Build entertainment platform: unified streaming guide (Netflix, Hulu, Disney+, HBO Max availability by title), AI recommendation engine based on mood and genre, watch party scheduler, review and ratings aggregator, new release alerts, watchlist builder, actor/director filmography explorer, and movie night picker AI." },
      { title: "Javari Sports Arena fantasy stats predictions", description: "Build sports platform: fantasy sports league manager (NFL, NBA, MLB, MLS), AI lineup optimizer, live score dashboard, player stats deep-dives, AI game predictions with confidence scores, sports news aggregator, trade analyzer, and community predictions leaderboard." },
      { title: "Javari Travel AI trip planner and booking assistant", description: "Build travel platform: AI itinerary generator (city + days + budget + interests to full day-by-day plan), hotel and flight search via Booking.com or Expedia affiliate APIs, visa requirement checker, packing list generator, travel budget calculator, offline itinerary PDF export, and group trip coordinator." },
      { title: "Javari Real Estate property search and investment tools", description: "Build realty platform: property search with Zillow/Realtor.com affiliate integration, investment property analyzer (ROI, cap rate, cash flow calculator), neighborhood AI report, mortgage payment calculator, rent vs buy analyzer, first-time buyer guide, property comparison tool, and Fort Myers Cape Coral local market spotlight." },
      { title: "Javari Intel competitive and business intelligence", description: "Build intelligence platform: competitor website analyzer (tech stack, pricing, features, SEO), industry trend tracker via RSS and news aggregation, patent and trademark search, social listening for brand mentions, market size research assistant, supplier/vendor discovery, and SWOT analysis generator." },
      { title: "Javari Legal AI legal document and guidance platform", description: "Build legal platform: legal document library (1000+ templates), state-specific contract variations, plain-English legal explainer for common documents, small claims court guide, business entity comparison (LLC vs S-Corp vs C-Corp), IP basics (trademark, copyright, patent primer), and attorney directory with initial consultation booking." },
      { title: "Javari Spirits beverage discovery and affiliate platform", description: "Build spirits platform production-ready: whiskey/wine/beer/cocktail discovery, AI pairing recommendations, tasting note generator, collection tracker, purchase links via Drizly/Total Wine affiliates and 300+ Awin alcohol affiliate programs, food pairing AI, cocktail recipe library with video links, and bottle valuation estimator." },
      { title: "Javari Cards tarot oracle and vision system production", description: "Build cards platform production-ready: full tarot deck (78 cards) with AI interpretation engine, daily card pull with personalized reading, spread layouts (3-card past/present/future, Celtic cross, year ahead), oracle card decks, vision board builder, life map creator, journal integration, and daily influence push notification." },
      { title: "Javari Games Hub gaming community and discovery", description: "Build games hub: game library browser with genre/platform/rating filters, AI game recommendation engine, gaming news aggregator, achievement tracker, friend leaderboards, game deals aggregator (Steam, Epic, PSN, Xbox affiliate links), game streaming schedule helper, and esports event calendar." },
      { title: "Javari Shopping AI-powered product discovery", description: "Build shopping platform: natural language product search across Amazon/Target/Walmart affiliate APIs, price comparison engine, deal alert builder, gift idea generator (by recipient, occasion, budget), product review summarizer, wishlist builder with price drop alerts, and receipt organizer for purchases." },
      { title: "Javari News AI news aggregator and analyst", description: "Build news platform: personalized news feed by topic interests, AI news summary (3-sentence brief), bias indicator with sources across the political spectrum, fact-check links, topic deep-dive assistant, local Florida news section, breaking news alerts, save-for-later reading list, and weekly digest email." },
      { title: "Javari Insurance coverage navigator and comparator", description: "Build insurance platform: insurance type explainer (health, auto, home, life, business), coverage needs calculator, quote comparison widget via affiliate partnerships, policy document organizer with AI summary, claim tracking assistant, and open enrollment deadline calendar." },
      { title: "Javari HR Workforce small business HR suite", description: "Build HR platform: employee onboarding document generator, job description writer, offer letter builder, PTO tracker, performance review template generator, disciplinary notice builder, I-9 and W-4 completion guide, employee handbook generator, and Florida-specific labor law compliance checklist." },
      { title: "Javari Home Services contractor marketplace and tools", description: "Build home services platform: contractor directory (Fort Myers/Cape Coral focus initially), project cost estimator by room/project type, contractor review aggregator, permit requirements by Florida county, home maintenance schedule builder, DIY vs hire decision helper, and emergency service finder (24/7 plumber, electrician, HVAC)." },
      { title: "Javari Finance personal and business financial tools", description: "Build finance platform: personal budget builder with category tracking, debt snowball/avalanche calculator, net worth tracker, retirement savings projector, business cash flow forecaster, break-even analysis tool, tax estimate calculator (with CPA disclaimer), investment portfolio tracker, and financial goals timeline builder." },
      { title: "Javari Property Hub rental and property management", description: "Build property management platform: rental listing creator, tenant application processor, lease agreement generator, rent payment tracker, maintenance request manager, property expense logger, tenant communication log, eviction process guide (Florida-specific), and ROI calculator per property." },
      { title: "Javari Merch print-on-demand store builder", description: "Build merch platform: store builder with Printful/Printify integration, product catalog (t-shirts, hoodies, mugs, phone cases, posters), AI design generator for merch artwork, mockup previewer, Stripe checkout, order tracking, and CR AudioViz AI branded merchandise store as the flagship example." },
      { title: "Javari Outdoors adventure planning and gear", description: "Build outdoors platform: trail finder with difficulty/distance filters, camping site planner, gear checklist generator by activity type, weather integration for trip days, fishing spot database (Florida focus), hunting season calendar, gear review aggregator, and REI/Bass Pro affiliate product recommendations." },
      { title: "Javari Fitness AI personal trainer and wellness", description: "Build fitness platform: workout plan generator (goal + fitness level + equipment), exercise library with form descriptions, calorie and macro calculator, 30-day challenge builder, rest day recovery guide, gym vs home workout variants, supplement guide (with medical disclaimer), progress photo organizer, and food diary." },
      { title: "Javari Dating relationship and social connection", description: "Build dating/social platform: icebreaker question generator, date idea planner (location-based, budget-aware), relationship milestone tracker, love language quiz and compatibility guide, anniversary reminder, gift idea AI, and conversation starter library. Privacy-first, no personal data shared." },
      { title: "Javari Social community and content platform", description: "Build social platform: interest-based communities, post and reply feed, creator content monetization via tips, events calendar, member directory, direct messaging, content moderation tools, and cross-posting to Twitter/Facebook/LinkedIn from one composer." },
      { title: "CRAIverse virtual world foundation", description: "Build CRAIverse: avatar creation wizard (appearance, name, personality), virtual districts (Creator Quarter, Veterans Hall, Faith Circle, Rescue Row, Marketplace Plaza), user-owned virtual spaces (free starter lot, premium lots purchasable with credits), community events calendar, and geographic targeting for Fort Myers/Cape Coral businesses as first market." },
      { title: "Javari Construction project management for builders", description: "Build construction platform: project timeline builder, materials cost estimator, subcontractor management, permit tracker, daily progress photo log, client communication portal, invoice and payment tracker, safety checklist builder, and Florida building code reference library." },
      { title: "Javari Supply Chain procurement and vendor management", description: "Build supply chain platform: vendor directory and RFQ builder, purchase order generator, inventory tracker, lead time calculator, supplier risk assessment AI, commodity price tracker, import/export compliance guide, freight cost estimator, and contract renewal calendar." },
      { title: "Javari Manufacturing production and quality tools", description: "Build manufacturing platform: production run planner, BOM (bill of materials) builder, quality control checklist generator, equipment maintenance schedule, downtime tracker, ISO 9001 compliance checklist, supplier audit template, yield and waste calculator, and worker safety training module builder." },
    ]
  },
  {
    phase: "collector_vertical",
    tasks: [
      { title: "Javari Card Vault sports and trading card platform", description: "Build card vault: collection tracker with TCGPlayer/eBay price feeds, condition grading guide, portfolio value dashboard, card scanner via camera (mobile-ready), wantlist builder, trade matching with other collectors, PSA/BGS grading submission tracker, set completion tracker for Pokemon/MTG/Sports, and collection insurance value export." },
      { title: "Javari MTG Manager Magic the Gathering suite", description: "Build MTG platform: deck builder with Scryfall API integration, card price tracker, collection manager, tournament bracket builder, rule lookup assistant, card synergy suggester, draft simulator, format legality checker, trade value calculator, and price alert system." },
      { title: "Javari Vinyl Vault record collection manager", description: "Build vinyl platform: collection cataloger with Discogs API integration, play history log, condition tracker, wantlist with price alerts, record value estimator, listening room setup guide, cleaning and care tips, concert calendar for favorite artists, and seller listings with shipping calculator." },
      { title: "Javari Disney Vault Disney collectibles tracker", description: "Build Disney collector platform: pin trading tracker with Disney Pin DB integration, Funko Pop collection manager, park visit planner, limited edition release calendar, item value tracker, trade network, authentication guide, storage and display tips, and Disney shopping affiliate links." },
      { title: "Javari Watch Works timepiece collection platform", description: "Build watch platform: collection cataloger with Chrono24 value feeds, service history tracker, authentication guide, strap and bracelet organizer, watch rotation reminder, brand history library, investment grade tracker (vintage Rolex/Patek etc.), and buying guide for different budgets." },
      { title: "Javari Militaria Vault military collectibles platform", description: "Build militaria platform: authentication guide by era and nationality, collection cataloger, research assistant (unit history, medal citations), restoration guidance, storage best practices, valuation guide, veteran connection feature (link items to service history), and respectful marketplace integration." },
      { title: "Javari Scrapbook digital memory and legacy platform", description: "Build scrapbook platform: drag-drop photo and memory upload, AI caption and story generator from photos, timeline view by date, family tree integration, memory sharing (private family link), print-to-book export via Shutterfly/Snapfish affiliate, birthday and anniversary reminder, and video memory slideshow generator." },
    ]
  },
  {
    phase: "business_tools",
    tasks: [
      { title: "Javari Business Formation LLC S-Corp C-Corp wizard", description: "Build business formation platform: state-by-state formation guide (priority: Florida, Texas, California, Delaware), entity type comparison tool, registered agent finder, EIN application walkthrough, operating agreement generator, banking setup checklist, business license finder by industry and state, and annual report reminder system. Affiliate with LegalZoom/ZenBusiness." },
      { title: "Javari Business Admin operations command center", description: "Build business admin platform: all-in-one dashboard for small businesses, CRM with contact and deal tracking, project management (kanban and list view), time tracking with invoicing integration, expense manager with receipt OCR, vendor payment tracker, team task assignment, and QuickBooks/Xero data export." },
      { title: "Javari Cover Letter Generator job search suite", description: "Build cover letter platform: job posting URL or text input to AI-generated tailored cover letter, tone selector (confident/humble/creative/executive), company research integration, multiple format templates, LinkedIn easy apply optimization, follow-up email generator, and interview prep question predictor." },
      { title: "Javari Social Posts AI social content factory", description: "Build social posts platform: content calendar builder, 30-day post plan generator from a single topic, platform-specific formatting (Twitter threads, LinkedIn articles, Instagram carousels, Facebook posts, TikTok scripts), hashtag research, best time to post guide, caption variations A/B tester, and brand voice consistency checker." },
      { title: "Javari Docs Management document intelligence system", description: "Build docs platform: AI-powered document search across all uploads, version control with diff view, template library (50+ business templates), collaborative editing with comment threads, approval workflow (draft to review to approved), document expiry alerts, and NDA/contract signature routing." },
      { title: "Javari Newsletter email publication platform", description: "Build newsletter platform: Substack-alternative with Javari AI writing assistant, subscriber management, template designer, paid subscriber tiers with Stripe, open and click analytics, AI content suggestions from web trends, repurpose to LinkedIn/Twitter one-click, and SEO archive page for all issues." },
      { title: "Javari Partners affiliate and partnership hub", description: "Build partner platform: partner directory (agencies, consultants, resellers), partner onboarding portal, co-marketing asset library, deal registration system, partner performance dashboard, commission tracking, training and certification program, and Javari partner badge for use on partner websites." },
      { title: "Javari Verify identity and credential verification", description: "Build verification platform: business identity verification (EIN lookup, state license check), freelancer credential verification (LinkedIn import, portfolio review), product authentication service (generate QR-coded certificates of authenticity), digital credential badges (for course completions, certifications), and trust score display on user profiles." },
      { title: "Javari Invoice billing and payments platform", description: "Build invoice platform: multi-client management, line item templates, recurring invoice automation, tax rate by state, partial payment tracking, payment reminders (3 levels: friendly, firm, final), client portal for payment, expense categorization for taxes, and annual income summary export for CPA." },
      { title: "Javari Presentation Maker professional decks", description: "Build presentation platform: 30 professional templates (startup pitch, board update, sales deck, training deck, client proposal), AI content for each slide, real data chart builder, Unsplash image integration, speaker notes AI, PPTX and PDF export, shareable link, and Javari-branded slide theme." },
    ]
  },
  {
    phase: "infrastructure",
    tasks: [
      { title: "4 missing Supabase tables create and index", description: "Create the 4 missing tables via SQL migration: autonomy_execution_log (task_id, model_used, cost_estimate, execution_time, status, error_message, tokens_in, tokens_out, provider, task_type, cycle_id, logged_at), javari_scheduler_lock (lock_key, cycle_id, acquired_at, expires_at, holder), javari_security_events (event_type, threat_level, detail, user_id, endpoint, occurred_at), javari_model_usage_metrics (id, occurred_at, provider, model, task_type, tokens_in, tokens_out, latency_ms, cost_usd, success). Add all indexes. Verify via REST API." },
      { title: "Canonical Vector Memory complete ingest pipeline", description: "Complete Step 11 of Canonical Vector Memory: ingest all 34 markdown documents from R2 cold-storage/consolidation-docs/ into canonical_memories table with OpenAI text-embedding-3-small embeddings. Build GET /api/canonical/search cosine similarity endpoint. Inject top-3 results as context into every Javari AI response. This gives Javari self-knowledge about the entire platform." },
      { title: "Admin dashboard complete all 12 panels", description: "Complete admin dashboard: Control Tower (live system health), User Management (search/ban/credit-grant), Revenue (MRR/ARR/churn), Javari AI (execution logs, cost, learning scores), Security (threat events, failed logins, rate limits), Scheduler (cron health, next runs), Support (ticket queue), Approvals (marketplace listings), Analytics (traffic, conversion, retention), Learning (domain scores), Operations (queue depth, worker status), and Alerts (threshold-based notifications)." },
      { title: "Security hardening OWASP Top 10 full pass", description: "Complete OWASP Top 10 security audit and fixes: SQL injection protection via parameterized queries, XSS prevention (sanitize all user inputs), CSRF tokens on all state-changing forms, broken auth audit (verify all protected routes require session), security headers (CSP, HSTS, X-Frame-Options), rate limiting on all API routes (100 req/min per IP), and secrets rotation schedule." },
      { title: "Automated backup system daily snapshots to R2", description: "Build BackupOS: nightly Supabase pg_dump triggered at 2 AM ET, encrypted with AES-256 and uploaded to R2 backups bucket, 30-day retention with auto-delete, restore procedure tested monthly, backup health check in admin dashboard, and alert if backup fails." },
      { title: "Error monitoring Sentry full integration", description: "Integrate error monitoring: Sentry DSN configured for frontend (React error boundary capture) and backend (API route error capture), source maps uploaded for production, error grouping and alert rules (alert if error rate more than 1% in 5 minutes), user session replay for error context (privacy-compliant), and weekly error digest email." },
      { title: "Analytics PostHog full integration", description: "Integrate product analytics: PostHog tracking all page views, feature usage events, funnel analysis (signup to first tool to first payment), cohort retention charts, session recording for UX research, A/B testing framework for pricing and onboarding, and weekly metrics digest to Roy." },
      { title: "Email automation full lifecycle sequences", description: "Build email automation with Resend: welcome sequence (Day 0: welcome and 3 tips, Day 3: feature spotlight, Day 7: success story, Day 14: upgrade nudge), re-engagement series (7/14/21 days inactive), credit low alert, subscription confirmation/cancellation, payment failure dunning (3 attempts), and monthly product update newsletter." },
      { title: "Mobile app foundation React Native with Expo", description: "Start javari-mobile: React Native and Expo project scaffold, shared API client with web, auth flow (login/signup/social), bottom tab navigator (Home, Tools, Chat, Community, Profile), push notification permission request, biometric authentication option, offline mode indicator, and App Store and Google Play submission checklist." },
      { title: "API rate limiting and abuse prevention", description: "Implement comprehensive rate limiting: per-IP limits (100/min general, 10/min AI endpoints, 5/min auth endpoints), per-user credit circuit breaker (pause if 10x normal usage in 1 hour), bot detection via user-agent and pattern analysis, honeypot fields on signup form, email verification required for AI features, and abuse reporting endpoint." },
    ]
  },
  {
    phase: "branding_gtm",
    tasks: [
      { title: "Brand identity system complete visual standards", description: "Create complete CR AudioViz AI and Javari AI brand system: logo variations (full, icon, wordmark, dark/light), color palette (primary blue #2563EB, secondary slate, accent gold #F59E0B), typography (Inter for UI, Playfair Display for hero headlines), icon library (consistent Lucide set), illustration style guide, photography direction, and brand voice guide (Your Story. Our Design. — warm, expert, empowering)." },
      { title: "Landing page redesign craudiovizai.com hero", description: "Redesign craudiovizai.com homepage hero: above-fold value proposition (who we serve + what we do + why now), animated Javari AI demo widget, social proof (X users, Y tools, Z modules), module category tiles with hover preview, trust badges (WCAG AA, OWASP, Fort Myers-based), and clear CTA hierarchy (Try Free to See Plans to Book Demo)." },
      { title: "javariai.com full site public marketing pages", description: "Build complete javariai.com public site: homepage with Javari AI demo, About Us (Roy and Cindy story, mission, Fort Myers roots), How It Works (3-step: sign up to choose tools to create), Use Cases (for creators, businesses, nonprofits, veterans), Blog (seeded with 10 SEO articles), Press page, and Careers page (Coming soon with email capture)." },
      { title: "Content seeding 50 SEO blog posts via Javari AI", description: "Generate and publish 50 SEO-optimized blog posts across craudiovizai.com and javariai.com: 10 posts per category (AI Tools for Business, Social Impact Tech, Creator Economy, Florida Business, Tool Reviews), target keywords with 500-5000 monthly searches, internal linking strategy, featured image generation, and auto-submit to Google Search Console." },
      { title: "Social media presence launch all channels", description: "Launch and populate social channels: Twitter/X (@JavariAI and @CRAudioVizAI), LinkedIn company pages, Instagram, Facebook business page, TikTok, and YouTube channel. Seed each with 10 posts/videos. Build Javari Social Posts tool to auto-generate daily content. Set up hub page at javariai.com/social." },
      { title: "Help Center and documentation site", description: "Build help center at /help: searchable knowledge base (100+ articles), getting started guides, video tutorials (5 core workflows), API documentation for developers, community forum powered by Supabase, chatbot powered by Javari AI for instant answers, and changelog page showing platform updates." },
      { title: "Testimonial and social proof engine", description: "Build social proof system: beta user outreach for testimonials (5 per use case: creator, veteran, faith leader, business owner, rescue org), testimonial submission form, approval workflow, display widgets for homepage and pricing page, case study builder (before/after format), star rating aggregation, and G2/Capterra profile setup." },
      { title: "PR and launch strategy press release and outreach", description: "Create full launch PR package: press release (CR AudioViz AI launches Javari AI — the AI operating system for human creativity), pitch list (TechCrunch, Mashable, Forbes, Florida Trend, Fort Myers News-Press), HARO monitoring setup, founder story for LinkedIn (Roy's vision), and 30-day launch announcement campaign calendar." },
    ]
  }
];

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-ingest-secret");
  if (secret !== "javari-master-ingest-2026") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const allRows: Array<{
    id: string; phase_id: string; title: string; description: string;
    depends_on: string[]; status: string; source: string; updated_at: number;
  }> = [];

  let idx = 500;
  for (const phaseDef of MASTER_ROADMAP) {
    for (const t of phaseDef.tasks) {
      allRows.push({
        id: taskId(phaseDef.phase, t.title, idx),
        phase_id: phaseDef.phase,
        title: t.title,
        description: t.description,
        depends_on: [],
        status: "pending",
        source: "master_roadmap_v1",
        updated_at: Date.now(),
      });
      idx++;
    }
  }

  const { data: existing } = await supabase
    .from("roadmap_tasks")
    .select("title");
  const existingTitles = new Set((existing ?? []).map((r: { title: string }) => r.title));
  const toInsert = allRows.filter(r => !existingTitles.has(r.title));

  const inserted: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];
  const skipped = allRows.length - toInsert.length;

  // Insert in batches of 20
  for (let i = 0; i < toInsert.length; i += 20) {
    const batch = toInsert.slice(i, i + 20);
    const { error } = await supabase.from("roadmap_tasks").insert(batch);
    if (error) {
      batch.forEach(r => failed.push({ id: r.id, error: error.message }));
    } else {
      batch.forEach(r => inserted.push(r.id));
    }
  }

  const phases = [...new Set(allRows.map(r => r.phase_id))];

  return NextResponse.json({
    ok: failed.length === 0,
    phases_detected: phases.length,
    phases,
    total_tasks: allRows.length,
    inserted: inserted.length,
    skipped,
    failed: failed.length,
    failed_details: failed.slice(0, 5),
    message: `Master ecosystem roadmap: ${inserted.length} new tasks seeded across ${phases.length} phases. ${skipped} already existed.`,
  });
}

export async function GET() {
  const { count } = await supabase
    .from("roadmap_tasks")
    .select("*", { count: "exact", head: true });
  return NextResponse.json({
    total_tasks_in_db: count,
    message: "POST with x-ingest-secret: javari-master-ingest-2026 to seed master roadmap"
  });
}
