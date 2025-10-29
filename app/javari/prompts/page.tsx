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
  Check
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Prompt Library
          </h1>
          <p className="text-white/70 max-w-2xl mx-auto">
            Explore categorized prompt examples to get the most out of Javari AI. 
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
