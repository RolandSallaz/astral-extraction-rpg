'use client';

import { useMemo, useState, type FormEvent } from 'react';

export type ChatChannel = 'general' | 'combat';

export type ChatMessage = {
  id: string | number;
  author: string;
  text: string;
  channel: ChatChannel;
  createdAt?: string;
};

export function GameChat({
  messages,
  onSendMessage,
  onInputFocusChange,
}: {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onInputFocusChange?: (isFocused: boolean) => void;
}) {
  const [draft, setDraft] = useState('');
  const [activeChannel, setActiveChannel] = useState<ChatChannel>('general');

  const visibleMessages = useMemo(
    () => messages.filter((message) => message.channel === activeChannel),
    [activeChannel, messages],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextText = draft.trim();
    if (!nextText) {
      return;
    }

    onSendMessage(nextText);
    setDraft('');
  };

  return (
    <section className="pointer-events-auto absolute bottom-5 left-5 z-20 w-[min(92vw,24rem)] select-none rounded-[1.75rem] border border-[#d9efbd]/35 bg-[#17320d]/82 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.32)] backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold tracking-wide text-[#f4ffe8]">
            Chat
          </h2>
          <div className="mt-2 flex gap-2">
            {(['general', 'combat'] as const).map((channel) => (
              <button
                key={channel}
                type="button"
                onClick={() => setActiveChannel(channel)}
                className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition ${
                  activeChannel === channel
                    ? 'border-[#d7f0b6]/60 bg-[#d7f0b6] text-[#18310d]'
                    : 'border-[#b7d98d]/20 bg-[#294c17]/35 text-[#dff0c9]'
                }`}
              >
                {channel}
              </button>
            ))}
          </div>
        </div>

        <span className="rounded-full border border-[#b7d98d]/30 bg-[#294c17]/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#dff0c9]">
          {visibleMessages.length} lines
        </span>
      </div>

      <div className="mt-4 h-48 overflow-y-auto rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3">
        <div className="space-y-2">
          {visibleMessages.map((message) => (
            <div
              key={message.id}
              className="rounded-xl border border-[#8fb466]/18 bg-[#112008]/40 px-3 py-2 text-sm leading-5 text-[#e3f3d1]"
            >
              <span className="mr-2 font-semibold text-[#f4ffe8]">
                {message.author}:
              </span>
              <span>{message.text}</span>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => onInputFocusChange?.(true)}
          onBlur={() => onInputFocusChange?.(false)}
          placeholder="Type a message..."
          className="min-w-0 flex-1 rounded-2xl border border-[#d9efbd]/20 bg-[#102008]/75 px-4 py-3 text-sm text-[#f4ffe8] outline-none transition focus:border-[#d7f0b6]/50"
        />
        <button
          type="submit"
          className="rounded-2xl bg-[#d7f0b6] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#18310d] transition hover:bg-[#e7f8cf]"
        >
          Send
        </button>
      </form>
    </section>
  );
}
