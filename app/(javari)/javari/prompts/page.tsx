"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Code, 
  Palette, 
  TrendingUp, 
  GraduationCap, 
  Heart, 
  Briefcase,
  Lightbulb,
  FileText,
  Copy,
  Check,
  BarChart3,
  Users,
  Target
} from 'lucide-react'

interface PromptExample {
  title: string
  prompt: string
  tags: string[]
}

interface PromptCategory {
  name: string
  icon: any
  color: string
  prompts: PromptExample[]
}

const PROMPT_CATEGORIES: PromptCategory[] = [
  {
    name: "Creative Writing",
    icon: Palette,
    color: "from-purple-500 to-pink-500",
    prompts: [
      {
        title: "Story Generator",
        prompt: "Write a short story about [topic] in the style of [author/genre]. Include themes of [theme1] and [theme2].",
        tags: ["creative", "storytelling", "fiction"]
      },
      {
        title: "Social Media Content",
        prompt: "Create 5 engaging social media posts about [product/service] for [platform]. Include relevant hashtags and CTAs.",
        tags: ["marketing", "social", "content"]
      },
      {
        title: "Blog Post Ideas",
        prompt: "Generate 10 blog post titles about [industry/topic] that would rank well for SEO and engage readers.",
        tags: ["blogging", "seo", "content"]
      },
      {
        title: "Product Description",
        prompt: "Write compelling product descriptions for [product] highlighting benefits, features, and unique selling points. Tone: [conversational/professional].",
        tags: ["copywriting", "ecommerce", "content"]
      },
      {
        title: "Brand Voice Guide",
        prompt: "Develop a brand voice guide for [company] including tone, language style, do's and don'ts, and example phrases for [audience].",
        tags: ["branding", "content-strategy", "marketing"]
      },
      {
        title: "Video Script",
        prompt: "Write a [duration] video script for [platform] about [topic]. Include hook, key points, transitions, and strong CTA.",
        tags: ["video", "script", "content"]
      },
      {
        title: "Press Release",
        prompt: "Write a professional press release announcing [news/event]. Include headline, dateline, boilerplate, and media contact information.",
        tags: ["pr", "media", "corporate"]
      },
      {
        title: "Tagline Generator",
        prompt: "Create 15 memorable taglines for [company/product] that capture [key benefit/emotion]. Target audience: [demographics].",
        tags: ["branding", "copywriting", "marketing"]
      },
      {
        title: "Newsletter Content",
        prompt: "Write a monthly newsletter for [company/organization] including [number] main stories, updates, and engagement opportunities.",
        tags: ["email", "content", "engagement"]
      },
      {
        title: "Podcast Episode Outline",
        prompt: "Create a detailed outline for a [duration] podcast episode about [topic]. Include intro, main segments, questions, and outro.",
        tags: ["podcast", "audio", "content"]
      }
    ]
  },
  {
    name: "Code & Development",
    icon: Code,
    color: "from-blue-500 to-cyan-500",
    prompts: [
      {
        title: "Debug Code",
        prompt: "Review this [language] code and identify bugs, security issues, and performance improvements:\n\n[paste code here]",
        tags: ["debugging", "code-review", "optimization"]
      },
      {
        title: "Build Feature",
        prompt: "Write a [language/framework] function that [functionality]. Include error handling, type safety, and comments.",
        tags: ["development", "feature", "best-practices"]
      },
      {
        title: "Refactor Code",
        prompt: "Refactor this code to be more maintainable, efficient, and follow [style guide] best practices:\n\n[paste code]",
        tags: ["refactoring", "clean-code", "optimization"]
      },
      {
        title: "API Integration",
        prompt: "Create a [language] module to integrate with [API name]. Include authentication, error handling, rate limiting, and retry logic.",
        tags: ["api", "integration", "backend"]
      },
      {
        title: "Database Schema",
        prompt: "Design a database schema for [application type] handling [data types]. Include tables, relationships, indexes, and migration strategy.",
        tags: ["database", "architecture", "design"]
      },
      {
        title: "Unit Tests",
        prompt: "Write comprehensive unit tests for this [language] function using [testing framework]. Cover edge cases and error conditions:\n\n[paste function]",
        tags: ["testing", "quality", "tdd"]
      },
      {
        title: "CI/CD Pipeline",
        prompt: "Create a CI/CD pipeline configuration for [platform] that runs tests, builds [application], and deploys to [environment].",
        tags: ["devops", "automation", "deployment"]
      },
      {
        title: "Code Documentation",
        prompt: "Generate comprehensive documentation for this codebase including README, API docs, setup instructions, and contribution guidelines.",
        tags: ["documentation", "developer-experience", "onboarding"]
      },
      {
        title: "Performance Optimization",
        prompt: "Analyze this [language/framework] code for performance bottlenecks. Suggest specific optimizations with benchmarks and trade-offs.",
        tags: ["performance", "optimization", "profiling"]
      },
      {
        title: "Security Audit",
        prompt: "Conduct a security audit of this [language] application. Identify vulnerabilities, suggest fixes, and recommend security best practices.",
        tags: ["security", "audit", "compliance"]
      }
    ]
  },
  {
    name: "Business & Strategy",
    icon: Briefcase,
    color: "from-green-500 to-emerald-500",
    prompts: [
      {
        title: "Market Analysis",
        prompt: "Analyze the market for [product/service] in [region]. Include competitor analysis, target audience, and growth opportunities.",
        tags: ["analysis", "strategy", "market-research"]
      },
      {
        title: "Business Plan",
        prompt: "Create a business plan outline for [business idea] including executive summary, market analysis, financial projections, and marketing strategy.",
        tags: ["planning", "strategy", "startup"]
      },
      {
        title: "SWOT Analysis",
        prompt: "Perform a SWOT analysis for [company/product] considering current market conditions and competitive landscape.",
        tags: ["analysis", "strategy", "planning"]
      },
      {
        title: "Competitive Intelligence",
        prompt: "Research and analyze top 5 competitors for [product/service]. Compare features, pricing, positioning, and identify gaps we can exploit.",
        tags: ["competition", "research", "strategy"]
      },
      {
        title: "Go-to-Market Strategy",
        prompt: "Develop a go-to-market strategy for [product] targeting [audience]. Include positioning, channels, timeline, and success metrics.",
        tags: ["gtm", "launch", "strategy"]
      },
      {
        title: "Pricing Strategy",
        prompt: "Design a pricing strategy for [product/service] considering value proposition, competitors, and target market. Include multiple tiers.",
        tags: ["pricing", "monetization", "strategy"]
      },
      {
        title: "Partnership Pitch",
        prompt: "Create a partnership proposal for [company] highlighting mutual benefits, integration opportunities, and success metrics for [partnership type].",
        tags: ["partnerships", "business-development", "pitch"]
      },
      {
        title: "Investor Pitch Deck",
        prompt: "Outline a 15-slide investor pitch deck for [company]. Include problem, solution, market size, traction, team, and funding ask.",
        tags: ["fundraising", "investors", "pitch"]
      },
      {
        title: "Quarterly OKRs",
        prompt: "Develop OKRs for [department/company] for Q[number]. Include 3-5 objectives with measurable key results and alignment to company goals.",
        tags: ["okrs", "goals", "planning"]
      },
      {
        title: "Exit Strategy Analysis",
        prompt: "Analyze potential exit strategies for [company] including M&A targets, IPO readiness, and timeline. Consider market conditions and valuation.",
        tags: ["exit", "strategy", "valuation"]
      }
    ]
  },
  {
    name: "Marketing & SEO",
    icon: TrendingUp,
    color: "from-orange-500 to-red-500",
    prompts: [
      {
        title: "SEO Keywords",
        prompt: "Generate a list of high-value SEO keywords for [product/service] targeting [audience]. Include long-tail keywords and search intent.",
        tags: ["seo", "keywords", "optimization"]
      },
      {
        title: "Email Campaign",
        prompt: "Write a 5-email drip campaign for [product launch/service]. Include subject lines, preview text, and CTAs for each email.",
        tags: ["email", "campaign", "marketing"]
      },
      {
        title: "Ad Copy",
        prompt: "Create compelling ad copy for [platform] promoting [product/service]. Target audience: [demographics]. Include 3 variations.",
        tags: ["advertising", "copywriting", "marketing"]
      },
      {
        title: "Content Calendar",
        prompt: "Design a 90-day content calendar for [brand] across [platforms]. Include themes, post types, frequency, and campaign alignment.",
        tags: ["content-planning", "social-media", "strategy"]
      },
      {
        title: "Landing Page Copy",
        prompt: "Write conversion-focused landing page copy for [offer]. Include headline, subheadings, benefits, social proof, and CTA.",
        tags: ["conversion", "copywriting", "web"]
      },
      {
        title: "Influencer Campaign",
        prompt: "Plan an influencer marketing campaign for [product]. Identify ideal influencers, messaging, deliverables, and success metrics.",
        tags: ["influencer", "campaign", "social"]
      },
      {
        title: "Marketing Funnel",
        prompt: "Map out a complete marketing funnel for [product/service] from awareness to retention. Include tactics for each stage and conversion goals.",
        tags: ["funnel", "strategy", "conversion"]
      },
      {
        title: "A/B Test Hypothesis",
        prompt: "Create 5 A/B test hypotheses for [webpage/email/ad]. Include what to test, expected outcome, and success metrics.",
        tags: ["testing", "optimization", "data"]
      },
      {
        title: "Retargeting Strategy",
        prompt: "Develop a retargeting strategy for [audience segment]. Include ad sequences, frequency caps, budget allocation, and conversion optimization.",
        tags: ["retargeting", "paid-media", "conversion"]
      },
      {
        title: "Brand Positioning Statement",
        prompt: "Craft a brand positioning statement for [company/product]: For [target] who [need], [brand] is [category] that [benefit]. Unlike [competitors], we [differentiator].",
        tags: ["branding", "positioning", "strategy"]
      }
    ]
  },
  {
    name: "Learning & Education",
    icon: GraduationCap,
    color: "from-indigo-500 to-purple-500",
    prompts: [
      {
        title: "Explain Concept",
        prompt: "Explain [complex concept] in simple terms, using analogies and real-world examples. Target audience: [level].",
        tags: ["education", "explanation", "learning"]
      },
      {
        title: "Study Plan",
        prompt: "Create a 30-day study plan to learn [skill/subject]. Include daily goals, resources, and practice exercises.",
        tags: ["learning", "planning", "education"]
      },
      {
        title: "Quiz Generator",
        prompt: "Generate 10 multiple-choice questions about [topic] with varying difficulty levels. Include correct answers and explanations.",
        tags: ["assessment", "education", "quiz"]
      },
      {
        title: "Course Curriculum",
        prompt: "Design a comprehensive curriculum for a [duration] course on [subject]. Include modules, learning objectives, assessments, and resources.",
        tags: ["curriculum", "course-design", "education"]
      },
      {
        title: "Learning Path",
        prompt: "Create a learning path to become [job title/expert in field]. Include foundational topics, intermediate skills, advanced concepts, and project ideas.",
        tags: ["career", "learning", "skill-development"]
      },
      {
        title: "Teaching Script",
        prompt: "Write a detailed teaching script for a [duration] lesson on [topic] for [grade/level]. Include activities, questions, and assessment.",
        tags: ["teaching", "lesson-plan", "education"]
      },
      {
        title: "Flashcard Set",
        prompt: "Create 50 flashcards for studying [subject/exam]. Include questions on front and detailed answers with explanations on back.",
        tags: ["study", "memorization", "review"]
      },
      {
        title: "Project-Based Learning",
        prompt: "Design a project-based learning experience where students learn [concept] by building [project]. Include milestones and rubric.",
        tags: ["pbl", "hands-on", "education"]
      },
      {
        title: "Certification Prep",
        prompt: "Create a study guide for [certification exam]. Cover all exam objectives, key concepts, practice questions, and test-taking strategies.",
        tags: ["certification", "exam-prep", "professional"]
      },
      {
        title: "Tutorial Series",
        prompt: "Outline a tutorial series teaching [skill] from beginner to advanced. Include 10 tutorials with topics, prerequisites, and projects.",
        tags: ["tutorial", "training", "content"]
      }
    ]
  },
  {
    name: "Personal Productivity",
    icon: Lightbulb,
    color: "from-yellow-500 to-amber-500",
    prompts: [
      {
        title: "Goal Planning",
        prompt: "Help me create SMART goals for [area of life] and break them down into actionable monthly and weekly tasks.",
        tags: ["goals", "planning", "productivity"]
      },
      {
        title: "Time Management",
        prompt: "Analyze my daily schedule and suggest time-blocking strategies to improve productivity for [specific role/goals].",
        tags: ["time-management", "productivity", "optimization"]
      },
      {
        title: "Habit Tracker",
        prompt: "Design a habit-building plan to develop [habit] over 30 days. Include triggers, rewards, and accountability measures.",
        tags: ["habits", "personal-development", "planning"]
      },
      {
        title: "Decision Framework",
        prompt: "Create a decision-making framework for [type of decision]. Include criteria, weighting system, and evaluation process.",
        tags: ["decision-making", "framework", "thinking"]
      },
      {
        title: "Morning Routine",
        prompt: "Design an optimal morning routine for [goals/lifestyle] that takes [duration] and includes [priorities]. Optimize for energy and productivity.",
        tags: ["routine", "habits", "wellness"]
      },
      {
        title: "Task Prioritization",
        prompt: "Help me prioritize this list of tasks using [Eisenhower Matrix/other method]. Consider urgency, importance, and impact on [goals].",
        tags: ["prioritization", "productivity", "planning"]
      },
      {
        title: "Focus Strategy",
        prompt: "Create a deep work strategy to complete [project] while managing distractions. Include time blocks, environment setup, and accountability.",
        tags: ["focus", "deep-work", "productivity"]
      },
      {
        title: "Weekly Review",
        prompt: "Design a weekly review template covering accomplishments, challenges, lessons learned, and priorities for next week aligned with [goals].",
        tags: ["reflection", "planning", "improvement"]
      },
      {
        title: "Energy Management",
        prompt: "Analyze my energy patterns and suggest a schedule that aligns high-focus tasks with peak energy times for [work type].",
        tags: ["energy", "optimization", "wellness"]
      },
      {
        title: "Accountability System",
        prompt: "Create an accountability system for [goal] including check-ins, progress tracking, consequences, and celebration milestones.",
        tags: ["accountability", "goals", "systems"]
      }
    ]
  },
  {
    name: "Health & Wellness",
    icon: Heart,
    color: "from-pink-500 to-rose-500",
    prompts: [
      {
        title: "Workout Plan",
        prompt: "Create a [duration] workout plan for [fitness goal]. Include exercises, sets, reps, and rest days. Fitness level: [beginner/intermediate/advanced].",
        tags: ["fitness", "health", "exercise"]
      },
      {
        title: "Meal Planning",
        prompt: "Generate a 7-day meal plan for [dietary preference] with approximately [calories] per day. Include grocery list.",
        tags: ["nutrition", "meal-prep", "health"]
      },
      {
        title: "Mindfulness Guide",
        prompt: "Create a daily mindfulness routine to reduce [specific concern]. Include meditation techniques and scheduling suggestions.",
        tags: ["mental-health", "mindfulness", "wellness"]
      },
      {
        title: "Sleep Optimization",
        prompt: "Design a sleep optimization plan to improve [sleep issue]. Include evening routine, environment setup, and tracking methods.",
        tags: ["sleep", "recovery", "wellness"]
      },
      {
        title: "Stress Management",
        prompt: "Develop a personalized stress management toolkit for [stressor type]. Include techniques, timing, and escalation strategies.",
        tags: ["stress", "mental-health", "coping"]
      },
      {
        title: "Flexibility Routine",
        prompt: "Create a [duration] daily flexibility and mobility routine targeting [problem areas]. Include stretches, holds, and progression.",
        tags: ["flexibility", "mobility", "recovery"]
      },
      {
        title: "Health Goals",
        prompt: "Set 90-day health goals for [aspect] with specific metrics. Include weekly milestones, tracking method, and reward system.",
        tags: ["goals", "health", "tracking"]
      },
      {
        title: "Supplement Plan",
        prompt: "Research and suggest a supplement protocol for [health goal]. Include dosages, timing, interactions, and monitoring recommendations.",
        tags: ["supplements", "nutrition", "wellness"]
      },
      {
        title: "Injury Recovery",
        prompt: "Design a recovery protocol for [injury type]. Include rest periods, rehabilitation exercises, progression criteria, and prevention strategies.",
        tags: ["recovery", "rehabilitation", "fitness"]
      },
      {
        title: "Longevity Protocol",
        prompt: "Create a comprehensive longevity protocol covering exercise, nutrition, sleep, stress, and preventive health for [age/goals].",
        tags: ["longevity", "wellness", "prevention"]
      }
    ]
  },
  {
    name: "Document Creation",
    icon: FileText,
    color: "from-teal-500 to-cyan-500",
    prompts: [
      {
        title: "Professional Email",
        prompt: "Write a professional email to [recipient] regarding [topic]. Tone: [formal/casual]. Include clear action items.",
        tags: ["email", "communication", "professional"]
      },
      {
        title: "Report Template",
        prompt: "Create a [type of report] template for [purpose]. Include all essential sections and formatting guidelines.",
        tags: ["reports", "templates", "documentation"]
      },
      {
        title: "Presentation Outline",
        prompt: "Outline a [duration] presentation about [topic] for [audience]. Include key points, transitions, and call-to-action.",
        tags: ["presentation", "outline", "communication"]
      },
      {
        title: "Meeting Agenda",
        prompt: "Create a detailed meeting agenda for [meeting type] with [participants]. Include objectives, time allocations, and pre-work.",
        tags: ["meetings", "agenda", "productivity"]
      },
      {
        title: "Policy Document",
        prompt: "Draft a [policy type] document for [organization]. Include purpose, scope, procedures, responsibilities, and compliance requirements.",
        tags: ["policy", "governance", "compliance"]
      },
      {
        title: "RFP Response",
        prompt: "Structure a response to this RFP for [service/product]. Include executive summary, solution overview, timeline, and pricing.",
        tags: ["rfp", "sales", "proposal"]
      },
      {
        title: "SOP Documentation",
        prompt: "Write a standard operating procedure for [process]. Include step-by-step instructions, roles, tools, and quality checks.",
        tags: ["sop", "procedures", "documentation"]
      },
      {
        title: "Case Study",
        prompt: "Write a case study about [client/project] following the structure: Challenge, Solution, Implementation, Results. Include specific metrics.",
        tags: ["case-study", "marketing", "proof"]
      },
      {
        title: "Legal Contract",
        prompt: "Draft a [contract type] between [party1] and [party2]. Include terms, conditions, obligations, and termination clauses. (Review with legal counsel)",
        tags: ["legal", "contracts", "agreements"]
      },
      {
        title: "Executive Summary",
        prompt: "Create an executive summary for [document/report] that captures key findings, recommendations, and required decisions in one page.",
        tags: ["executive", "summary", "leadership"]
      }
    ]
  },
  {
    name: "Data Analysis & Research",
    icon: BarChart3,
    color: "from-violet-500 to-purple-500",
    prompts: [
      {
        title: "Data Analysis Plan",
        prompt: "Design an analysis plan for [dataset/question]. Include hypotheses, metrics, statistical methods, and visualization approach.",
        tags: ["analysis", "planning", "statistics"]
      },
      {
        title: "Survey Design",
        prompt: "Create a survey to measure [objective] for [audience]. Include 15-20 questions covering [topics] with appropriate scales.",
        tags: ["survey", "research", "data-collection"]
      },
      {
        title: "Dashboard Specification",
        prompt: "Specify requirements for a [type] dashboard showing [metrics] for [users]. Include KPIs, filters, refresh rate, and drill-down capabilities.",
        tags: ["dashboard", "visualization", "bi"]
      },
      {
        title: "Research Methodology",
        prompt: "Design a research methodology to answer [research question]. Include approach, data sources, sample size, and analysis techniques.",
        tags: ["research", "methodology", "academic"]
      },
      {
        title: "Cohort Analysis",
        prompt: "Outline a cohort analysis for [product/service] to understand [behavior]. Define cohorts, time periods, metrics, and segmentation.",
        tags: ["cohort", "analysis", "retention"]
      },
      {
        title: "Predictive Model",
        prompt: "Design a predictive model to forecast [outcome] using [available data]. Include features, algorithm selection, and validation approach.",
        tags: ["ml", "prediction", "modeling"]
      },
      {
        title: "User Research Study",
        prompt: "Plan a user research study to understand [user behavior/need]. Include methodology, participant criteria, questions, and analysis framework.",
        tags: ["ux-research", "user-study", "insights"]
      },
      {
        title: "Competitive Benchmarking",
        prompt: "Design a benchmarking study comparing [company/product] to competitors on [dimensions]. Include data sources and evaluation criteria.",
        tags: ["benchmarking", "competition", "analysis"]
      },
      {
        title: "Trend Analysis",
        prompt: "Analyze trends in [industry/metric] over [timeframe]. Identify patterns, inflection points, and predict future direction with confidence intervals.",
        tags: ["trends", "forecasting", "analysis"]
      },
      {
        title: "Root Cause Analysis",
        prompt: "Conduct a root cause analysis for [problem]. Use [method: 5 Whys/Fishbone/etc]. Document findings and recommended corrective actions.",
        tags: ["rca", "problem-solving", "quality"]
      }
    ]
  },
  {
    name: "Sales & Customer Success",
    icon: Users,
    color: "from-blue-500 to-indigo-500",
    prompts: [
      {
        title: "Sales Pitch",
        prompt: "Write a compelling sales pitch for [product/service] targeting [persona]. Address pain points, differentiation, and include clear CTA.",
        tags: ["sales", "pitch", "prospecting"]
      },
      {
        title: "Cold Email Sequence",
        prompt: "Create a 5-email cold outreach sequence for [target]. Include personalization hooks, value props, and multiple CTAs.",
        tags: ["cold-email", "outreach", "sales"]
      },
      {
        title: "Customer Onboarding",
        prompt: "Design a 30-day onboarding plan for new customers of [product]. Include touchpoints, training, milestones, and success metrics.",
        tags: ["onboarding", "customer-success", "retention"]
      },
      {
        title: "Objection Handling",
        prompt: "Create a guide to handle the top 10 objections for [product/service]. Include empathy statements, rebuttals, and proof points.",
        tags: ["objections", "sales", "training"]
      },
      {
        title: "Customer Success Playbook",
        prompt: "Build a customer success playbook for [product] covering health scoring, engagement strategies, expansion plays, and churn prevention.",
        tags: ["cs", "playbook", "retention"]
      },
      {
        title: "Demo Script",
        prompt: "Write a demo script for [product] tailored to [persona]. Include discovery questions, feature walkthrough, and trial close.",
        tags: ["demo", "sales", "presentation"]
      },
      {
        title: "Upsell Strategy",
        prompt: "Develop an upsell strategy for existing customers of [product]. Identify triggers, messaging, packages, and success metrics.",
        tags: ["upsell", "expansion", "revenue"]
      },
      {
        title: "Customer Feedback Form",
        prompt: "Create a customer feedback survey for [product/service]. Include NPS, satisfaction, feature requests, and testimonial capture.",
        tags: ["feedback", "survey", "voice-of-customer"]
      },
      {
        title: "Sales Battlecard",
        prompt: "Create a battlecard for competing against [competitor]. Include their strengths, weaknesses, positioning, and winning strategies.",
        tags: ["competitive", "sales-enablement", "positioning"]
      },
      {
        title: "Renewal Campaign",
        prompt: "Design a renewal campaign for customers with contracts expiring in [timeframe]. Include touchpoint sequence, messaging, and incentives.",
        tags: ["renewal", "retention", "campaign"]
      }
    ]
  },
  {
    name: "Project Management",
    icon: Target,
    color: "from-emerald-500 to-teal-500",
    prompts: [
      {
        title: "Project Charter",
        prompt: "Create a project charter for [project] including objectives, scope, stakeholders, timeline, budget, and success criteria.",
        tags: ["charter", "planning", "initiation"]
      },
      {
        title: "Risk Assessment",
        prompt: "Conduct a risk assessment for [project]. Identify risks, likelihood, impact, mitigation strategies, and contingency plans.",
        tags: ["risk", "planning", "mitigation"]
      },
      {
        title: "Resource Plan",
        prompt: "Develop a resource plan for [project] covering team structure, roles, allocation, skillsets needed, and hiring timeline.",
        tags: ["resources", "planning", "team"]
      },
      {
        title: "Sprint Planning",
        prompt: "Plan a 2-week sprint for [team] working on [project]. Include story points, capacity, priorities, and definition of done.",
        tags: ["agile", "sprint", "planning"]
      },
      {
        title: "Stakeholder Matrix",
        prompt: "Create a stakeholder analysis matrix for [project]. Map power/interest, communication needs, and engagement strategies.",
        tags: ["stakeholders", "communication", "planning"]
      },
      {
        title: "Change Management",
        prompt: "Design a change management plan for [change/initiative]. Cover communication, training, resistance handling, and adoption metrics.",
        tags: ["change", "adoption", "transformation"]
      },
      {
        title: "Project Status Report",
        prompt: "Write a weekly project status report for [project]. Include progress, risks, blockers, decisions needed, and next steps.",
        tags: ["status", "reporting", "communication"]
      },
      {
        title: "Retrospective Format",
        prompt: "Design a retrospective format for [team] to review [project/sprint]. Include exercises for what went well, improvements, and action items.",
        tags: ["retrospective", "agile", "improvement"]
      },
      {
        title: "Dependency Mapping",
        prompt: "Map dependencies for [project] including cross-team dependencies, external vendors, and critical path. Suggest mitigation strategies.",
        tags: ["dependencies", "planning", "coordination"]
      },
      {
        title: "Post-Mortem Template",
        prompt: "Create a post-mortem template for [incident/project]. Include timeline, root cause, impact, lessons learned, and action items.",
        tags: ["post-mortem", "lessons", "improvement"]
      },
      {
        title: "Product Roadmap",
        prompt: "Build a 12-month product roadmap for [product]. Organize by themes, priorities, dependencies. Include now/next/later buckets.",
        tags: ["roadmap", "product", "planning"]
      }
    ]
  }
]

export default function PromptsLibraryPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null)

  const copyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt)
    setCopiedPrompt(prompt)
    setTimeout(() => setCopiedPrompt(null), 2000)
  }

  const filteredCategories = PROMPT_CATEGORIES.map(category => ({
    ...category,
    prompts: category.prompts.filter(
      p => 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  })).filter(category => category.prompts.length > 0)

  const totalPrompts = PROMPT_CATEGORIES.reduce((sum, cat) => sum + cat.prompts.length, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Javari AI Prompt Library
          </h1>
          <p className="text-white/70 max-w-2xl mx-auto">
            {totalPrompts} professional prompts across {PROMPT_CATEGORIES.length} categories. 
            Copy any prompt and customize it for your needs.
          </p>
          
          {/* Search */}
          <div className="max-w-xl mx-auto">
            <Input
              type="text"
              placeholder="Search prompts, tags, or categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-8">
          {filteredCategories.map((category) => {
            const Icon = category.icon
            return (
              <div key={category.name} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-r ${category.color}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">{category.name}</h2>
                  <Badge variant="secondary" className="ml-auto">
                    {category.prompts.length} prompts
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {category.prompts.map((prompt, idx) => (
                    <Card key={idx} className="bg-white/5 border-white/10 hover:bg-white/10 transition-all">
                      <CardHeader>
                        <CardTitle className="text-white flex items-center justify-between">
                          {prompt.title}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyPrompt(prompt.prompt)}
                            className="h-8 w-8 p-0"
                          >
                            {copiedPrompt === prompt.prompt ? (
                              <Check className="h-4 w-4 text-green-400" />
                            ) : (
                              <Copy className="h-4 w-4 text-white/60" />
                            )}
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-white/70 font-mono bg-black/20 p-3 rounded">
                          {prompt.prompt}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {prompt.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {filteredCategories.length === 0 && (
          <div className="text-center py-12">
            <p className="text-white/50">No prompts found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  )
}
