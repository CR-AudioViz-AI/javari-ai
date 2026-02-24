/**
 * Javari AI File Operations API
 * Handles file uploads, analysis, and intelligent processing
 * 
 * @route /api/javari/files
 * @version 1.0.0
 * @last-updated 2025-10-28
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// File size limits (in bytes)
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_TEXT_FILE_SIZE = 10 * 1024 * 1024; // 10MB for text files

// Allowed file types
const ALLOWED_MIME_TYPES = [
  // Documents
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  
  // Code files
  'text/javascript',
  'application/javascript',
  'text/x-python',
  'text/x-java-source',
  'text/x-c',
  'text/x-c++',
  'text/html',
  'text/css',
  'application/json',
  'text/xml',
  'application/xml',
  
  // Images
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  
  // Archives
  'application/zip',
  'application/x-tar',
  'application/gzip',
];

interface FileMetadata {
  name: string;
  type: string;
  size: number;
  hash: string;
}

interface FileAnalysis {
  language?: string;
  lineCount?: number;
  characterCount?: number;
  hasErrors?: boolean;
  complexity?: 'simple' | 'moderate' | 'complex';
  suggestions?: string[];
  summary?: string;
}

/**
 * Calculate SHA-256 hash of file content
 */
function calculateHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Detect file language/type from content
 */
function detectLanguage(filename: string, content: string): string | undefined {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'c': 'c',
    'cpp': 'c++',
    'h': 'c',
    'hpp': 'c++',
    'cs': 'csharp',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'php': 'php',
    'swift': 'swift',
    'kt': 'kotlin',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'json': 'json',
    'xml': 'xml',
    'md': 'markdown',
    'txt': 'text',
  };
  
  return ext ? languageMap[ext] : undefined;
}

/**
 * Analyze text file content
 */
async function analyzeTextFile(filename: string, content: string): Promise<FileAnalysis> {
  const language = detectLanguage(filename, content);
  const lines = content.split('\n');
  const lineCount = lines.length;
  const characterCount = content.length;
  
  // Basic complexity analysis
  let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
  if (lineCount > 1000) complexity = 'complex';
  else if (lineCount > 200) complexity = 'moderate';
  
  // Simple error detection for code files
  const hasErrors = language && (
    content.includes('SyntaxError') ||
    content.includes('TypeError') ||
    content.includes('ReferenceError')
  );
  
  // Generate suggestions
  const suggestions: string[] = [];
  
  if (language === 'javascript' || language === 'typescript') {
    if (!content.includes('use strict')) {
      suggestions.push('Consider adding "use strict" for safer code');
    }
    if (content.split('function').length > 20) {
      suggestions.push('File has many functions - consider breaking into modules');
    }
  }
  
  if (lineCount > 500) {
    suggestions.push('Large file - consider breaking into smaller modules');
  }
  
  // Generate summary
  const summary = `${language || 'text'} file with ${lineCount} lines and ${characterCount} characters`;
  
  return {
    language,
    lineCount,
    characterCount,
    hasErrors,
    complexity,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
    summary,
  };
}

/**
 * Basic virus/malware pattern detection
 */
function scanForMalware(filename: string, content: string): {
  result: 'clean' | 'suspicious';
  issues?: string[];
} {
  const suspiciousPatterns = [
    /eval\s*\(\s*atob\s*\(/,  // Obfuscated code
    /document\.write\s*\(/,    // Potential XSS
    /<script[^>]*>.*eval\(/,   // Script injection
    /rm\s+-rf\s+\/|dd\s+if=/,  // Destructive commands
    /\bexec\s*\(|shell_exec/,  // Code execution
  ];
  
  const issues: string[] = [];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      issues.push(`Suspicious pattern detected: ${pattern.source.slice(0, 50)}...`);
    }
  }
  
  // Check for unusual file extensions
  const dangerousExts = ['exe', 'dll', 'bat', 'cmd', 'vbs', 'ps1'];
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext && dangerousExts.includes(ext)) {
    issues.push(`Potentially dangerous file extension: .${ext}`);
  }
  
  return {
    result: issues.length > 0 ? 'suspicious' : 'clean',
    issues: issues.length > 0 ? issues : undefined,
  };
}

/**
 * POST /api/javari/files
 * Upload and analyze a file
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const conversationId = formData.get('conversationId') as string | null;
    const userId = formData.get('userId') as string || 'demo-user';
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }
    
    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type not allowed: ${file.type}` },
        { status: 400 }
      );
    }
    
    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const hash = calculateHash(buffer);
    
    // Convert to string for text files
    const isTextFile = file.type.startsWith('text/') || 
                       file.type.includes('javascript') ||
                       file.type.includes('json') ||
                       file.type.includes('xml');
    
    let content: string | undefined;
    let analysis: FileAnalysis | undefined;
    let scanResult: { result: 'clean' | 'suspicious'; issues?: string[] } | undefined;
    
    if (isTextFile && file.size <= MAX_TEXT_FILE_SIZE) {
      content = buffer.toString('utf-8');
      
      // Analyze content
      analysis = await analyzeTextFile(file.name, content);
      
      // Scan for malware
      scanResult = scanForMalware(file.name, content);
    }
    
    // Check if file already exists (deduplication)
    const { data: existingFile } = await supabase
      .from('javari_file_operations')
      .select('id, file_name, storage_path')
      .eq('file_hash', hash)
      .eq('status', 'completed')
      .single();
    
    let storagePath: string;
    
    if (existingFile) {
      // File already uploaded, reuse
      storagePath = existingFile.storage_path;
    } else {
      // Upload to Supabase Storage
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      storagePath = `uploads/${userId}/${timestamp}-${safeName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('javari-files')
        .upload(storagePath, buffer, {
          contentType: file.type,
          cacheControl: '3600',
        });
      
      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        return NextResponse.json(
          { error: 'Failed to upload file to storage' },
          { status: 500 }
        );
      }
    }
    
    // Save file operation record
    const { data: fileRecord, error: dbError } = await supabase
      .from('javari_file_operations')
      .insert({
        conversation_id: conversationId || null,
        user_id: userId,
        file_name: file.name,
        file_type: file.type,
        file_size_bytes: file.size,
        file_hash: hash,
        operation_type: 'upload',
        storage_path: storagePath,
        analysis_result: analysis ? JSON.stringify(analysis) : null,
        virus_scan_result: scanResult?.result || 'not_scanned',
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to save file record' },
        { status: 500 }
      );
    }
    
    // Return result
    return NextResponse.json({
      success: true,
      file: {
        id: fileRecord.id,
        name: file.name,
        type: file.type,
        size: file.size,
        hash,
      },
      analysis,
      security: {
        scanResult: scanResult?.result || 'not_scanned',
        issues: scanResult?.issues,
      },
      duplicate: !!existingFile,
    });
    
  } catch (error: unknown) {
    logError('File upload error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process file',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/javari/files
 * List user's uploaded files
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'demo-user';
    const conversationId = searchParams.get('conversationId');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    let query = supabase
      .from('javari_file_operations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({
      files: data || [],
      count: data?.length || 0,
    });
    
  } catch (error: unknown) {
    logError('File list error:', error);
    return NextResponse.json(
      {
        error: 'Failed to list files',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/javari/files
 * Delete a file
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const userId = searchParams.get('userId') || 'demo-user';
    
    if (!fileId) {
      return NextResponse.json(
        { error: 'fileId is required' },
        { status: 400 }
      );
    }
    
    // Get file record
    const { data: fileRecord, error: fetchError } = await supabase
      .from('javari_file_operations')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !fileRecord) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    // Delete from storage
    if (fileRecord.storage_path) {
      await supabase.storage
        .from('javari-files')
        .remove([fileRecord.storage_path]);
    }
    
    // Delete record
    await supabase
      .from('javari_file_operations')
      .delete()
      .eq('id', fileId);
    
    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
    });
    
  } catch (error: unknown) {
    logError('File delete error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete file',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
