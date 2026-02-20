// lib/javari/engine/commandDetector.ts
// Javari XML Command Detection & Schema Validation
// Detects <JAVARI_COMMAND ...>, <JAVARI_SYSTEM_COMMAND ...>, <JAVARI_EXECUTE ...>
// blocks in incoming text and validates their structure.
// 2026-02-19 — P1-003 System Command Engine

export type CommandAction =
  | 'ping_system'
  | 'generate_module'
  | 'preview_module'
  | 'commit_module'
  | 'update_roadmap'
  | 'ingest_docs'
  | 'run_diagnostic'
  | 'get_status'
  | string; // extensible

export interface ParsedCommand {
  /** The XML tag that triggered this command */
  tagName: 'JAVARI_COMMAND' | 'JAVARI_SYSTEM_COMMAND' | 'JAVARI_EXECUTE';
  /** action attribute or ACTION: field in body */
  action: CommandAction;
  /** name attribute */
  name?: string;
  /** All key/value pairs from the XML body */
  fields: Record<string, string>;
  /** Raw XML block */
  raw: string;
  /** Whether this is valid and can be executed */
  valid: boolean;
  /** Validation errors */
  errors: string[];
}

export interface DetectionResult {
  isCommand: boolean;
  command: ParsedCommand | null;
}

// Tag patterns we recognize as system commands
const COMMAND_TAG_PATTERNS = [
  /^<JAVARI_COMMAND/,
  /^<JAVARI_SYSTEM_COMMAND/,
  /^<JAVARI_EXECUTE/,
];

const COMMAND_TAGS = ['JAVARI_COMMAND', 'JAVARI_SYSTEM_COMMAND', 'JAVARI_EXECUTE'];

// ── Detect XML command in text ────────────────────────────────────────────────

export function detectXmlCommand(text: string): DetectionResult {
  const trimmed = text.trim();

  // Fast path: check if any tag is present
  const hasCommandTag = COMMAND_TAGS.some((tag) =>
    trimmed.includes(`<${tag}`) || trimmed.includes(`<${tag}>`)
  );

  if (!hasCommandTag) {
    return { isCommand: false, command: null };
  }

  // Find the command block
  for (const tagName of COMMAND_TAGS) {
    const openTagRx = new RegExp(`<${tagName}(?:\s[^>]*)?>`, 'i');
    const closeTagRx = new RegExp(`</${tagName}>`, 'i');

    const openMatch = trimmed.match(openTagRx);
    if (!openMatch) continue;

    const openIdx = trimmed.indexOf(openMatch[0]);
    const closeMatch = closeTagRx.exec(trimmed.slice(openIdx));
    if (!closeMatch) continue;

    const endIdx = openIdx + closeMatch.index + closeMatch[0].length;
    const raw = trimmed.slice(openIdx, endIdx);
    const body = raw.slice(openMatch[0].length, raw.length - closeMatch[0].length).trim();

    // Parse attributes from opening tag
    const attrs = parseXmlAttributes(openMatch[0]);

    // Parse body key/value fields (e.g. "ACTION:
generate_module")
    const fields = parseCommandBody(body);

    // Resolve action: attribute takes precedence, then ACTION: field
    const action = (attrs['action'] || fields['action'] || '').toLowerCase().trim();

    // Resolve name: attribute takes precedence, then NAME: field
    const name = attrs['name'] || fields['name'] || undefined;

    const command: ParsedCommand = {
      tagName: tagName as ParsedCommand['tagName'],
      action,
      name,
      fields: { ...attrs, ...fields },
      raw,
      valid: false,
      errors: [],
    };

    // Validate
    const errors = validateCommand(command);
    command.errors = errors;
    command.valid = errors.length === 0;

    return { isCommand: true, command };
  }

  return { isCommand: false, command: null };
}

// ── Parse XML attributes ──────────────────────────────────────────────────────

function parseXmlAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  // Match: key="value" or key='value'
  const rx = /(\w+)=["\'](.*?)["\'](?=\s|>|$)/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(tag)) !== null) {
    attrs[m[1].toLowerCase()] = m[2];
  }
  return attrs;
}

// ── Parse command body (key: value lines) ────────────────────────────────────

function parseCommandBody(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!body) return fields;

  const lines = body.split('\n');
  let currentKey = '';
  let currentVal: string[] = [];

  const flush = () => {
    if (currentKey) {
      fields[currentKey] = currentVal.join('\n').trim();
    }
  };

  for (const line of lines) {
    // Key: value header lines (e.g. "ACTION:", "NAME:", "OBJECTIVES:")
    const headerMatch = line.match(/^([A-Z_]+):\s*(.*)/);
    if (headerMatch) {
      flush();
      currentKey = headerMatch[1].toLowerCase();
      currentVal = headerMatch[2] ? [headerMatch[2]] : [];
    } else if (currentKey) {
      currentVal.push(line);
    }
  }
  flush();

  return fields;
}

// ── Validate command structure ────────────────────────────────────────────────

function validateCommand(cmd: ParsedCommand): string[] {
  const errors: string[] = [];

  if (!cmd.action) {
    errors.push('Missing required field: action (set via action="..." attribute or ACTION: body field)');
  }

  // Action-specific validation
  if (cmd.action === 'generate_module' || cmd.action === 'preview_module') {
    const name = cmd.fields['name'] || cmd.name;
    if (!name) errors.push('generate_module requires name field');
    const slug = cmd.fields['slug'];
    if (!slug) errors.push('generate_module requires slug field');
    const desc = cmd.fields['description'];
    if (!desc) errors.push('generate_module requires description field');
    const family = cmd.fields['family'];
    if (!family) errors.push('generate_module requires family field');
  }

  return errors;
}
