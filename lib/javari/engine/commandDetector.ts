// lib/javari/engine/commandDetector.ts
// Javari XML Command Detection and Schema Validation
// Detects JAVARI_COMMAND / JAVARI_SYSTEM_COMMAND / JAVARI_EXECUTE blocks
// 2026-02-19 -- P1-003 System Command Engine
// Timestamp: 2026-02-19 22:35 EST

export type CommandAction =
  | 'ping_system'
  | 'generate_module'
  | 'preview_module'
  | 'commit_module'
  | 'update_roadmap'
  | 'ingest_docs'
  | 'run_diagnostic'
  | 'get_status'
  | string;

export interface ParsedCommand {
  tagName: 'JAVARI_COMMAND' | 'JAVARI_SYSTEM_COMMAND' | 'JAVARI_EXECUTE';
  action: CommandAction;
  name?: string;
  fields: Record<string, string>;
  raw: string;
  valid: boolean;
  errors: string[];
}

export interface DetectionResult {
  isCommand: boolean;
  command: ParsedCommand | null;
}

const COMMAND_TAGS = ['JAVARI_COMMAND', 'JAVARI_SYSTEM_COMMAND', 'JAVARI_EXECUTE'] as const;

// ── Detect XML command in text ────────────────────────────────────────────────

export function detectXmlCommand(text: string): DetectionResult {
  const trimmed = text.trim();

  const hasCommandTag = COMMAND_TAGS.some(
    (tag) => trimmed.includes('<' + tag) || trimmed.includes('<' + tag + '>')
  );

  if (!hasCommandTag) {
    return { isCommand: false, command: null };
  }

  for (const tagName of COMMAND_TAGS) {
    const openTagPattern = new RegExp('<' + tagName + '(?:\\s[^>]*)?>');
    const closeTagPattern = new RegExp('</' + tagName + '>');

    const openMatch = trimmed.match(openTagPattern);
    if (!openMatch) continue;

    const openIdx = trimmed.indexOf(openMatch[0]);
    const remaining = trimmed.slice(openIdx);
    const closeMatch = closeTagPattern.exec(remaining);
    if (!closeMatch) continue;

    const endIdx = openIdx + closeMatch.index + closeMatch[0].length;
    const raw = trimmed.slice(openIdx, endIdx);
    const bodyStart = openMatch[0].length;
    const bodyEnd = raw.length - closeMatch[0].length;
    const body = raw.slice(bodyStart, bodyEnd).trim();

    const attrs = parseXmlAttributes(openMatch[0]);
    const fields = parseCommandBody(body);

    const action = (attrs['action'] || fields['action'] || '').toLowerCase().trim();
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
  const rx = /(\w+)=["']([^"']*?)["']/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(tag)) !== null) {
    attrs[m[1].toLowerCase()] = m[2];
  }
  return attrs;
}

// ── Parse command body (KEY: value lines) ────────────────────────────────────

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

  if (cmd.action === 'generate_module' || cmd.action === 'preview_module') {
    if (!cmd.fields['name'] && !cmd.name) errors.push('generate_module requires name field');
    if (!cmd.fields['slug']) errors.push('generate_module requires slug field');
    if (!cmd.fields['description']) errors.push('generate_module requires description field');
    if (!cmd.fields['family']) errors.push('generate_module requires family field');
  }

  return errors;
}
