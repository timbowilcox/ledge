"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// SSE event types (mirrors server-side assistant.ts)
// ---------------------------------------------------------------------------

interface SSETextEvent { type: "text"; text: string }
interface SSEToolCallEvent { type: "tool_call"; toolName: string; input: unknown }
interface SSEToolResultEvent { type: "tool_result"; toolName: string; output: unknown }
interface SSEConfirmationEvent { type: "confirmation_required"; toolName: string; input: unknown; confirmationId: string }
interface SSEDoneEvent { type: "done"; conversationId: string; messages: unknown[] }
interface SSEErrorEvent { type: "error"; message: string }
type SSEEvent = SSETextEvent | SSEToolCallEvent | SSEToolResultEvent | SSEConfirmationEvent | SSEDoneEvent | SSEErrorEvent;

// ---------------------------------------------------------------------------
// Chat message types (client-side)
// ---------------------------------------------------------------------------

interface ToolCallDisplay {
  toolName: string;
  input: unknown;
  output?: unknown;
  status: "running" | "done" | "error";
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallDisplay[];
  timestamp: string;
}

interface PendingConfirmation {
  toolName: string;
  input: unknown;
  confirmationId: string;
}

// ---------------------------------------------------------------------------
// Suggested prompts
// ---------------------------------------------------------------------------

const SUGGESTED_PROMPTS = [
  "What's my cash position?",
  "Show me this month's P&L",
  "What were my biggest expenses?",
];

// ---------------------------------------------------------------------------
// Tool name labels
// ---------------------------------------------------------------------------

const TOOL_LABELS: Record<string, string> = {
  get_account_balances: "Looking up account balances",
  get_income_statement: "Generating income statement",
  get_balance_sheet: "Generating balance sheet",
  get_cash_flow: "Generating cash flow statement",
  search_transactions: "Searching transactions",
  get_transaction: "Fetching transaction details",
  post_transaction: "Preparing transaction",
  reverse_transaction: "Preparing reversal",
  list_templates: "Listing templates",
  get_usage: "Checking usage",
};

// ---------------------------------------------------------------------------
// ChatPanel component
// ---------------------------------------------------------------------------

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && !isStreaming) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen, isStreaming]);

  // ---------------------------------------------------
  // SSE event handler
  // ---------------------------------------------------

  const handleSSEEvent = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case "text":
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = { ...last, content: last.content + event.text };
          return updated;
        });
        break;

      case "tool_call":
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          const toolCalls = [...(last.toolCalls || []), {
            toolName: event.toolName,
            input: event.input,
            status: "running" as const,
          }];
          updated[updated.length - 1] = { ...last, toolCalls };
          return updated;
        });
        break;

      case "tool_result":
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          const toolCalls = (last.toolCalls || []).map((tc) =>
            tc.toolName === event.toolName && tc.status === "running"
              ? { ...tc, output: event.output, status: "done" as const }
              : tc
          );
          updated[updated.length - 1] = { ...last, toolCalls };
          return updated;
        });
        break;

      case "confirmation_required":
        setPendingConfirmation({
          toolName: event.toolName,
          input: event.input,
          confirmationId: event.confirmationId,
        });
        break;

      case "done":
        setConversationId(event.conversationId);
        break;

      case "error":
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = {
            ...last,
            content: last.content || ("Error: " + event.message),
          };
          return updated;
        });
        break;
    }
  }, []);

  // ---------------------------------------------------
  // Send message via SSE
  // ---------------------------------------------------

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    // Add empty assistant message that we'll stream into
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: "",
      toolCalls: [],
      timestamp: new Date().toISOString(),
    };
    setMessages([...newMessages, assistantMsg]);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          })),
          conversationId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: err.error || "Something went wrong. Please try again.",
          };
          return updated;
        });
        setIsStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setIsStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);
          if (!jsonStr.trim()) continue;

          try {
            const event: SSEEvent = JSON.parse(jsonStr);
            handleSSEEvent(event);
          } catch {
            // Skip malformed events
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const remaining = buffer.split("\n");
        for (const line of remaining) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event: SSEEvent = JSON.parse(line.slice(6));
            handleSSEEvent(event);
          } catch {
            // Skip
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: "Connection error. Please try again.",
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [messages, conversationId, isStreaming, handleSSEEvent]);

  // ---------------------------------------------------
  // Confirm / cancel write operations
  // ---------------------------------------------------

  const handleConfirm = useCallback(async (confirmed: boolean) => {
    if (!pendingConfirmation) return;

    const { toolName, input: toolInput } = pendingConfirmation;
    setPendingConfirmation(null);

    if (!confirmed) {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        updated[updated.length - 1] = {
          ...last,
          content: last.content + "\n\n_Operation cancelled._",
        };
        return updated;
      });
      return;
    }

    setIsStreaming(true);
    try {
      const res = await fetch("/api/assistant/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolName, input: toolInput, confirmed: true }),
      });

      const result = await res.json();
      if (result.error) {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = {
            ...last,
            content: last.content + "\n\nError: " + result.error,
          };
          return updated;
        });
      } else {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = {
            ...last,
            content: last.content + "\n\nDone! The operation was completed successfully.",
          };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        updated[updated.length - 1] = {
          ...last,
          content: last.content + "\n\nFailed to execute operation.",
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [pendingConfirmation]);

  // ---------------------------------------------------
  // Key handler for input
  // ---------------------------------------------------

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input);
      }
    },
    [input, sendMessage],
  );

  // ---------------------------------------------------
  // Start new conversation
  // ---------------------------------------------------

  const startNewConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setPendingConfirmation(null);
  }, []);

  // ---------------------------------------------------
  // Toggle tool call expansion
  // ---------------------------------------------------

  const toggleToolExpanded = useCallback((key: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ---------------------------------------------------
  // Render
  // ---------------------------------------------------

  return (
    <>
      {/* Chat toggle button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            width: 48,
            height: 48,
            borderRadius: "50%",
            backgroundColor: "#3B82F6",
            color: "#FFFFFF",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(59,130,246,0.4)",
            zIndex: 50,
            transition: "transform 200ms ease-out, box-shadow 200ms ease-out",
          }}
          aria-label="Open financial assistant"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* Slide-out panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: 420,
          height: "100vh",
          backgroundColor: "#FFFFFF",
          borderLeft: "1px solid rgba(0,0,0,0.10)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 200ms ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            backgroundColor: "#F7F7F6",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <span style={{ fontWeight: 600, fontSize: 15, color: "#0A0A0A", fontFamily: "'DM Sans', sans-serif" }}>
              Financial Assistant
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={startNewConversation}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "6px 8px",
                borderRadius: 6,
                color: "#666",
                fontSize: 13,
                fontFamily: "'DM Sans', sans-serif",
              }}
              title="New conversation"
            >
              New
            </button>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: 6,
                color: "#666",
                fontSize: 18,
                lineHeight: 1,
              }}
              aria-label="Close assistant"
            >
              {"\u00d7"}
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Empty state with suggestions */}
          {messages.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, paddingTop: 60 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <p style={{ color: "#94A3B8", fontSize: 14, fontFamily: "'DM Sans', sans-serif", textAlign: "center", maxWidth: 280 }}>
                Ask me about your accounts, transactions, or financial reports.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 300, marginTop: 8 }}>
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    style={{
                      padding: "10px 14px",
                      backgroundColor: "#F7F7F6",
                      border: "1px solid rgba(0,0,0,0.06)",
                      borderRadius: 8,
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: 13,
                      color: "#334155",
                      fontFamily: "'DM Sans', sans-serif",
                      transition: "border-color 200ms",
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {/* Tool call cards */}
              {msg.toolCalls && msg.toolCalls.length > 0 && msg.role === "assistant" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 4 }}>
                  {msg.toolCalls.map((tc, j) => {
                    const key = i + "-" + j;
                    const isExpanded = expandedTools.has(key);
                    return (
                      <div
                        key={key}
                        style={{
                          backgroundColor: "#F7F7F6",
                          border: "1px solid rgba(0,0,0,0.06)",
                          borderRadius: 8,
                          overflow: "hidden",
                        }}
                      >
                        <button
                          onClick={() => toggleToolExpanded(key)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                            padding: "8px 12px",
                            backgroundColor: "transparent",
                            border: "none",
                            cursor: "pointer",
                            textAlign: "left",
                            fontSize: 12,
                            color: "#64748B",
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          {tc.status === "running" ? (
                            <span className="chat-spinner" />
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                          <span>{TOOL_LABELS[tc.toolName] || tc.toolName}</span>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: "auto", transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 150ms" }}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                        {isExpanded && (
                          <div style={{ padding: "0 12px 10px", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#475569", overflowX: "auto" }}>
                            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                              {JSON.stringify(tc.output ?? tc.input, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Message bubble */}
              {msg.content && (
                <div
                  style={{
                    alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    padding: "10px 14px",
                    borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    backgroundColor: msg.role === "user" ? "#3B82F6" : "#F7F7F6",
                    color: msg.role === "user" ? "#FFFFFF" : "#0A0A0A",
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    fontFamily: "'DM Sans', sans-serif",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {msg.content}
                </div>
              )}
            </div>
          ))}

          {/* Confirmation card */}
          {pendingConfirmation && (
            <div
              style={{
                backgroundColor: "#F7F7F6",
                border: "1px solid #D97706",
                borderRadius: 10,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#92400E", fontFamily: "'DM Sans', sans-serif" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Confirm {pendingConfirmation.toolName === "post_transaction" ? "Transaction" : "Reversal"}
              </div>
              <pre style={{ margin: 0, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#475569", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {JSON.stringify(pendingConfirmation.input, null, 2)}
              </pre>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  onClick={() => handleConfirm(false)}
                  style={{
                    padding: "6px 14px",
                    backgroundColor: "transparent",
                    border: "1px solid rgba(0,0,0,0.15)",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#666",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirm(true)}
                  style={{
                    padding: "6px 14px",
                    backgroundColor: "#3B82F6",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#FFFFFF",
                    fontWeight: 500,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          )}

          {/* Streaming indicator */}
          {isStreaming && messages.length > 0 && !messages[messages.length - 1]?.content && !(messages[messages.length - 1]?.toolCalls?.length) && (
            <div style={{ display: "flex", gap: 4, padding: "8px 0" }}>
              <span className="chat-dot chat-dot-1" />
              <span className="chat-dot chat-dot-2" />
              <span className="chat-dot chat-dot-3" />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid rgba(0,0,0,0.06)",
            backgroundColor: "#FFFFFF",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
              backgroundColor: "#F7F7F6",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.10)",
              padding: "8px 12px",
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your finances..."
              disabled={isStreaming}
              rows={1}
              style={{
                flex: 1,
                border: "none",
                backgroundColor: "transparent",
                resize: "none",
                outline: "none",
                fontSize: 13.5,
                lineHeight: 1.5,
                color: "#0A0A0A",
                fontFamily: "'DM Sans', sans-serif",
                maxHeight: 120,
                overflowY: "auto",
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 120) + "px";
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isStreaming || !input.trim()}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: input.trim() && !isStreaming ? "#3B82F6" : "#E2E8F0",
                border: "none",
                cursor: input.trim() && !isStreaming ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background-color 200ms",
              }}
              aria-label="Send message"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !isStreaming ? "#FFFFFF" : "#94A3B8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes chat-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes chat-pulse { 0%, 100% { opacity: 0.4 } 50% { opacity: 1 } }
        .chat-spinner {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 2px solid #3B82F6;
          border-top-color: transparent;
          border-radius: 50%;
          animation: chat-spin 0.8s linear infinite;
        }
        .chat-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #CBD5E1;
          animation: chat-pulse 1.5s infinite;
        }
        .chat-dot-2 { animation-delay: 0.3s; }
        .chat-dot-3 { animation-delay: 0.6s; }
      `}</style>
    </>
  );
}
