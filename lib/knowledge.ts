import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// CRAIverse Knowledge Base
export const ECOSYSTEM_KNOWLEDGE = {
  company: {
    name: "CR AudioViz AI LLC",
    tagline: "Your Story. Our Design.",
    mission: "Everyone connects. Everyone wins.",
    founder: "Roy Henderson",
    founded: "2024",
    location: "Southwest Florida"
  },
  products: [
    {
      name: "Invoice Generator",
      description: "Create professional invoices in seconds",
      url: "https://crav-invoice-generator.vercel.app",
      pricing: "Free tier + Pro ($9.99/mo)"
    },
    {
      name: "PDF Builder Pro",
      description: "Build and edit PDFs with AI assistance",
      url: "https://crav-pdf-builder.vercel.app",
      pricing: "Free tier + Pro ($14.99/mo)"
    },
    {
      name: "Market Oracle",
      description: "AI-powered stock analysis and predictions",
      url: "https://crav-market-oracle.vercel.app",
      pricing: "Free + Starter ($9.99) + Pro ($29.99)"
    },
    {
      name: "CravBarrels",
      description: "Bourbon and spirits collection platform",
      url: "https://cravbarrels.com",
      pricing: "Free + Premium features"
    },
    {
      name: "CardVerse",
      description: "Trading card collection and marketplace",
      url: "https://crav-cardverse.vercel.app",
      pricing: "Free + Marketplace fees"
    },
    {
      name: "Orlando Trip Deals",
      description: "Best deals for Orlando vacations",
      url: "https://crav-orlando-deals.vercel.app",
      pricing: "Free (affiliate revenue)"
    },
    {
      name: "Social Graphics Creator",
      description: "Create social media graphics with AI",
      url: "https://crav-social-graphics.vercel.app",
      pricing: "Credit-based"
    }
  ],
  pricing: {
    credits: [
      { package: "small", credits: 100, price: "$4.99" },
      { package: "medium", credits: 500, price: "$19.99" },
      { package: "large", credits: 2000, price: "$69.99" },
      { package: "xlarge", credits: 5000, price: "$149.99" }
    ],
    subscriptions: [
      { tier: "free", price: "$0", features: ["Basic access", "100 credits/month", "Community support"] },
      { tier: "starter", price: "$9.99/mo", features: ["All free features", "500 credits/month", "Email support", "Basic AI features"] },
      { tier: "pro", price: "$29.99/mo", features: ["All starter features", "2000 credits/month", "Priority support", "Advanced AI", "API access"] },
      { tier: "enterprise", price: "$99.99/mo", features: ["Unlimited credits", "Dedicated support", "Custom integrations", "White-label options"] }
    ]
  },
  support: {
    email: "support@craudiovizai.com",
    dashboard: "https://dashboard.craudiovizai.com",
    docs: "https://docs.craudiovizai.com"
  }
};

// Learning from conversations
export async function learnFromConversation(
  conversationId: string,
  userMessage: string,
  assistantResponse: string,
  feedback?: { helpful: boolean; rating?: number }
) {
  try {
    await supabase.from("javari_training_data").insert({
      conversation_id: conversationId,
      user_message: userMessage,
      assistant_response: assistantResponse,
      feedback_helpful: feedback?.helpful,
      feedback_rating: feedback?.rating,
      created_at: new Date().toISOString()
    });

    // If positive feedback, extract Q&A pair for knowledge base
    if (feedback?.helpful && feedback?.rating && feedback.rating >= 4) {
      await supabase.from("javari_knowledge_base").insert({
        question_pattern: userMessage.toLowerCase().slice(0, 500),
        answer: assistantResponse.slice(0, 2000),
        source: "conversation",
        confidence: feedback.rating / 5,
        created_at: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("Learning error:", error);
  }
}

// Search knowledge base for relevant context
export async function searchKnowledge(query: string, limit = 5) {
  try {
    const { data } = await supabase
      .from("javari_knowledge_base")
      .select("question_pattern, answer, confidence")
      .textSearch("question_pattern", query)
      .order("confidence", { ascending: false })
      .limit(limit);

    return data || [];
  } catch {
    return [];
  }
}

// Get FAQ responses
export async function getFAQResponse(question: string): Promise<string | null> {
  const faqs: Record<string, string> = {
    "how do credits work": "Credits are used for AI features across the CRAIverse. Each AI call costs 1-5 credits depending on complexity. You get free credits with subscriptions, or can purchase credit packages.",
    "how do i cancel": "You can cancel your subscription anytime from your Dashboard > Billing. Your access continues until the end of your billing period.",
    "refund policy": "We offer a 14-day money-back guarantee on all subscriptions. Contact support@craudiovizai.com for refund requests.",
    "what payment methods": "We accept all major credit cards, PayPal, and Apple Pay through our secure Stripe integration.",
    "is my data safe": "Yes! We use industry-standard encryption and never sell your data. See our Privacy Policy for details.",
    "api access": "API access is available on Pro and Enterprise plans. Check our documentation at docs.craudiovizai.com for integration guides."
  };

  const lowerQuestion = question.toLowerCase();
  for (const [pattern, answer] of Object.entries(faqs)) {
    if (lowerQuestion.includes(pattern)) {
      return answer;
    }
  }
  return null;
}

// Build context for AI responses
export function buildSystemContext(userContext?: { tier?: string; credits?: number; products?: string[] }) {
  let context = `You are Javari, the AI assistant for CR AudioViz AI (CRAIverse). 
Your role is to help users with questions about our products, billing, technical issues, and general inquiries.

Company: ${ECOSYSTEM_KNOWLEDGE.company.name}
Tagline: ${ECOSYSTEM_KNOWLEDGE.company.tagline}
Mission: ${ECOSYSTEM_KNOWLEDGE.company.mission}

Available Products:
${ECOSYSTEM_KNOWLEDGE.products.map(p => `- ${p.name}: ${p.description} (${p.pricing})`).join("\n")}

Support: ${ECOSYSTEM_KNOWLEDGE.support.email}
`;

  if (userContext) {
    context += `\nUser Context:
- Subscription: ${userContext.tier || "free"}
- Credits: ${userContext.credits || 0}
- Active Products: ${userContext.products?.join(", ") || "None"}`;
  }

  context += `\n\nBe helpful, concise, and friendly. If you can't answer something, offer to create a support ticket.`;

  return context;
}
