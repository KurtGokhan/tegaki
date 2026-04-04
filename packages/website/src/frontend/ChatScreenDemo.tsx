import { type ComponentProps, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { computeTimeline, type TegakiBundle, TegakiRenderer } from 'tegaki';
import font from './font.ts';
import './style.css';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const DEFAULT_SPEED = 4;
const CATCH_UP_BASE = 0;

function StreamingTegaki({
  text,
  font,
  speed = DEFAULT_SPEED,
  ...props
}: { text: string; font: TegakiBundle; speed?: number } & ComponentProps<'div'>) {
  const [displayTime, setDisplayTime] = useState(0);
  const timeRef = useRef(0);
  const durationRef = useRef(0);

  const { totalDuration } = computeTimeline(text, font);
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

  const { children: _, ...rest } = props;
  return <TegakiRenderer text={text} time={displayTime} font={font} {...rest} />;
}

export function ChatScreenDemo({ font }: { font: TegakiBundle }) {
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
    <div
      className="flex flex-col h-dvh w-full"
      style={{
        background: 'linear-gradient(170deg, #f0f1f3 0%, #e8e9ec 40%, #e3e4e7 100%)',
        fontFamily: font.family,
      }}
    >
      {/* Header */}
      <div
        className="px-6 py-4 text-center tracking-widest uppercase text-xs"
        style={{
          color: '#6b6e78',
          borderBottom: '1px solid #c5c7cc',
          background: 'linear-gradient(180deg, #ececef 0%, #e7e8eb 100%)',
          boxShadow: '0 1px 3px rgba(80, 82, 90, 0.06)',
          letterSpacing: '0.25em',
        }}
      >
        Magic note
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto flex flex-col ruled-lines"
        style={{
          lineHeight: '1lh',
          padding: '0.5lh 1.5rem',
          gap: '0.5lh',
        }}
      >
        {messages.length === 0 && (
          <p className="text-center mt-12 text-sm italic" style={{ color: '#9a9ca5' }}>
            Dip your pen and begin writing...
          </p>
        )}

        <div className="w-full max-w-3xl mx-auto flex flex-col" style={{ gap: '1lh' }}>
          {messages.map((msg, i) => (
            <div key={`${msg.role}-${i}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' ? (
                <StreamingTegaki
                  className="max-w-[85%] md:max-w-[75%] text-lg md:text-base leading-[inherit]"
                  font={font}
                  text={msg.content}
                  style={{
                    color: '#151820',
                    background: 'linear-gradient(135deg, rgba(252,252,254,0.60) 0%, rgba(245,245,248,0.40) 100%)',
                    borderLeft: '2px solid rgba(80, 82, 95, 0.2)',
                    borderRadius: '2px',
                    padding: '0.5lh 1.25rem',
                  }}
                />
              ) : (
                <div
                  className="max-w-[85%] md:max-w-[75%] text-lg md:text-base leading-[inherit] whitespace-pre-wrap italic"
                  style={{
                    color: '#1e2030',
                    background: 'linear-gradient(135deg, rgba(228, 229, 234, 0.60) 0%, rgba(222, 223, 228, 0.40) 100%)',
                    borderRight: '2px solid rgba(80, 82, 95, 0.2)',
                    borderRadius: '2px',
                    padding: '0.5lh 1.25rem',
                  }}
                >
                  {msg.content}
                </div>
              )}
            </div>
          ))}

          {loading && messages[messages.length - 1]?.content === '' && (
            <div className="flex justify-start">
              <div className="text-sm italic" style={{ color: '#9a9ca5', padding: '0.5lh 1.25rem' }}>
                The pen stirs...
              </div>
            </div>
          )}
        </div>

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        className="p-4 md:px-12"
        style={{
          borderTop: '1px solid #c5c7cc',
          background: 'linear-gradient(0deg, #e7e8eb 0%, #ececef 100%)',
          boxShadow: '0 -2px 6px rgba(80, 82, 90, 0.05)',
        }}
      >
        <div className="w-full max-w-3xl mx-auto flex gap-3 items-end">
          {/* Jagged torn-paper textarea wrapper */}
          <div className="flex-1 relative">
            <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
              <defs>
                <filter id="paper-rough" x="-2%" y="-2%" width="104%" height="104%">
                  <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="4" result="noise" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
                </filter>
              </defs>
            </svg>
            <textarea
              className="w-full px-4 py-3 text-md md:text-base resize-none outline-none"
              rows={1}
              placeholder="Ask something..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              style={{
                background: 'rgba(252, 252, 253, 0.85)',
                border: 'none',
                color: '#151820',
                fontStyle: 'italic',
                boxShadow: '1px 2px 6px rgba(80, 82, 90, 0.1)',
                filter: 'url(#paper-rough)',
              }}
            />
          </div>
          {/* Sticker button */}
          <button
            type="button"
            className="px-5 py-3 text-sm tracking-wider uppercase cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{
              background: loading || !input.trim() ? '#d8d9dc' : '#2a2d38',
              color: loading || !input.trim() ? '#9a9ca5' : '#f5f5f7',
              border: 'none',
              borderRadius: '4px',
              letterSpacing: '0.15em',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              transform: 'rotate(-2deg) translateY(-6px)',
              boxShadow: '2px 3px 0px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.1)',
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<ChatScreenDemo font={font} />);
