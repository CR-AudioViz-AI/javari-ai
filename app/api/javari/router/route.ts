import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const { message } = await req.json();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Check for autonomy commands
        const msg = message.toLowerCase();
        
        if (msg.includes('execute task') || msg.match(/task\s+\d+/)) {
          const taskNum = message.match(/\d+/)?.[0];
          send({ type: 'token', data: 'Executing task ' + taskNum + '...' });
          
          // Call autonomy execute
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://javari-ai.vercel.app'}/api/autonomy/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task_id: taskNum })
          });
          
          const result = await response.json();
          
          if (result.success) {
            send({ type: 'token', data: '\n✓ Task completed: ' + result.task_title });
            result.log?.forEach((line: string) => {
              send({ type: 'token', data: '\n' + line });
            });
          } else {
            send({ type: 'token', data: '\n✗ Error: ' + result.error });
          }
          
          send({ type: 'final', data: { response: 'Task execution complete', provider: 'javari' } });
          controller.close();
          return;
        }

        if (msg.includes('begin autonomy') || msg.includes('start autonomy')) {
          send({ type: 'token', data: 'Starting autonomy loop...' });
          
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://javari-ai.vercel.app'}/api/autonomy/loop`, {
            method: 'POST'
          });
          
          const result = await response.json();
          
          send({ type: 'token', data: `\n✓ Autonomy loop completed` });
          send({ type: 'token', data: `\nExecuted: ${result.executed_tasks} tasks` });
          send({ type: 'token', data: `\nReady: ${result.ready_tasks} tasks` });
          
          send({ type: 'final', data: { response: 'Autonomy loop complete', provider: 'javari' } });
          controller.close();
          return;
        }

        if (msg.includes('show progress') || msg.includes('roadmap status')) {
          send({ type: 'token', data: 'Check roadmap at /javari/roadmap' });
          send({ type: 'final', data: { response: 'See /javari/roadmap for full progress', provider: 'javari' } });
          controller.close();
          return;
        }

        // Default: route to OpenAI
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4-turbo-preview',
            messages: [{ role: 'user', content: message }],
            stream: false
          })
        });

        const data = await openaiResponse.json();
        const reply = data.choices?.[0]?.message?.content || 'No response';

        for (const word of reply.split(' ')) {
          send({ type: 'token', data: word + ' ' });
          await new Promise(r => setTimeout(r, 20));
        }

        send({ type: 'final', data: { response: reply, provider: 'openai', model: 'gpt-4-turbo-preview' } });
        controller.close();

      } catch (error: any) {
        send({ type: 'error', data: error.message });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
