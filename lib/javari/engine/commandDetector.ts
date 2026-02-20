// lib/javari/engine/commandDetector.ts
// Javari XML Command Detection — v2
// Detects JAVARI_COMMAND / JAVARI_SYSTEM_COMMAND / JAVARI_EXECUTE / JAVARI_PATCH / JAVARI_SYSTEM_REPAIR
// Added: xml_parameter_parser (typed param extraction), structured logging
// 2026-02-20 — JAVARI_PATCH upgrade_system_command_engine

export type CommandAction =
  // System health
  | 'ping_system'
  | 'run_diagnostic'
  | 'get_status'
  // Module factory (do not modify factory internals — pass through only)
  | 'generate_module'
  | 'preview_module'
  | 'commit_module'
  // Roadmap
  | 'update_roadmap'
  | 'advance_phase'
  // Ingestion
  | 'ingest_docs'
  // Orchestration (future)
  | 'orchestrate'
  | 'schedule_task'
  | 'emit_progress'
  // Open extension
  | string;

export interface CommandParam {
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'list' | 'json';
  source: 'attribute' | 'body_field' | 'child_element';
}

export interface ParsedCommand {
  tagName: 'JAVARI_COMMAND' | 'JAVARI_SYSTEM_COMMAND' | 'JAVARI_EXECUTE' | 'JAVARI_PATCH' | 'JAVARI_SYSTEM_REPAIR';
  action: CommandAction;
  name?: string;
  phase?: string;
  goal?: string;
  // Raw key/value fields (existing interface — preserved)
  fields: Record<string, string>;
  // Typed parameters (new — xml_parameter_parser)
  params: CommandParam[];
  // Child XML elements (for nested commands like JAVARI_PATCH)
  children: Record<string, string[]>;
  raw: string;
  valid: boolean;
  errors: string[];
  // Structured log of parse steps
  parseLogs: string[];
}

export interface DetectionResult {
  isCommand: boolean;
  command: ParsedCommand | null;
}

const COMMAND_TAGS = [
  'JAVARI_COMMAND',
  'JAVARI_SYSTEM_COMMAND',
  'JAVARI_EXECUTE',
  'JAVARI_PATCH',
  'JAVARI_SYSTEM_REPAIR',
] as const;

// ── Main detector ─────────────────────────────────────────────────────────────

export function detectXmlCommand(text: string): DetectionResult {
  const trimmed = text.trim();
  const parseLogs: string[] = [];

  const hasCommandTag = COMMAND_TAGS.some(
    (tag) => trimmed.includes('<' + tag) || trimmed.includes('<' + tag + '>')
  );

  if (!hasCommandTag) {
    return { isCommand: false, command: null };
  }

  parseLogs.push(`[detector] command tag found in input (len=${trimmed.length})`);

  for (const tagName of COMMAND_TAGS) {
    const openTagPattern = new RegExp('<' + tagName + '(?:\\s[^>]*)?>');
    const closeTagPattern = new RegExp('</' + tagName + '>');

    const openMatch = trimmed.match(openTagPattern);
    if (!openMatch) continue;

    const openIdx = trimmed.indexOf(openMatch[0]);
    const remaining = trimmed.slice(openIdx);
    const closeMatch = closeTagPattern.exec(remaining);
    if (!closeMatch) {
      parseLogs.push(`[detector] found <${tagName}> but no closing tag — not a complete command`);
      continue;
    }

    const endIdx = openIdx + closeMatch.index + closeMatch[0].length;
    const raw = trimmed.slice(openIdx, endIdx);
    const bodyStart = openMatch[0].length;
    const bodyEnd = raw.length - closeMatch[0].length;
    const body = raw.slice(bodyStart, bodyEnd).trim();

    parseLogs.push(`[detector] tag=${tagName} bodyLen=${body.length}`);

    // Parse attributes from opening tag
    const attrs = parseXmlAttributes(openMatch[0]);
    parseLogs.push(`[detector] attributes: ${JSON.stringify(attrs)}`);

    // Parse body fields (KEY: value lines)
    const fields = parseCommandBody(body);
    parseLogs.push(`[detector] body fields: ${Object.keys(fields).join(', ') || 'none'}`);

    // Parse child XML elements (for nested tag content)
    const children = parseChildElements(body);
    if (Object.keys(children).length > 0) {
      parseLogs.push(`[detector] child elements: ${Object.keys(children).join(', ')}`);
    }

    // Typed param extraction
    const params = extractTypedParams({ ...attrs, ...fields });
    parseLogs.push(`[detector] typed params: ${params.length}`);

    const action = normalizeAction(attrs['action'] || fields['action'] || attrs['name'] || '');
    const name = attrs['name'] || fields['name'] || undefined;
    const phase = attrs['phase'] || fields['phase'] || undefined;
    const goal = attrs['goal'] || fields['goal'] || undefined;

    parseLogs.push(`[detector] resolved action="${action}" name="${name ?? ''}"`);

    const command: ParsedCommand = {
      tagName: tagName as ParsedCommand['tagName'],
      action,
      name,
      phase,
      goal,
      fields: { ...attrs, ...fields },
      params,
      children,
      raw,
      valid: false,
      errors: [],
      parseLogs,
    };

    const errors = validateCommand(command);
    command.errors = errors;
    command.valid = errors.length === 0;

    parseLogs.push(`[detector] valid=${command.valid} errors=${errors.length}`);

    return { isCommand: true, command };
  }

  return { isCommand: false, command: null };
}

// ── Parse XML attributes from opening tag ────────────────────────────────────

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

  // Strip XML comment blocks before parsing
  const stripped = body.replace(/<!--[\s\S]*?-->/g, '').trim();
  const lines = stripped.split('\n');
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

// ── Parse child XML elements ──────────────────────────────────────────────────

function parseChildElements(body: string): Record<string, string[]> {
  const children: Record<string, string[]> = {};
  // Match <tagname ...>content</tagname> or <tagname .../> (self-closing)
  const childRx = /<([a-z_]+)(?:\s[^>]*)?>([^<]*)<\/\1>|<([a-z_]+)[^>]*\/>/gi;
  let m: RegExpExecArray | null;
  while ((m = childRx.exec(body)) !== null) {
    const tag = (m[1] || m[3]).toLowerCase();
    const content = (m[2] || '').trim();
    if (!children[tag]) children[tag] = [];
    children[tag].push(content);
  }
  // Also extract list items from <fix>, <rewrite>, <features>, <rules> etc.
  const listTagRx = /<(features|rules|diagnostic_requirements|fix|rewrite|module_factory|credential_vault|xml_engine|roadmap|evaluate|require_report|safeguards)>([\s\S]*?)<\/\1>/gi;
  let lm: RegExpExecArray | null;
  while ((lm = listTagRx.exec(body)) !== null) {
    const tag = lm[1].toLowerCase();
    const items = lm[2]
      .split('\n')
      .map(l => l.replace(/^\s*-\s*/, '').trim())
      .filter(l => l.length > 0 && !l.startsWith('//') && !l.startsWith('<!--'));
    if (items.length > 0) children[tag] = items;
  }
  return children;
}

// ── Typed parameter extraction (xml_parameter_parser) ────────────────────────

function extractTypedParams(raw: Record<string, string>): CommandParam[] {
  return Object.entries(raw).map(([key, value]): CommandParam => {
    let type: CommandParam['type'] = 'string';
    const v = value.trim();
    if (v === 'true' || v === 'false') type = 'boolean';
    else if (/^\d+(\.\d+)?$/.test(v)) type = 'number';
    else if (v.startsWith('[') && v.endsWith(']')) type = 'list';
    else if ((v.startsWith('{') && v.endsWith('}')) || (v.startsWith('"') && v.includes(':'))) type = 'json';
    return { key, value: v, type, source: 'attribute' };
  });
}

// ── Normalize action string ───────────────────────────────────────────────────

function normalizeAction(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[-\s]+/g, '_')
    .trim();
}

// ── Validate command structure ────────────────────────────────────────────────

function validateCommand(cmd: ParsedCommand): string[] {
  const errors: string[] = [];

  // JAVARI_PATCH and JAVARI_SYSTEM_REPAIR can have action derived from name attr
  const isPatch = cmd.tagName === 'JAVARI_PATCH' || cmd.tagName === 'JAVARI_SYSTEM_REPAIR';

  if (!cmd.action && !isPatch) {
    errors.push('Missing required field: action (set via action="..." attribute or ACTION: body field)');
  }

  // Module generation requires name + slug + description + family
  if (cmd.action === 'generate_module' || cmd.action === 'preview_module' || cmd.action === 'commit_module') {
    if (!cmd.fields['name'] && !cmd.name) errors.push('generate_module requires name field');
    if (!cmd.fields['slug']) errors.push('generate_module requires slug field');
    if (!cmd.fields['description']) errors.push('generate_module requires description field');
    if (!cmd.fields['family']) errors.push('generate_module requires family field');
  }

  // update_roadmap requires task_id and status
  if (cmd.action === 'update_roadmap') {
    if (!cmd.fields['task_id']) errors.push('update_roadmap requires task_id field');
    if (!cmd.fields['status']) errors.push('update_roadmap requires status field');
  }

  return errors;
}
