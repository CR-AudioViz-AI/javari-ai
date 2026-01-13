/**
 * JAVARI OPERATOR MODE
 * ====================
 * Core logic for detecting spec documents and generating
 * structured operator output instead of summaries.
 * 
 * @version 1.0.0
 * @date 2026-01-05
 */

// =============================================================================
// TYPES
// =============================================================================

export interface DetectedDocument {
  name: string;
  type: string;
  size: number;
  content: string;
  isSpec: boolean;
}

export interface Ticket {
  id: string;
  title: string;
  priority: 'P0' | 'P1' | 'P2';
  assignedTo: 'Claude' | 'ChatGPT' | 'Gemini' | 'Human';
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE' | 'BLOCKED';
  acceptanceCriteria: string[];
  proofRequired: string[];
  proof?: {
    pr?: string;
    deployUrl?: string;
    verification?: string;
    rollback?: string;
  };
}

export interface TaskBatch {
  batchNumber: number;
  targetAI: string;
  issued: string;
  tickets: string[];
  instructions: string[];
  deliverables: string[];
}

export interface OperatorOutput {
  timestamp: string;
  mode: 'OPERATOR';
  documents: DetectedDocument[];
  tickets: Ticket[];
  taskBatches: TaskBatch[];
  checklist: ChecklistItem[];
  proofRequirements: string[];
}

export interface ChecklistItem {
  number: number;
  ticketId: string;
  description: string;
  assignedTo: string;
  status: string;
  hasProof: boolean;
  updatedAt: string;
}

// =============================================================================
// SPEC DETECTION
// =============================================================================

const SPEC_KEYWORDS = [
  'SPEC', 'PROOF', 'CONTROL', 'P0', 'TICKET', 'OPERATOR',
  'ACCEPTANCE', 'CRITERIA', 'REQUIREMENT', 'DELIVERABLE',
  'MILESTONE', 'ROADMAP', 'IMPLEMENTATION', 'ARCHITECTURE'
];

const SPEC_FILENAME_PATTERNS = [
  /spec/i,
  /proof/i,
  /control/i,
  /ticket/i,
  /operator/i,
  /p0/i,
  /p1/i,
  /requirement/i,
  /roadmap/i
];

export function isSpecDocument(filename: string, content: string): boolean {
  // Check filename
  for (const pattern of SPEC_FILENAME_PATTERNS) {
    if (pattern.test(filename)) return true;
  }
  
  // Check content for spec keywords (need at least 3)
  let keywordCount = 0;
  const upperContent = content.toUpperCase();
  for (const keyword of SPEC_KEYWORDS) {
    if (upperContent.includes(keyword)) {
      keywordCount++;
      if (keywordCount >= 3) return true;
    }
  }
  
  // Check for markdown structure indicating spec
  const hasAcceptanceCriteria = /acceptance\s+criteria/i.test(content);
  const hasTicketFormat = /ticket|issue|task/i.test(content) && /priority|status/i.test(content);
  const hasProofSection = /proof|evidence|verification/i.test(content);
  
  return (hasAcceptanceCriteria && hasTicketFormat) || 
         (hasTicketFormat && hasProofSection) ||
         (hasAcceptanceCriteria && hasProofSection);
}

export function shouldActivateOperatorMode(documents: DetectedDocument[]): boolean {
  // Activate if any document is a spec
  return documents.some(doc => doc.isSpec);
}

// =============================================================================
// TICKET EXTRACTION
// =============================================================================

export function extractTicketsFromContent(content: string): Ticket[] {
  const tickets: Ticket[] = [];
  
  // Look for numbered requirements or criteria
  const lines = content.split('\n');
  let ticketNumber = 1;
  
  // Pattern 1: Numbered list items that look like requirements
  const requirementPattern = /^\s*(\d+)\.\s*(.+?)(?:\s*[-–]\s*(.+))?$/;
  const bulletPattern = /^\s*[-*]\s*(.+)$/;
  
  // Pattern 2: Headers followed by criteria
  const headerPattern = /^#+\s*(.+)$/;
  const criteriaPattern = /criteria|requirement|must|should|shall/i;
  
  let currentSection = '';
  let inCriteriaSection = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for section headers
    const headerMatch = line.match(headerPattern);
    if (headerMatch) {
      currentSection = headerMatch[1];
      inCriteriaSection = criteriaPattern.test(currentSection);
      continue;
    }
    
    // Extract requirements from acceptance criteria sections
    if (inCriteriaSection) {
      const bulletMatch = line.match(bulletPattern);
      if (bulletMatch) {
        const title = bulletMatch[1].trim();
        if (title.length > 10 && title.length < 200) {
          tickets.push({
            id: `TICKET-${String(ticketNumber).padStart(3, '0')}`,
            title: title,
            priority: determinePriority(title, currentSection),
            assignedTo: determineAssignment(title),
            status: 'NOT_STARTED',
            acceptanceCriteria: [title],
            proofRequired: ['PR link', 'Deployment URL', 'Verification output', 'Rollback command']
          });
          ticketNumber++;
        }
      }
    }
    
    // Also look for explicit P0/P1/P2 markers
    if (/\bP0\b/.test(line) || /\bP1\b/.test(line) || /\bP2\b/.test(line)) {
      const cleanLine = line.replace(/^[\s\-*#]+/, '').trim();
      if (cleanLine.length > 10 && !tickets.some(t => t.title === cleanLine)) {
        tickets.push({
          id: `TICKET-${String(ticketNumber).padStart(3, '0')}`,
          title: cleanLine.slice(0, 100),
          priority: /\bP0\b/.test(line) ? 'P0' : /\bP1\b/.test(line) ? 'P1' : 'P2',
          assignedTo: determineAssignment(cleanLine),
          status: 'NOT_STARTED',
          acceptanceCriteria: [cleanLine],
          proofRequired: ['PR link', 'Deployment URL', 'Verification output', 'Rollback command']
        });
        ticketNumber++;
      }
    }
  }
  
  // If no tickets found, create from main sections
  if (tickets.length === 0) {
    const sections = content.split(/^##\s+/m).filter(s => s.trim());
    for (const section of sections.slice(0, 10)) {
      const titleLine = section.split('\n')[0].trim();
      if (titleLine && titleLine.length > 5 && titleLine.length < 100) {
        tickets.push({
          id: `TICKET-${String(ticketNumber).padStart(3, '0')}`,
          title: titleLine,
          priority: 'P1',
          assignedTo: 'Claude',
          status: 'NOT_STARTED',
          acceptanceCriteria: ['Complete ' + titleLine],
          proofRequired: ['PR link', 'Deployment URL', 'Verification output', 'Rollback command']
        });
        ticketNumber++;
      }
    }
  }
  
  return tickets;
}

function determinePriority(title: string, section: string): 'P0' | 'P1' | 'P2' {
  const text = (title + ' ' + section).toLowerCase();
  if (/critical|must|required|p0|blocker|immediate/i.test(text)) return 'P0';
  if (/should|important|p1|high/i.test(text)) return 'P1';
  return 'P2';
}

function determineAssignment(title: string): 'Claude' | 'ChatGPT' | 'Gemini' | 'Human' {
  const text = title.toLowerCase();
  if (/code|api|implement|fix|bug|deploy|test/i.test(text)) return 'Claude';
  if (/document|write|content|template|design/i.test(text)) return 'ChatGPT';
  if (/approve|review|decision|budget/i.test(text)) return 'Human';
  return 'Claude';
}

// =============================================================================
// TASK BATCH GENERATION
// =============================================================================

export function generateTaskBatches(tickets: Ticket[]): TaskBatch[] {
  const batches: TaskBatch[] = [];
  const timestamp = new Date().toISOString();
  
  // Group by assignment
  const claudeTickets = tickets.filter(t => t.assignedTo === 'Claude');
  const chatGPTTickets = tickets.filter(t => t.assignedTo === 'ChatGPT');
  const geminiTickets = tickets.filter(t => t.assignedTo === 'Gemini');
  
  if (claudeTickets.length > 0) {
    batches.push({
      batchNumber: 1,
      targetAI: 'Claude',
      issued: timestamp,
      tickets: claudeTickets.map(t => t.id),
      instructions: claudeTickets.map(t => `Execute ${t.id}: ${t.title}`),
      deliverables: claudeTickets.flatMap(t => t.acceptanceCriteria)
    });
  }
  
  if (chatGPTTickets.length > 0) {
    batches.push({
      batchNumber: batches.length + 1,
      targetAI: 'ChatGPT',
      issued: timestamp,
      tickets: chatGPTTickets.map(t => t.id),
      instructions: chatGPTTickets.map(t => `Execute ${t.id}: ${t.title}`),
      deliverables: chatGPTTickets.flatMap(t => t.acceptanceCriteria)
    });
  }
  
  if (geminiTickets.length > 0) {
    batches.push({
      batchNumber: batches.length + 1,
      targetAI: 'Gemini',
      issued: timestamp,
      tickets: geminiTickets.map(t => t.id),
      instructions: geminiTickets.map(t => `Execute ${t.id}: ${t.title}`),
      deliverables: geminiTickets.flatMap(t => t.acceptanceCriteria)
    });
  }
  
  return batches;
}

// =============================================================================
// OUTPUT GENERATION
// =============================================================================

export function generateOperatorOutput(documents: DetectedDocument[]): OperatorOutput {
  const timestamp = new Date().toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }) + ' EST';
  
  // Extract tickets from all spec documents
  const allTickets: Ticket[] = [];
  for (const doc of documents.filter(d => d.isSpec)) {
    const docTickets = extractTicketsFromContent(doc.content);
    allTickets.push(...docTickets);
  }
  
  // Deduplicate and renumber
  const uniqueTickets = allTickets.reduce((acc, ticket) => {
    if (!acc.some(t => t.title === ticket.title)) {
      acc.push({
        ...ticket,
        id: `TICKET-${String(acc.length + 1).padStart(3, '0')}`
      });
    }
    return acc;
  }, [] as Ticket[]);
  
  // Generate task batches
  const taskBatches = generateTaskBatches(uniqueTickets);
  
  // Generate checklist
  const checklist: ChecklistItem[] = uniqueTickets.map((ticket, index) => ({
    number: index + 1,
    ticketId: ticket.id,
    description: ticket.title.slice(0, 50) + (ticket.title.length > 50 ? '...' : ''),
    assignedTo: ticket.assignedTo,
    status: '🔴',
    hasProof: false,
    updatedAt: timestamp
  }));
  
  return {
    timestamp,
    mode: 'OPERATOR',
    documents,
    tickets: uniqueTickets,
    taskBatches,
    checklist,
    proofRequirements: [
      'PR link - Merged pull request',
      'Deploy URL - Live staging/production URL',
      'Verification - Steps executed + actual output',
      'Rollback - git revert [SHA] command',
      'Evidence - Screenshot or log artifact'
    ]
  };
}

// =============================================================================
// MARKDOWN OUTPUT
// =============================================================================

export function formatOperatorOutputAsMarkdown(output: OperatorOutput): string {
  const lines: string[] = [];
  
  lines.push('# 🎯 JAVARI OPERATOR MODE ACTIVATED');
  lines.push(`**Timestamp:** ${output.timestamp}`);
  lines.push('**Mode:** OPERATOR');
  lines.push('**Status:** EXECUTING');
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // Documents
  lines.push('## 📄 DOCUMENTS DETECTED');
  lines.push('');
  lines.push('| # | Filename | Type | Status |');
  lines.push('|---|----------|------|--------|');
  output.documents.forEach((doc, i) => {
    const status = doc.isSpec ? '✅ SPEC' : '📄 Doc';
    lines.push(`| ${i + 1} | ${doc.name} | ${doc.type || 'text'} | ${status} |`);
  });
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // Tickets
  lines.push('## 🎫 P0 TICKET LIST');
  lines.push('');
  for (const ticket of output.tickets) {
    lines.push(`### ${ticket.id}: ${ticket.title}`);
    lines.push(`**Priority:** ${ticket.priority}`);
    lines.push(`**Assigned To:** ${ticket.assignedTo}`);
    lines.push(`**Status:** 🔴 NOT STARTED`);
    lines.push('');
    lines.push('**Acceptance Criteria:**');
    ticket.acceptanceCriteria.forEach(c => lines.push(`- [ ] ${c}`));
    lines.push('');
    lines.push('**Proof Required:**');
    ticket.proofRequired.forEach(p => lines.push(`- [ ] ${p}`));
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  
  // Task Batches
  for (const batch of output.taskBatches) {
    lines.push(`## 📋 TASK BATCH #${batch.batchNumber} - ${batch.targetAI}`);
    lines.push('');
    lines.push(`**Issued:** ${batch.issued}`);
    lines.push('**Due:** IMMEDIATE');
    lines.push('');
    lines.push('### Assigned Tickets');
    batch.tickets.forEach((t, i) => lines.push(`${i + 1}. **${t}**`));
    lines.push('');
    lines.push('### Proof Submission');
    lines.push('```');
    lines.push('PR: [GitHub URL]');
    lines.push('Deploy: [Staging URL]');
    lines.push('Verify: [Steps + Output]');
    lines.push('Rollback: git revert [SHA]');
    lines.push('```');
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  
  // Checklist
  lines.push('## ✅ CHECKLIST');
  lines.push('');
  lines.push('| # | Ticket | Description | Assigned | Status | Proof |');
  lines.push('|---|--------|-------------|----------|--------|-------|');
  output.checklist.forEach(item => {
    lines.push(`| ${item.number} | ${item.ticketId} | ${item.description} | ${item.assignedTo} | ${item.status} | ${item.hasProof ? '✅' : '❌'} |`);
  });
  lines.push('');
  
  // Progress
  const complete = output.checklist.filter(c => c.hasProof).length;
  const total = output.checklist.length;
  const percent = Math.round((complete / total) * 100);
  const filled = Math.round(percent / 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  
  lines.push('## 📊 PROGRESS');
  lines.push('');
  lines.push(`\`[${bar}] ${percent}% Complete (${complete}/${total} tickets)\``);
  lines.push('');
  
  // Proof Requirements
  lines.push('## 🔒 PROOF REQUIREMENTS (ENFORCED)');
  lines.push('');
  lines.push('Every ticket MUST have before marking ✅:');
  lines.push('');
  output.proofRequirements.forEach((p, i) => lines.push(`${i + 1}. **${p}**`));
  lines.push('');
  lines.push('**NO EXCEPTIONS. NO "CLOSE ENOUGH". NO TRUST-BASED COMPLETION.**');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('*Javari Operator Mode v1.0 | Proof-enforced execution*');
  
  return lines.join('\n');
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  isSpecDocument,
  shouldActivateOperatorMode,
  extractTicketsFromContent,
  generateTaskBatches,
  generateOperatorOutput,
  formatOperatorOutputAsMarkdown
};
