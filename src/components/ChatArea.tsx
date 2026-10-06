import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'
import TypingIndicator from './TypingIndicator'
import InputBox from './InputBox'
import type { ChatMode } from './InputBox'
import type { Chat } from '../hooks/useChat'
import { useAuth } from '../context/AuthContext'

interface Props {
  chat: Chat | null
  isTyping: boolean
  streamingContent: string
  streamingThinking: string
  onSend: (message: string, images: { base64: string; mimeType: string }[], mode: ChatMode) => void
  onStop: () => void
  onRegenerate: () => void
  onEditMessage?: (messageIndex: number, newContent: string) => void
}


export default function ChatArea({ chat, isTyping, streamingContent, streamingThinking, onSend, onStop, onRegenerate, onEditMessage }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { user, guestLimitReached } = useAuth()

  const firstName = (
    user?.displayName ??
    user?.email?.split('@')[0] ??
    null
  )?.split(' ')[0]

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat?.messages, isTyping])

  const isEmpty = !chat || chat.messages.length === 0

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full px-4 pb-8 gap-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <h2 className="text-2xl sm:text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {firstName ? `${greeting}, ${firstName}` : greeting}
              </h2>
              <p className="text-base" style={{ color: 'var(--text-muted)' }}>
                How can I help you today?
              </p>
            </div>
          </div>
        ) : (
          <div className="py-6 space-y-1">
            {chat.messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isLast={i === chat.messages.length - 1}
                onRegenerate={onRegenerate}
                onEdit={msg.role === 'user' && onEditMessage ? (content) => onEditMessage(i, content) : undefined}
                disabled={isTyping}
              />
            ))}
            {isTyping && (
              streamingContent
                ? <MessageBubble message={{ id: 'streaming', role: 'assistant', content: streamingContent, thinking: streamingThinking || undefined, timestamp: new Date() }} isStreaming streamingThinking={streamingThinking} />
                : <TypingIndicator />
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
      <InputBox onSend={onSend} onStop={onStop} disabled={isTyping} guestLimitReached={guestLimitReached} />
    </div>
  )
}
