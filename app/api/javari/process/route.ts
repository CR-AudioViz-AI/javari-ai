import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { url, type, name } = await req.json();

    let content = '';

    // For PDFs, inform user to use Claude/ChatGPT for now
    // We'll add PDF processing later with proper dependencies
    if (type === 'application/pdf') {
      content = `PDF file: ${name}\n\nNote: PDF text extraction coming soon. For now, please describe the contents or use Claude/ChatGPT for PDF analysis.`;
    }
    
    // Text files
    else if (type.startsWith('text/') || type.includes('markdown') || type.includes('javascript') || type.includes('typescript')) {
      const response = await fetch(url);
      content = await response.text();
    }
    
    // Images - use vision API
    else if (type.startsWith('image/')) {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      
      // Use Anthropic vision
      const visionResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: type,
                  data: base64
                }
              },
              {
                type: 'text',
                text: 'Describe this image in detail. Extract any text you see.'
              }
            ]
          }]
        })
      });
      
      const visionData = await visionResponse.json();
      content = visionData.content[0].text;
    }
    
    // JSON/CSV
    else if (type.includes('json') || type.includes('csv')) {
      const response = await fetch(url);
      content = await response.text();
    }
    
    // Other files
    else {
      content = `File: ${name} (${type})\n\nFile uploaded successfully. Contents available for download.`;
    }

    return NextResponse.json({ 
      success: true, 
      content,
      filename: name
    });

  } catch (error) {
    console.error('Processing error:', error);
    return NextResponse.json(
      { error: 'Processing failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 300;
