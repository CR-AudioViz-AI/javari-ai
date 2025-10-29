"use client"

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

// 100 DETAILED, EDUCATIONAL PROMPTS - Teaching proper prompt formatting
const PROMPT_CATEGORIES = {
  'Business Strategy': [
    "Create a comprehensive 12-month growth strategy for [your business] including specific tactics, KPIs, and budget allocation",
    "Analyze my target market demographics and create 3 detailed customer personas with pain points, goals, and buying behaviors",
    "Design a customer retention program with gamification elements, loyalty tiers, and measurable success metrics",
    "Develop a competitive analysis framework comparing my product to 5 competitors across 10 key dimensions",
    "Build a pricing strategy with 3 tier options, value propositions for each tier, and psychological pricing tactics",
    "Create a quarterly OKR framework with 3 objectives, 9 key results, and weekly milestone tracking",
    "Design a sales funnel optimization plan identifying bottlenecks, conversion tactics, and A/B testing strategies",
    "Develop a partnership strategy identifying 10 potential partners, outreach templates, and collaboration models",
  ],
  'Content Creation': [
    "Write a 2000-word SEO-optimized blog post about [topic] with H2/H3 structure, meta description, and internal linking strategy",
    "Create a 90-day content calendar for [platform] with post types, optimal timing, hashtag strategy, and engagement tactics",
    "Develop 20 headline variations for [topic] using power words, emotional triggers, and curiosity gaps",
    "Write a compelling product description highlighting features, benefits, social proof, and scarcity elements",
    "Create an email nurture sequence with 7 emails: welcome, education, case study, objection handling, urgency, closing, and retention",
    "Design a storytelling framework for brand narratives including hero's journey, conflict resolution, and emotional arcs",
    "Generate 50 engaging social media post ideas with hooks, body content, CTAs, and platform-specific formatting",
    "Write a video script with attention-grabbing hook, problem agitation, solution explanation, and clear next steps",
  ],
  'Technical Development': [
    "Review this code for security vulnerabilities, performance bottlenecks, and suggest refactoring with specific line-by-line improvements",
    "Design a scalable database schema for [application] with normalization, indexing strategy, and relationship mapping",
    "Create a comprehensive API documentation with endpoints, parameters, response codes, authentication, and example requests",
    "Build a testing strategy with unit tests, integration tests, E2E tests, and CI/CD pipeline configuration",
    "Debug this error by analyzing stack trace, identifying root cause, and providing step-by-step fix with prevention strategies",
    "Architect a microservices solution with service boundaries, communication patterns, data consistency, and failure handling",
    "Optimize this algorithm for O(n) time complexity, explain Big-O improvements, and provide benchmarking methodology",
    "Create a Docker containerization setup with multi-stage builds, environment variables, health checks, and orchestration strategy",
  ],
  'Data Analysis': [
    "Analyze this dataset for patterns, outliers, correlations, and create visualizations with interpretation and actionable insights",
    "Build a predictive model for [outcome] including feature engineering, model selection, validation strategy, and performance metrics",
    "Create a data cleaning pipeline addressing missing values, duplicates, inconsistencies, and data type conversions with rationale",
    "Design an A/B test framework with sample size calculation, statistical significance testing, and result interpretation guidelines",
    "Generate a comprehensive dashboard specification with KPIs, visualization types, interactivity, and update frequency",
    "Perform sentiment analysis on [text data] with preprocessing steps, model choice justification, and confidence scoring",
    "Create a time series forecast with trend analysis, seasonality detection, model selection, and accuracy metrics",
    "Build a customer segmentation model using clustering, explain segment characteristics, and recommend targeting strategies",
  ],
  'Marketing': [
    "Design a multi-channel marketing campaign for [product launch] with budget allocation, timeline, creative assets, and success metrics",
    "Create a complete SEO audit checklist covering technical SEO, on-page optimization, content strategy, and link building tactics",
    "Develop a social media advertising strategy with audience targeting, ad creative variations, budget pacing, and optimization rules",
    "Build an influencer outreach program with identification criteria, vetting process, collaboration terms, and ROI tracking",
    "Create a brand positioning statement with target audience, category, differentiation, and proof points",
    "Design a conversion rate optimization roadmap with hypothesis generation, test prioritization, and implementation timeline",
    "Develop an email marketing automation workflow with trigger events, personalization variables, and performance tracking",
    "Create a public relations strategy with media list, pitch angles, press release templates, and crisis management protocols",
  ],
  'Project Management': [
    "Create a detailed project plan with WBS breakdown, dependencies, critical path analysis, resource allocation, and risk mitigation",
    "Design a stakeholder communication matrix with frequency, channels, content types, and escalation procedures",
    "Build a project risk register with likelihood-impact scoring, mitigation strategies, and contingency planning",
    "Develop a sprint planning framework with story pointing, velocity tracking, and retrospective improvement actions",
    "Create a project status report template with RAG status, milestone progress, budget burn, and decision requirements",
    "Design a change management process with impact assessment, approval workflows, and rollback procedures",
    "Build a resource capacity planning model with skill matching, utilization targets, and bottleneck identification",
    "Create a lessons learned template with success factors, improvement opportunities, and knowledge transfer plan",
  ],
  'Design': [
    "Create a complete UI/UX design brief with user personas, user flows, wireframes, high-fidelity mockups, and design system",
    "Design a brand identity package with logo variations, color palette with psychological reasoning, typography hierarchy, and usage guidelines",
    "Build a design system with component library, spacing scale, color tokens, iconography, and accessibility standards",
    "Create an information architecture with card sorting results, site map, navigation patterns, and search strategy",
    "Design a mobile-first responsive layout with breakpoint strategy, touch targets, and progressive enhancement",
    "Develop a visual hierarchy analysis with F-pattern/Z-pattern layouts, focal points, and eye-tracking principles",
    "Create a design critique framework with heuristic evaluation, usability testing plan, and iteration priorities",
    "Build a motion design specification with animation timing, easing functions, interaction feedback, and performance considerations",
  ],
  'Personal Development': [
    "Create a personalized learning path for [skill] with resource recommendations, practice exercises, milestones, and assessment methods",
    "Design a productivity system combining time-blocking, energy management, focus techniques, and habit tracking",
    "Build a career development plan with skill gap analysis, networking strategy, personal branding, and portfolio projects",
    "Create a goal-setting framework using SMART criteria, OKRs, habit stacking, and accountability mechanisms",
    "Develop a financial planning roadmap with budgeting system, investment strategy, emergency fund, and retirement planning",
    "Design a wellness routine integrating physical exercise, mental health practices, nutrition planning, and sleep optimization",
    "Build a decision-making framework with pros-cons analysis, opportunity cost evaluation, and risk assessment",
    "Create a networking strategy with relationship mapping, value proposition, outreach templates, and follow-up systems",
  ],
  'Customer Support': [
    "Create a customer service playbook with response templates, escalation procedures, SLA definitions, and quality assurance metrics",
    "Design a self-service knowledge base structure with article categories, search optimization, and content maintenance schedule",
    "Build a customer feedback loop with survey design, sentiment tracking, insight extraction, and action planning",
    "Develop a chatbot conversation flow with intent recognition, entity extraction, fallback handling, and human handoff triggers",
    "Create a customer onboarding program with welcome sequence, product walkthroughs, milestone celebrations, and success metrics",
    "Design a complaint resolution framework with empathy mapping, de-escalation techniques, compensation guidelines, and prevention strategies",
    "Build a customer retention analysis with churn prediction, at-risk identification, intervention campaigns, and win-back strategies",
    "Create a multi-channel support strategy with channel routing rules, response time targets, and customer satisfaction tracking",
  ],
  'Financial Analysis': [
    "Create a comprehensive financial model with revenue projections, cost structure, cash flow analysis, and sensitivity scenarios",
    "Build a business valuation using DCF method, comparable company analysis, and precedent transactions",
    "Develop a budget variance analysis with actual vs. planned comparison, variance explanations, and corrective actions",
    "Create a pricing profitability analysis with unit economics, contribution margin, break-even calculation, and pricing scenarios",
    "Design a financial dashboard with key metrics, trend analysis, ratio analysis, and executive summary",
    "Build an investment decision framework with NPV calculation, IRR analysis, payback period, and risk-adjusted returns",
    "Create a credit risk assessment model with scoring criteria, default probability, and portfolio risk analysis",
    "Develop a working capital optimization strategy with cash conversion cycle analysis and improvement recommendations",
  ],
  'Education & Training': [
    "Design a comprehensive course curriculum with learning objectives, module breakdown, assessment methods, and progression logic",
    "Create a lesson plan with anticipatory set, direct instruction, guided practice, independent practice, and closure",
    "Build a competency framework with skill levels, assessment criteria, evidence requirements, and development pathways",
    "Develop a training needs analysis with gap identification, priority ranking, solution design, and impact measurement",
    "Create an e-learning module with multimedia integration, interactive elements, knowledge checks, and gamification",
    "Design a coaching framework with goal setting, progress tracking, feedback loops, and accountability structures",
    "Build an assessment strategy with formative and summative evaluations, rubrics, and learning analytics",
    "Create a mentorship program with matching criteria, meeting structure, goal alignment, and success metrics",
  ],
};

// Flatten all prompts into a single array
const ALL_PROMPTS = Object.entries(PROMPT_CATEGORIES).flatMap(([category, prompts]) =>
  prompts.map(prompt => ({ category, text: prompt }))
);

export function PromptHintsBar() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ALL_PROMPTS.length)
    }, 6000) // Change every 6 seconds (more time to read detailed prompts)

    return () => clearInterval(interval)
  }, [])

  const currentPrompt = ALL_PROMPTS[currentIndex];

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 border-t py-3 z-50" 
      style={{ 
        backgroundColor: '#002B5B', // Solid navy blue
        borderColor: '#00BCD4'
      }}
    >
      <div className="container mx-auto px-4 flex items-center justify-between gap-4">
        {/* Left: Tip Icon */}
        <div className="flex items-center gap-2 flex-shrink-0" style={{ color: '#00D4FF' }}>
          <Sparkles className="h-4 w-4 animate-pulse" />
          <span className="text-xs font-medium">Prompt Tip:</span>
        </div>
        
        {/* Center: Rotating Prompt */}
        <div className="flex-1 mx-4 overflow-hidden">
          <div className="text-sm text-white font-medium text-center">
            <span className="text-cyan-400 text-xs mr-2">[{currentPrompt.category}]</span>
            {currentPrompt.text}
          </div>
        </div>

        {/* Right: View All Link */}
        <a
          href="/javari/prompts"
          className="text-xs hover:text-cyan-300 transition-colors whitespace-nowrap underline flex-shrink-0"
          style={{ color: '#00D4FF' }}
        >
          View All 100 Prompts →
        </a>
      </div>
    </div>
  )
}
