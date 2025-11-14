"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ConversationMessage, ChatbotProfile } from "@/types";
import { MOOD_OPTIONS } from "@/lib/constants";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type SummarySectionsPayload = {
  highlights: string[];
  summary: string;
};

const DEFAULT_HIGHLIGHT = "You took time to reflect on your day.";
const DEFAULT_SUMMARY = "You reflected on your day, noting both your challenges and your wins.";

const cleanPreviewChunk = (chunk: string) => {
  if (!chunk) return "";
  // Remove JSON-ish lines
  const lines = chunk.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return false;
    if (/^"(model|created_at|message|done)"/.test(trimmed)) return false;
    if (/^{"model":/.test(trimmed)) return false;
    return true;
  });
  return lines.join("\n");
};

const extractMarkdownSection = (markdown: string, heading: string) => {
  const pattern = new RegExp(`^#+\\s*${heading}\\b.*$`, "im");
  const match = pattern.exec(markdown);
  if (!match) return "";

  const startIndex = match.index + match[0].length;
  const rest = markdown.slice(startIndex);
  const nextHeadingMatch = rest.search(/^#+\s+/m);
  const section = nextHeadingMatch !== -1 ? rest.slice(0, nextHeadingMatch) : rest;
  return section.trim();
};

const stripListMarker = (line: string) => line.replace(/^[\-\*\u2022\d\.\s]+/, "").trim();

const parseMarkdownSections = (markdown: string): SummarySectionsPayload | null => {
  if (!markdown?.trim()) return null;

  const highlightsSection = extractMarkdownSection(markdown, "Highlights");
  const summarySection = extractMarkdownSection(markdown, "Summary") || markdown.trim();

  const sectionHighlights = highlightsSection
    .split(/\r?\n/)
    .map(stripListMarker)
    .filter((line) => !!line && line.length < 300);

  const fallbackHighlights = markdown
    .split(/\r?\n/)
    .map(stripListMarker)
    .filter((line) => !!line && line.length < 300);

  const highlights =
    sectionHighlights.length > 0
      ? sectionHighlights
      : fallbackHighlights.length > 0
      ? fallbackHighlights
      : [DEFAULT_HIGHLIGHT];

  const summaryText = summarySection.length > 0 ? summarySection : markdown.trim();

  return {
    highlights: highlights.slice(0, 4),
    summary: summaryText,
  };
};

const formatSummaryMarkdown = (sections: SummarySectionsPayload) => {
  const highlightList =
    sections.highlights && sections.highlights.length > 0
      ? sections.highlights.map((item) => `- ${item}`).join("\n")
      : `- ${DEFAULT_HIGHLIGHT}`;
  return `### Highlights
${highlightList}

### Summary
${sections.summary || DEFAULT_SUMMARY}`;
};

interface ChatbotInterfaceProps {
  chatbotProfile: ChatbotProfile;
  onComplete: (
    conversation: ConversationMessage[],
    summary: string,
    mood: number,
    summarySections?: SummarySectionsPayload
  ) => void;
  initialConversation?: ConversationMessage[];
  onConversationStart?: () => void;
  onConversationEnd?: () => void;
  onNavigateToEntries?: () => void;
  entryDate?: string;
}

export function ChatbotInterface({
  chatbotProfile,
  onComplete,
  initialConversation = [],
  onConversationStart,
  onConversationEnd,
  onNavigateToEntries,
  entryDate,
}: ChatbotInterfaceProps) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<ConversationMessage[]>(initialConversation);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [showMoodSelector, setShowMoodSelector] = useState(false);
  const [summary, setSummary] = useState("");
  const [summarySections, setSummarySections] = useState<SummarySectionsPayload | null>(null);
  const [previewSummary, setPreviewSummary] = useState("");
  const [suggestedMood, setSuggestedMood] = useState<number | null>(null);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [conversationEnded, setConversationEnded] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isAnalyzingMood, setIsAnalyzingMood] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationStarted = useRef(false);
  const summaryPromiseRef = useRef<Promise<SummarySectionsPayload> | null>(null);
  const previewSummaryRef = useRef("");

  const updatePreviewSummary = (value: string) => {
    previewSummaryRef.current = value;
    setPreviewSummary(value);
  };

  const buildSystemPrompt = (profile: ChatbotProfile) =>
    `You are a chatbot designed to help users document their day. Your goal is to gather three key pieces of information: today's highlight or standout moment, a problem they dealt with today, and something they're grateful for. You may ask follow-up questions when helpful, but stay focused on collecting just enough detail to craft a concise journal entry. Keep the total question count to five or fewer. After you have collected the needed information, DO NOT craft the journal entry, just acknowledge the information they provided, wrap up the conversation, and end with a 📝 emoji as a delimiter to signal the chat is finished. Conduct the conversation in a realistic text-chat tone. Adopt this persona or identity during the conversation: ${profile.systemPrompt}.
  CRITICAL INSTRUCTION: When you receive a message that says "Start the conversation" or when this is the very first message in the conversation, you MUST ignore that message and immediately begin with a short greeting and your first question about their day. DO NOT ever use the emoji 📝 anywhere unless you are ending conversation`;

  useEffect(() => {
    if (initialConversation.length === 0 && !conversationStarted.current) {
      conversationStarted.current = true;
      startConversation();
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  useEffect(() => {
    if (showMoodSelector || conversationEnded) return;
    const lastMessage = messages[messages.length - 1];
    if (!isLoading && (!lastMessage || lastMessage.role === "assistant")) {
      inputRef.current?.focus();
    }
  }, [messages, isLoading, showMoodSelector, conversationEnded]);

  const scrollToBottom = () => {
    // Don't force scroll - allow user to navigate while messages are generating
    if (messagesEndRef.current && !isLoading) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const startConversation = async () => {
    setIsLoading(true);
    setStreamingMessage("");
    setShowMoodSelector(false);
    setSummary("");
    setSummarySections(null);
    updatePreviewSummary("");
    summaryPromiseRef.current = null;
    setSuggestedMood(null);
    setSelectedMood(null);
    setConversationEnded(false);
    setIsFinalizing(false);
    onConversationStart?.();
    let messageAdded = false; // Declare outside try block so it's accessible in finally
    try {
      const response = await fetch("/api/ollama/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [],
          systemPrompt: buildSystemPrompt(chatbotProfile),
        }),
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      console.log("\n=== FRONTEND: Starting conversation stream ===");

      while (true) {
        const { done, value } = await reader.read();
        
        if (value) {
          buffer += decoder.decode(value, { stream: true });
        }
        
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6)); // Remove "data: " prefix
            if (data.content !== undefined) {
              fullContent += data.content;
              console.log("Received content chunk, total length:", fullContent.length);
              setStreamingMessage(fullContent);
            }
            if (data.done) {
              console.log("Received done signal");
              console.log("Full content length:", fullContent.length);
              console.log("Full content:", fullContent);
              // Mark that we've received the done signal, but continue processing
              // to ensure we don't miss any buffered content
              if (fullContent.trim() && !messageAdded) {
                console.log("Adding message to state");
                const greeting: ConversationMessage = {
                  role: "assistant",
                  content: fullContent.trim(),
                  timestamp: new Date().toISOString(),
                };
                setMessages([greeting]);
                setStreamingMessage("");
                messageAdded = true;
              } else {
                console.log("Skipping message add - content empty or already added");
                console.log("fullContent.trim():", fullContent.trim());
                console.log("messageAdded:", messageAdded);
              }
            }
          } catch (e) {
            console.error("Error parsing line:", e, "Line:", line);
          }
        }
        
        // Only exit when the stream reader itself is done
        if (done) {
          console.log("Stream reader done");
          break;
        }
      }
      
      // Process any remaining buffer content after stream ends
      if (buffer.trim()) {
        console.log("Processing remaining buffer");
        try {
          const data = JSON.parse(buffer);
          if (data.content !== undefined) {
            fullContent += data.content;
            setStreamingMessage(fullContent);
          }
          if (data.done && fullContent.trim() && !messageAdded) {
            console.log("Adding message from remaining buffer");
            const greeting: ConversationMessage = {
              role: "assistant",
              content: fullContent.trim(),
              timestamp: new Date().toISOString(),
            };
            setMessages([greeting]);
            setStreamingMessage("");
            messageAdded = true;
          }
        } catch (e) {
          console.error("Error parsing remaining buffer:", e);
        }
      }
      
      // Final fallback: If we have content but no message was added, add it now
      if (fullContent.trim() && !messageAdded) {
        console.log("Final fallback: Adding message");
        const greeting: ConversationMessage = {
          role: "assistant",
          content: fullContent.trim(),
          timestamp: new Date().toISOString(),
        };
        setMessages([greeting]);
        setStreamingMessage("");
      } else if (!messageAdded) {
        console.log("WARNING: No message was added! fullContent:", fullContent);
      }
      
      console.log("=== FRONTEND: Stream processing complete ===\n");
    } catch (error) {
      console.error("Error starting conversation:", error);
    } finally {
      setIsLoading(false);
      // Don't clear streaming message here - it should already be cleared when message is added
      // Only clear if we're in an error state
      if (!messageAdded) {
        console.log("Clearing streaming message in finally block");
        setStreamingMessage("");
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || conversationEnded) return;

    const userMessage: ConversationMessage = {
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    console.log("\n=== USER MESSAGE ===");
    console.log(input.trim());
    console.log("===================\n");

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setStreamingMessage("");

    try {
      const response = await fetch("/api/ollama/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          systemPrompt: buildSystemPrompt(chatbotProfile),
        }),
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6)); // Remove "data: " prefix
            if (data.content !== undefined) {
              fullContent += data.content;
              setStreamingMessage(fullContent);
            }
            if (data.done) {
              console.log("\n=== ASSISTANT RESPONSE (in conversation) ===");
              console.log(fullContent);
              console.log("==========================================\n");
              
              const assistantMessage: ConversationMessage = {
                role: "assistant",
                content: fullContent,
                timestamp: new Date().toISOString(),
              };

              const updatedMessages = [...newMessages, assistantMessage];
              setMessages(updatedMessages);
              setStreamingMessage("");

              // Count assistant messages (questions) - exclude the greeting
              const assistantMessages = updatedMessages.filter((m) => m.role === "assistant");
              const currentQuestionCount = assistantMessages.length - 1; // Subtract greeting

              const trimmedContent = fullContent.trim();
              const endsWithDelimiter = trimmedContent.endsWith("📝");
              const reachedQuestionLimit = currentQuestionCount >= 5;

              if (!conversationEnded && (endsWithDelimiter || reachedQuestionLimit)) {
                setConversationEnded(true);
                onConversationEnd?.();
                setShowMoodSelector(true);
                // Start both mood analysis and summary generation in parallel
                void Promise.all([
                  prepareMoodSuggestion(updatedMessages),
                  generateSummary(updatedMessages)
                ]);
              }
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
      setStreamingMessage("");
    }
  };

  const prepareMoodSuggestion = async (conversation: ConversationMessage[]) => {
    setIsAnalyzingMood(true);
    try {
      const moodResponse = await fetch("/api/ollama/analyze-mood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation }),
      });

      const moodData = await moodResponse.json();
      if (typeof moodData.mood === "number") {
        setSuggestedMood(moodData.mood);
        // Auto-select suggested mood if no mood is selected yet
        if (selectedMood === null) {
          setSelectedMood(moodData.mood);
        }
      }
    } catch (error) {
      console.error("Error analyzing mood:", error);
    } finally {
      setIsAnalyzingMood(false);
    }
  };

  const generateSummary = async (conversation: ConversationMessage[]): Promise<SummarySectionsPayload> => {
    if (summaryPromiseRef.current) {
      return summaryPromiseRef.current;
    }

    setIsGeneratingSummary(true);
    updatePreviewSummary("");

    const promise = (async () => {
      try {
        const summaryResponse = await fetch("/api/journal/summarize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({ conversation }),
          cache: "no-store",
        });

        if (!summaryResponse.ok || !summaryResponse.body) {
          throw new Error("Failed to generate summary");
        }

        const reader = summaryResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalSections: SummarySectionsPayload | null = null;

        const processEvent = (payload: string) => {
          if (!payload) return;
          try {
            const event = JSON.parse(payload);
              if (typeof event.preview === "string") {
                const cleaned = cleanPreviewChunk(event.preview);
                if (cleaned) {
                  updatePreviewSummary(cleaned);
                }
              }
              if (event.payload) {
                const payloadHighlights = Array.isArray(event.payload.highlights)
                  ? event.payload.highlights.filter((item: string) => typeof item === "string" && item.trim())
                  : [];
                const payloadSummary =
                  typeof event.payload.summary === "string"
                    ? event.payload.summary
                    : previewSummaryRef.current;
                const parsedFallback = parseMarkdownSections(previewSummaryRef.current);
                finalSections = {
                  highlights:
                    payloadHighlights.length > 0
                      ? payloadHighlights
                      : parsedFallback?.highlights?.length
                      ? parsedFallback.highlights
                      : [DEFAULT_HIGHLIGHT],
                  summary:
                    payloadSummary?.trim() ||
                    parsedFallback?.summary ||
                    DEFAULT_SUMMARY,
                };
              }
          } catch {
            // Ignore malformed events
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            processEvent(trimmed.slice(5).trim());
          }
        }

        if (buffer.trim()) {
          const trimmed = buffer.trim();
          const eventPayload = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
          processEvent(eventPayload);
        }

        if (!finalSections) {
          const parsed = parseMarkdownSections(previewSummaryRef.current);
          finalSections = {
            highlights:
              parsed?.highlights && parsed.highlights.length > 0
                ? parsed.highlights
                : [DEFAULT_HIGHLIGHT],
            summary:
              parsed?.summary ||
              previewSummaryRef.current ||
              DEFAULT_SUMMARY,
          };
        }

        setSummarySections(finalSections);
        setSummary(formatSummaryMarkdown(finalSections));
        updatePreviewSummary("");
        return finalSections;
      } catch (error) {
        console.error("Error generating summary:", error);
        const fallback: SummarySectionsPayload = {
          highlights: [DEFAULT_HIGHLIGHT],
          summary: DEFAULT_SUMMARY,
        };
        setSummarySections(fallback);
        setSummary(formatSummaryMarkdown(fallback));
        updatePreviewSummary("");
        return fallback;
      } finally {
        setIsGeneratingSummary(false);
      }
    })();

    summaryPromiseRef.current = promise;
    promise.finally(() => {
      if (summaryPromiseRef.current === promise) {
        summaryPromiseRef.current = null;
      }
    });
    return promise;
  };

  const handleMoodClick = (mood: number) => {
    if (isFinalizing || isCompleted || isAnalyzingMood) return;
    setSelectedMood(mood);
  };

  const handleSubmit = async () => {
    if (isFinalizing || isCompleted || selectedMood === null) return;

    setIsFinalizing(true);
    try {
      const currentMessages = streamingMessage
        ? [
            ...messages,
            {
              role: "assistant" as const,
              content: streamingMessage,
              timestamp: new Date().toISOString(),
            },
          ]
        : messages;

      let sections = summarySections;
      if (!sections) {
        if (summaryPromiseRef.current) {
          sections = await summaryPromiseRef.current;
        } else {
          sections = await generateSummary(currentMessages);
        }
      }
      const finalSummary = summary || formatSummaryMarkdown(sections);
      await onComplete(currentMessages, finalSummary, selectedMood, sections);
      setIsCompleted(true);
      setIsFinalizing(false);
    } catch (error) {
      console.error("Error finalizing conversation:", error);
      alert("Something went wrong while finishing your entry. Please try again.");
      setIsFinalizing(false);
      return;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4">
      {/* Chat Interface */}
      <div className={`flex flex-col ${showMoodSelector ? 'flex-1' : 'w-full'} h-full bg-github-dark border border-github-dark-border rounded-lg min-w-0`}>
        <div className="p-4 border-b border-github-dark-border">
          <h3 className="text-lg font-semibold">{chatbotProfile.name}</h3>
          <p className="text-sm text-gray-400">{chatbotProfile.description}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === "user"
                  ? "bg-github-green text-white"
                  : "bg-github-dark-hover text-gray-200"
              }`}
            >
              <div className="prose prose-invert prose-sm max-w-none [&_*]:text-inherit">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {streamingMessage && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg p-3 bg-github-dark-hover text-gray-200">
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {streamingMessage}
                </ReactMarkdown>
              </div>
              <span className="inline-block w-2 h-4 bg-gray-400 ml-1 animate-pulse" />
            </div>
          </div>
        )}
        {isLoading && !streamingMessage && (
          <div className="flex justify-start">
            <div className="bg-github-dark-hover rounded-lg p-3">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          </div>
        )}
          <div ref={messagesEndRef} />
        </div>

        {!showMoodSelector && (
          <div className="p-4 border-t border-github-dark-border">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1 bg-github-dark-hover border border-github-dark-border rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-github-green resize-none"
                rows={2}
                disabled={isLoading || conversationEnded}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || conversationEnded}
                className="px-6 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Summary and Mood Selector Panel */}
      {showMoodSelector && (
        <div className="lg:w-96 w-full bg-github-dark border border-github-dark-border rounded-lg flex flex-col">
          {/* Mood Selector - Anchored at top */}
          <div className="p-4 border-b border-github-dark-border flex-shrink-0">
            <h3 className="text-lg font-semibold mb-3">How are you feeling today?</h3>
            <div className="flex gap-2">
              {MOOD_OPTIONS.map((mood) => {
                const isSelected = mood.value === selectedMood;
                const isSuggested = mood.value === suggestedMood;
                return (
                  <button
                    key={mood.value}
                    onClick={() => handleMoodClick(mood.value)}
                    className={`flex-1 p-3 rounded-lg border-2 transition-all bg-github-dark-hover ${
                      isSelected
                        ? "border-github-green bg-github-green/20"
                        : isSuggested && selectedMood === null
                        ? "border-github-green/50 bg-github-green/10"
                        : "border-github-dark-border hover:border-github-green/50"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    disabled={isFinalizing || isCompleted || isAnalyzingMood}
                    title={isAnalyzingMood ? "Waiting for AI mood suggestion..." : ""}
                  >
                    <div className="text-2xl mb-1">{mood.emoji}</div>
                    <div className="text-xs">{mood.label}</div>
                  </button>
                );
              })}
            </div>
            {isAnalyzingMood ? (
              <p className="text-xs text-gray-400 mt-2">Analyzing your mood...</p>
            ) : suggestedMood !== null ? (
              <p className="text-xs text-gray-400 mt-2">
                Suggested: {MOOD_OPTIONS.find((m) => m.value === suggestedMood)?.emoji}{" "}
                {MOOD_OPTIONS.find((m) => m.value === suggestedMood)?.label}
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-2">Waiting for mood suggestion...</p>
            )}
          </div>

          {/* Summary - Scrollable middle section */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            <div className="mb-4">
              <h4 className="font-semibold mb-2">Summary:</h4>
              {isGeneratingSummary ? (
                previewSummary ? (
                  <div className="bg-github-dark rounded p-3 space-y-2">
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {previewSummary}
                      </ReactMarkdown>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400 text-xs">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      />
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      />
                      <span>Generating summary...</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-github-dark rounded p-3">
                    <div className="flex items-center gap-2 text-gray-400">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      />
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      />
                      <span className="text-sm">Generating summary...</span>
                    </div>
                  </div>
                )
              ) : summarySections ? (
                <div className="space-y-4">
                  <div className="bg-github-dark rounded p-3">
                    <h5 className="text-sm font-semibold mb-2">Highlights</h5>
                    <ul className="list-disc list-inside text-sm text-gray-200 space-y-1">
                      {summarySections.highlights.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="prose prose-invert prose-sm max-w-none bg-github-dark rounded p-3">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {summarySections.summary}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : summary ? (
                <div className="prose prose-invert prose-sm max-w-none bg-github-dark rounded p-3">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
                </div>
              ) : null}
            </div>
          </div>

          {/* Submit Button - Anchored at bottom */}
          <div className="p-4 border-t border-github-dark-border flex-shrink-0">
            {isCompleted ? (
              <div className="p-3 bg-github-green/20 border border-github-green rounded-lg space-y-2">
                <p className="text-sm text-github-green font-semibold mb-2">✓ Entry saved successfully!</p>
                <p className="text-xs text-gray-400 mb-3">Your journal entry has been saved and synced to GitHub.</p>
                <div className="flex gap-2">
                  {entryDate && session?.user && (
                    <a
                      href={`https://github.com/${(session.user as any)?.username || session.user?.name}/gitchat-journal/blob/main/entries/${entryDate}.md`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-4 py-2 bg-github-dark-hover hover:bg-github-dark-border text-white rounded-lg font-medium transition-colors border border-github-dark-border text-center text-sm"
                    >
                      View in GitHub
                    </a>
                  )}
                  {onNavigateToEntries && (
                    <button
                      onClick={onNavigateToEntries}
                      className="flex-1 px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg font-medium transition-colors"
                    >
                      View All Entries
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={handleSubmit}
                  disabled={selectedMood === null || isFinalizing || isGeneratingSummary}
                  className="w-full px-4 py-3 bg-github-green hover:bg-github-green-hover text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isFinalizing ? "Finalizing..." : "Submit Entry"}
                </button>
                {isFinalizing && (
                  <p className="text-xs text-gray-400 mt-2 text-center">Finalizing your entry...</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

