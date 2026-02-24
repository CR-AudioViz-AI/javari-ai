/**
 * CR AUDIOVIZ AI - INTER-TOOL COMMUNICATION SYSTEM
 * Enables tools to share assets and hand off tasks
 * 
 * @version 1.0.0
 * @date November 21, 2025 - 11:33 PM EST
 * 
 * Example: PDF Builder asks Logo Studio to generate logo → Logo Studio returns logo → PDF Builder inserts it
 */

import { createClient } from '@/lib/supabase/client';

// ═══════════════════════════════════════════════════════════
// TOOL REGISTRY
// ═══════════════════════════════════════════════════════════

export const TOOLS = {
  LOGO_STUDIO: {
    id: 'logo-studio',
    name: 'Logo Studio',
    url: process.env.NEXT_PUBLIC_LOGO_STUDIO_URL || 'https://crav-logo-studio.vercel.app',
    capabilities: ['generate_logo', 'edit_logo', 'export_logo'],
    assetTypes: ['logo', 'icon', 'brand_asset']
  },
  PDF_BUILDER: {
    id: 'pdf-builder',
    name: 'PDF Builder',
    url: process.env.NEXT_PUBLIC_PDF_BUILDER_URL || 'https://crav-pdf-builder.vercel.app',
    capabilities: ['create_pdf', 'insert_image', 'add_text', 'export_pdf'],
    assetTypes: ['pdf', 'document']
  },
  SOCIAL_GRAPHICS: {
    id: 'social-graphics',
    name: 'Social Graphics Creator',
    url: process.env.NEXT_PUBLIC_SOCIAL_GRAPHICS_URL || 'https://crav-social-graphics.vercel.app',
    capabilities: ['create_graphic', 'apply_template', 'export_image'],
    assetTypes: ['image', 'social_media_post', 'banner']
  },
  INVOICE_GENERATOR: {
    id: 'invoice-generator',
    name: 'Invoice Generator',
    url: process.env.NEXT_PUBLIC_INVOICE_GENERATOR_URL || 'https://crav-invoice-generator.vercel.app',
    capabilities: ['create_invoice', 'add_logo', 'export_pdf'],
    assetTypes: ['invoice', 'pdf']
  },
  EBOOK_CREATOR: {
    id: 'ebook-creator',
    name: 'eBook Creator',
    url: process.env.NEXT_PUBLIC_EBOOK_CREATOR_URL || 'https://crav-ebook-creator.vercel.app',
    capabilities: ['create_ebook', 'add_cover', 'insert_image', 'export_epub'],
    assetTypes: ['ebook', 'epub', 'pdf']
  },
  SITE_BUILDER: {
    id: 'site-builder',
    name: 'Site Builder',
    url: process.env.NEXT_PUBLIC_SITE_BUILDER_URL || 'https://crav-site-builder.vercel.app',
    capabilities: ['create_website', 'add_logo', 'insert_image', 'publish'],
    assetTypes: ['website', 'html']
  },
  NEWSLETTER_CREATOR: {
    id: 'newsletter-creator',
    name: 'Newsletter Creator',
    url: process.env.NEXT_PUBLIC_NEWSLETTER_URL || 'https://crav-newsletter.vercel.app',
    capabilities: ['create_newsletter', 'add_header', 'insert_image', 'export_html'],
    assetTypes: ['newsletter', 'email_template', 'html']
  }
} as const;

// ═══════════════════════════════════════════════════════════
// SHARED ASSET DATABASE
// ═══════════════════════════════════════════════════════════

export interface SharedAsset {
  id: string;
  user_id: string;
  asset_type: string; // logo, icon, image, pdf, etc.
  asset_name: string;
  asset_url: string; // URL to the asset file
  asset_data?: any; // Optional metadata (dimensions, colors, etc.)
  created_by_tool: string; // Which tool created this asset
  created_at: string;
  updated_at: string;
}

/**
 * Store an asset in shared database
 */
export async function storeSharedAsset(params: {
  userId: string;
  assetType: string;
  assetName: string;
  assetUrl: string;
  assetData?: any;
  createdByTool: string;
}): Promise<SharedAsset> {
  const supabase = createClient();

  const asset: Omit<SharedAsset, 'id'> = {
    user_id: params.userId,
    asset_type: params.assetType,
    asset_name: params.assetName,
    asset_url: params.assetUrl,
    asset_data: params.assetData,
    created_by_tool: params.createdByTool,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('shared_assets')
    .insert(asset)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to store asset: ${error.message}`);
  }

  return data;
}

/**
 * Retrieve user's assets by type
 */
export async function getUserAssets(params: {
  userId: string;
  assetType?: string;
  limit?: number;
}): Promise<SharedAsset[]> {
  const supabase = createClient();

  let query = supabase
    .from('shared_assets')
    .select('*')
    .eq('user_id', params.userId)
    .order('created_at', { ascending: false });

  if (params.assetType) {
    query = query.eq('asset_type', params.assetType);
  }

  if (params.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to retrieve assets: ${error.message}`);
  }

  return data || [];
}

/**
 * Get specific asset by ID
 */
export async function getAsset(assetId: string): Promise<SharedAsset | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('shared_assets')
    .select('*')
    .eq('id', assetId)
    .single();

  if (error) {
    return null;
  }

  return data;
}

// ═══════════════════════════════════════════════════════════
// TASK HANDOFF SYSTEM
// ═══════════════════════════════════════════════════════════

export interface TaskHandoff {
  id: string;
  from_tool: string; // Which tool initiated the handoff
  to_tool: string; // Which tool should handle the task
  task_type: string; // generate_logo, create_pdf, etc.
  task_params: any; // Parameters for the task
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any; // Result from the receiving tool
  error?: string;
  created_at: string;
  completed_at?: string;
}

/**
 * Create a task handoff to another tool
 * 
 * Example: PDF Builder asks Logo Studio to generate a logo
 */
export async function createTaskHandoff(params: {
  fromTool: string;
  toTool: string;
  taskType: string;
  taskParams: any;
}): Promise<TaskHandoff> {
  const supabase = createClient();

  const handoff: Omit<TaskHandoff, 'id'> = {
    from_tool: params.fromTool,
    to_tool: params.toTool,
    task_type: params.taskType,
    task_params: params.taskParams,
    status: 'pending',
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('task_handoffs')
    .insert(handoff)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create task handoff: ${error.message}`);
  }

  return data;
}

/**
 * Update task handoff status
 */
export async function updateTaskHandoff(
  handoffId: string,
  updates: {
    status?: 'in_progress' | 'completed' | 'failed';
    result?: any;
    error?: string;
  }
): Promise<void> {
  const supabase = createClient();

  const updateData: any = { ...updates };
  
  if (updates.status === 'completed' || updates.status === 'failed') {
    updateData.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('task_handoffs')
    .update(updateData)
    .eq('id', handoffId);

  if (error) {
    throw new Error(`Failed to update task handoff: ${error.message}`);
  }
}

/**
 * Get pending tasks for a tool
 */
export async function getPendingTasks(toolId: string): Promise<TaskHandoff[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('task_handoffs')
    .select('*')
    .eq('to_tool', toolId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get pending tasks: ${error.message}`);
  }

  return data || [];
}

// ═══════════════════════════════════════════════════════════
// HIGH-LEVEL HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Request logo generation from Logo Studio
 */
export async function requestLogo(params: {
  fromTool: string;
  userId: string;
  logoName: string;
  style?: string;
  colors?: string[];
}): Promise<{ taskId: string; status: string }> {
  const handoff = await createTaskHandoff({
    fromTool: params.fromTool,
    toTool: TOOLS.LOGO_STUDIO.id,
    taskType: 'generate_logo',
    taskParams: {
      userId: params.userId,
      logoName: params.logoName,
      style: params.style,
      colors: params.colors
    }
  });

  // In production, this would trigger a webhook/notification to Logo Studio
  // For now, return the task ID for polling

  return {
    taskId: handoff.id,
    status: handoff.status
  };
}

/**
 * Poll for task completion
 */
export async function waitForTask(
  taskId: string,
  timeoutMs: number = 30000
): Promise<TaskHandoff> {
  const startTime = Date.now();
  const supabase = createClient();

  while (Date.now() - startTime < timeoutMs) {
    const { data } = await supabase
      .from('task_handoffs')
      .select('*')
      .eq('id', taskId)
      .single();

    if (data && (data.status === 'completed' || data.status === 'failed')) {
      return data;
    }

    // Wait 1 second before polling again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error('Task timeout');
}

/**
 * Example: PDF Builder requesting a logo for a document
 */
export async function pdfBuilderRequestLogo(params: {
  userId: string;
  logoName: string;
  style?: string;
}): Promise<SharedAsset> {
  // Step 1: Request logo from Logo Studio
  const { taskId } = await requestLogo({
    fromTool: TOOLS.PDF_BUILDER.id,
    userId: params.userId,
    logoName: params.logoName,
    style: params.style
  });

  // Step 2: Wait for Logo Studio to complete
  const result = await waitForTask(taskId);

  if (result.status === 'failed') {
    throw new Error(result.error || 'Logo generation failed');
  }

  // Step 3: Logo Studio stores the logo in shared assets
  // Step 4: Return the asset so PDF Builder can use it
  return result.result.asset;
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

export {
  storeSharedAsset,
  getUserAssets,
  getAsset,
  createTaskHandoff,
  updateTaskHandoff,
  getPendingTasks,
  requestLogo,
  waitForTask,
  pdfBuilderRequestLogo
};
