import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { computeTimeline, type TegakiBundle, TegakiRenderer } from 'tegaki';

const CONVERSATION = [
  { role: 'user' as const, content: 'Write a haiku about coding' },
  { role: 'assistant' as const, content: 'Silent keys at night\nLogic blooms from empty lines\nBugs hide in the dawn' },
  { role: 'user' as const, content: "That's beautiful! One more about coffee?" },
  { role: 'assistant' as const, content: 'Steam curls from the cup\nBitter warmth fuels the morning\nOne more sip, then code' },
];

const ASSISTANT_SPEED = 4;
const USER_SPEED = 16;
const DELAY_BETWEEN_MESSAGES = 1500;

function StreamingTegaki({
  text,
  font,
  speed = ASSISTANT_SPEED,
  ...props
}: { text: string; font: TegakiBundle; speed?: number } & ComponentProps<'div'>) {
  const [displayTime, setDisplayTime] = useState(0);
  const timeRef = useRef(0);
  const durationRef = useRef(0);

  const { totalDuration } = computeTimeline(text, font);
  durationRef.current = totalDuration;

  useEffect(() => {
    let lastTs: number | null = null;
    let raf: number;

    const tick = (ts: number) => {
      if (lastTs === null) lastTs = ts;
      const delta = ((ts - lastTs) / 1000) * speed;
      lastTs = ts;

      if (timeRef.current < durationRef.current) {
        timeRef.current = Math.min(timeRef.current + delta, durationRef.current);
        setDisplayTime(timeRef.current);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  const { children: _, ref, ...rest } = props;
  return <TegakiRenderer text={text} time={displayTime} font={font} {...rest} />;
}

export function StaticChatDemo({ font }: { font: TegakiBundle }) {
  const [runKey, setRunKey] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);
  const [started, setStarted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const restart = () => {
    setVisibleCount(0);
    setRunKey((k) => k + 1);
    setStarted(true);
  };

  // Start when the component enters the viewport
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });

    if (!started || visibleCount >= CONVERSATION.length) return;

    const msg = CONVERSATION[visibleCount];
    if (!msg) return;

    // First assistant reply gets extra delay to simulate "thinking"
    let delay: number;
    if (visibleCount === 0) delay = 500;
    else if (visibleCount === 1) delay = 1500;
    else if (visibleCount === 2) delay = 10000;
    else delay = DELAY_BETWEEN_MESSAGES;

    const timer = setTimeout(() => setVisibleCount((c) => c + 1), delay);
    return () => clearTimeout(timer);
  }, [visibleCount, started]);

  const visibleMessages = CONVERSATION.slice(0, visibleCount);

  return (
    <div
      ref={rootRef}
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid light-dark(#c5c7cc, #374151)',
        boxShadow: 'light-dark(0 4px 12px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.3))',
        fontFamily: font.family,
        background:
          'light-dark(linear-gradient(170deg, #f0f1f3 0%, #e8e9ec 40%, #e3e4e7 100%), linear-gradient(170deg, #1f2937 0%, #1a2332 40%, #161d2a 100%))',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textTransform: 'uppercase',
          fontSize: 11,
          letterSpacing: '0.25em',
          color: 'light-dark(#6b6e78, #9ca3af)',
          borderBottom: '1px solid light-dark(#c5c7cc, #374151)',
          background: 'light-dark(linear-gradient(180deg, #ececef 0%, #e7e8eb 100%), linear-gradient(180deg, #1f2937 0%, #1a2332 100%))',
          position: 'relative',
        }}
      >
        Magic note
        <button
          type="button"
          onClick={restart}
          style={{
            position: 'absolute',
            right: 16,
            background: 'none',
            border: 'none',
            color: 'light-dark(#6b6e78, #9ca3af)',
            cursor: 'pointer',
            fontSize: 11,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            padding: '2px 8px',
            borderRadius: 4,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'light-dark(#2a2d38, #e5e7eb)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'light-dark(#6b6e78, #9ca3af)')}
        >
          Replay
        </button>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        className="ruled-lines"
        style={{
          height: 320,
          overflowY: 'auto',
          lineHeight: '1lh',
          padding: '0.5lh 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5lh',
        }}
      >
        {visibleMessages.length === 0 && (
          <p style={{ textAlign: 'center', marginTop: '0.5lh', fontSize: 14, fontStyle: 'italic', color: 'light-dark(#9a9ca5, #6b7280)' }}>
            Dip your pen and begin writing...
          </p>
        )}

        <div style={{ width: '100%', maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1lh' }}>
          {visibleMessages.map((msg, i) => (
            <div
              key={`${runKey}-${msg.role}-${i}`}
              style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
            >
              {msg.role === 'assistant' ? (
                <StreamingTegaki
                  font={font}
                  text={msg.content}
                  style={{
                    maxWidth: '75%',
                    fontSize: 16,
                    lineHeight: 'inherit',
                    color: 'light-dark(#151820, #e5e7eb)',
                    background:
                      'light-dark(linear-gradient(135deg, rgba(252,252,254,0.60) 0%, rgba(245,245,248,0.40) 100%), linear-gradient(135deg, rgba(40,45,55,0.60) 0%, rgba(35,40,50,0.40) 100%))',
                    borderLeft: '2px solid light-dark(rgba(80, 82, 95, 0.2), rgba(200, 205, 215, 0.2))',
                    borderRadius: 2,
                    padding: '0.5lh 1.25rem',
                  }}
                />
              ) : (
                <StreamingTegaki
                  font={font}
                  text={msg.content}
                  speed={USER_SPEED}
                  style={{
                    maxWidth: '75%',
                    fontSize: 16,
                    lineHeight: 'inherit',
                    fontStyle: 'italic',
                    color: 'light-dark(#1e2030, #d1d5db)',
                    background:
                      'light-dark(linear-gradient(135deg, rgba(228, 229, 234, 0.60) 0%, rgba(222, 223, 228, 0.40) 100%), linear-gradient(135deg, rgba(30,35,45,0.60) 0%, rgba(25,30,40,0.40) 100%))',
                    borderRight: '2px solid light-dark(rgba(80, 82, 95, 0.2), rgba(200, 205, 215, 0.2))',
                    borderRadius: 2,
                    padding: '0.5lh 1.25rem',
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Fake input area */}
      <div
        style={{
          padding: '12px 24px',
          borderTop: '1px solid light-dark(#c5c7cc, #374151)',
          background: 'light-dark(linear-gradient(0deg, #e7e8eb 0%, #ececef 100%), linear-gradient(0deg, #1a2332 0%, #1f2937 100%))',
        }}
      >
        <div
          style={{
            maxWidth: 640,
            margin: '0 auto',
            padding: '10px 16px',
            fontSize: 14,
            fontStyle: 'italic',
            color: 'light-dark(#9a9ca5, #6b7280)',
            background: 'light-dark(rgba(252, 252, 253, 0.85), rgba(30, 35, 45, 0.85))',
            boxShadow: 'light-dark(1px 2px 6px rgba(80, 82, 90, 0.1), 1px 2px 6px rgba(0, 0, 0, 0.3))',
          }}
        >
          Ask something...
        </div>
      </div>
    </div>
  );
}
