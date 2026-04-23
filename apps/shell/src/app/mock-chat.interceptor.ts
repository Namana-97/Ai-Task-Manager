import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';

export const mockChatInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('/chat/history')) {
    return of(new HttpResponse({ status: 200, body: { messages: [], nextCursor: null } }));
  }

  return next(req);
};

const mockPayloads = [
  {
    answer:
      'You finished 4 tasks last week, with the strongest throughput in UX and Platform work. The most visible completions were [task-0005], [task-0009], [task-0011], and [task-0014].',
    sources: [
      { taskId: 'task-0005', title: 'Ship keyboard navigation for task drawer', similarity: 0.93 },
      { taskId: 'task-0011', title: 'Tune notification digest batching job', similarity: 0.88 }
    ]
  }
];

const originalFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : String(input);
  if (!url.includes('/chat/ask')) {
    return originalFetch(input, init);
  }

  const payload = mockPayloads[0];
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const chunks = payload.answer.split(' ').map((word) =>
        encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: `${word} ` })}\n\n`)
      );
      let index = 0;
      const timer = setInterval(() => {
        if (index < chunks.length) {
          controller.enqueue(chunks[index]);
          index += 1;
          return;
        }

        clearInterval(timer);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'sources', sources: payload.sources })}\n\n`)
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }, 40);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream'
    }
  });
};
