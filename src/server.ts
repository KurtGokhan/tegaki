import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import { serve } from 'bun';
import chatPage from '../public/chat.html';
import homepage from '../public/index.html';
import previewPage from '../public/preview.html';

const awsAccessKey = process.env.AWS_ACCESS_KEY_ID;
const awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY;

const bedrock =
  awsAccessKey && awsSecretKey
    ? new AnthropicBedrock({ awsAccessKey, awsSecretKey, awsRegion: process.env.AWS_REGION ?? 'us-east-1' })
    : new AnthropicBedrock({ awsRegion: process.env.AWS_REGION ?? 'us-east-1' });

const server = serve({
  routes: {
    '/': homepage,
    '/chat': chatPage,
    '/preview': previewPage,
    '/api/chat': {
      async POST(req) {
        const body = await req.json();
        const { message } = body as { message: string };

        if (!message) {
          return Response.json({ error: 'message is required' }, { status: 400 });
        }

        const stream = bedrock.messages.stream({
          model: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
          max_tokens: 1024,
          messages: [{ role: 'user', content: message }],
        });

        return new Response(
          new ReadableStream({
            async start(controller) {
              const encoder = new TextEncoder();
              for await (const event of stream) {
                if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
                }
              }
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            },
          }),
          {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            },
          },
        );
      },
    },
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`Listening on ${server.url}`);
