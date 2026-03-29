import { type ComponentProps, useCallback, useEffect, useRef, useState } from 'react';
import { computeTimeline, Handwriter } from './HandWriter.tsx';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const DEFAULT_SPEED = 1;
const CATCH_UP_BASE = 0.2;

function StreamingHandwriter({ text, speed = DEFAULT_SPEED, ...props }: { text: string; speed?: number } & ComponentProps<'div'>) {
  const [displayTime, setDisplayTime] = useState(0);
  const timeRef = useRef(0);
  const durationRef = useRef(0);

  const { totalDuration } = computeTimeline(text);
  durationRef.current = totalDuration;

  // Single rAF loop that runs for the lifetime of the component
  useEffect(() => {
    let lastTs: number | null = null;
    let raf: number;

    const tick = (ts: number) => {
      if (lastTs === null) lastTs = ts;
      const baseDelta = ((ts - lastTs) / 1000) * speed;
      lastTs = ts;

      const target = durationRef.current;
      const lag = target - timeRef.current;
      // Gently speed up when there's buffered text to catch up
      const catchUp = 1 + Math.max(0, lag - 1) * CATCH_UP_BASE;
      const delta = baseDelta * catchUp;

      if (timeRef.current < target) {
        timeRef.current = Math.min(timeRef.current + delta, target);
        setDisplayTime(timeRef.current);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  return <Handwriter text={text} time={displayTime} {...props} />;
}

export function ChatScreenDemo() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('Write a haiku about otters');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: Message = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setTimeout(scrollToBottom, 0);

    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: `Error: ${data.error ?? 'Something went wrong'}` };
          return updated;
        });
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop()!;

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') break;
          const { text } = JSON.parse(payload);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1]!;
            updated[updated.length - 1] = { ...last, content: last.content + text };
            return updated;
          });
          setTimeout(scrollToBottom, 0);
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1]!;
        if (!last.content) {
          updated[updated.length - 1] = { role: 'assistant', content: 'Error: Failed to reach the server' };
        }
        return updated;
      });
    } finally {
      setLoading(false);
      setTimeout(scrollToBottom, 0);
    }
  }, [input, loading, scrollToBottom]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  return (
    <div className="flex flex-col h-dvh w-full">
      <div className="bg-gray-100 px-4 py-3 border-b border-gray-300 font-semibold text-sm md:text-base">Chat</div>

      <div className="flex-1 overflow-y-auto p-4 md:px-8 flex flex-col gap-3">
        {messages.length === 0 && <p className="text-gray-400 text-sm md:text-base text-center mt-8">Send a message to start chatting</p>}

        <div className="w-full max-w-3xl mx-auto flex flex-col gap-3">
          {messages.map((msg, i) => (
            <div key={`${msg.role}-${i}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' ? (
                <StreamingHandwriter
                  className="max-w-[85%] md:max-w-[75%] px-3 py-2 rounded-lg text-sm md:text-base bg-gray-200 text-gray-900"
                  text={msg.content}
                />
              ) : (
                <div className="max-w-[85%] md:max-w-[75%] px-3 py-2 rounded-lg text-sm md:text-base whitespace-pre-wrap bg-blue-600 text-white">
                  {msg.content}
                </div>
              )}
            </div>
          ))}

          {loading && messages[messages.length - 1]?.content === '' && (
            <div className="flex justify-start">
              <div className="bg-gray-200 text-gray-500 px-3 py-2 rounded-lg text-sm">Thinking...</div>
            </div>
          )}
        </div>

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-300 p-3 md:px-8">
        <div className="w-full max-w-3xl mx-auto flex gap-2">
          <textarea
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm md:text-base resize-none"
            rows={1}
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            type="button"
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm md:text-base cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
