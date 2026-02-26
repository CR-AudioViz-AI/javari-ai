/**
 * Markdown chunking for canonical documents
 */

export function chunkMarkdown(text: string, maxChars: number = 800): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  
  let currentChunk = '';
  
  for (const para of paragraphs) {
    if ((currentChunk + para).length > maxChars && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(c => c.length > 0);
}
