// lib/javari-competitor-crawler.ts
// Continuous competitor intelligence system

export interface CompetitorSnapshot {
  competitor: string;
  timestamp: string;
  features: string[];
  pricing: {
    tier: string;
    price: number;
    features: string[];
  }[];
  ux_notes: string[];
}

export interface CompetitorDiff {
  added_features: string[];
  removed_features: string[];
  pricing_changes: string[];
  ux_improvements: string[];
}

export class CompetitorCrawler {
  private snapshots: Map<string, CompetitorSnapshot[]> = new Map();
  private crawlInterval: number = 24 * 60 * 60 * 1000; // 24 hours
  
  // Competitors to track
  private competitors = [
    'v0.dev',
    'bolt.new',
    'cursor.ai',
    'replit',
    'github-copilot',
  ];
  
  // Schedule periodic crawl
  startCrawling() {
    console.log('[Competitor Crawler] Starting continuous crawl...');
    
    // Initial crawl
    this.crawlAll();
    
    // Periodic crawl
    setInterval(() => {
      this.crawlAll();
    }, this.crawlInterval);
  }
  
  async crawlAll() {
    for (const competitor of this.competitors) {
      try {
        await this.crawlCompetitor(competitor);
      } catch (error) {
        console.error(`[Crawler] Failed to crawl ${competitor}:`, error);
      }
    }
  }
  
  async crawlCompetitor(competitor: string): Promise<CompetitorSnapshot> {
    console.log(`[Crawler] Crawling ${competitor}...`);
    
    // In production, actual web scraping or API calls
    // For now, stub with known features
    const snapshot: CompetitorSnapshot = {
      competitor,
      timestamp: new Date().toISOString(),
      features: await this.scrapeFeatures(competitor),
      pricing: await this.scrapePricing(competitor),
      ux_notes: await this.scrapeUX(competitor),
    };
    
    // Store snapshot
    const history = this.snapshots.get(competitor) || [];
    history.push(snapshot);
    this.snapshots.set(competitor, history);
    
    // Generate diff if we have previous snapshot
    if (history.length > 1) {
      const diff = this.generateDiff(history[history.length - 2], snapshot);
      await this.processDiff(competitor, diff);
    }
    
    return snapshot;
  }
  
  private async scrapeFeatures(competitor: string): Promise<string[]> {
    // Stub - in production, real scraping
    const knownFeatures: Record<string, string[]> = {
      'v0.dev': ['AI code generation', 'React components', 'Tailwind', 'Preview'],
      'bolt.new': ['Full-stack apps', 'Live preview', 'Deploy', 'Supabase'],
      'cursor.ai': ['IDE', 'Multi-file editing', 'Chat', 'Terminal'],
    };
    
    return knownFeatures[competitor] || [];
  }
  
  private async scrapePricing(competitor: string): Promise<CompetitorSnapshot['pricing']> {
    // Stub
    return [
      { tier: 'free', price: 0, features: ['Basic'] },
      { tier: 'pro', price: 20, features: ['Advanced'] },
    ];
  }
  
  private async scrapeUX(competitor: string): Promise<string[]> {
    return ['Clean interface', 'Fast response time'];
  }
  
  private generateDiff(old: CompetitorSnapshot, current: CompetitorSnapshot): CompetitorDiff {
    const added_features = current.features.filter(f => !old.features.includes(f));
    const removed_features = old.features.filter(f => !current.features.includes(f));
    
    return {
      added_features,
      removed_features,
      pricing_changes: [],
      ux_improvements: [],
    };
  }
  
  private async processDiff(competitor: string, diff: CompetitorDiff) {
    // Generate roadmap opportunities
    const opportunities = diff.added_features.map(f =>
      `Consider adding: ${f} (${competitor} just launched this)`
    );
    
    console.log(`[Crawler] New opportunities from ${competitor}:`, opportunities);
    
    // Feed to roadmap engine
    // javariRoadmap.addOpportunities(opportunities);
  }
  
  // Get latest insights
  getInsights() {
    const insights: string[] = [];
    
    this.snapshots.forEach((history, competitor) => {
      if (history.length > 1) {
        const latest = history[history.length - 1];
        insights.push(`${competitor}: ${latest.features.length} features tracked`);
      }
    });
    
    return insights;
  }
}

export const competitorCrawler = new CompetitorCrawler();
