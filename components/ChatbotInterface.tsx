"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ConversationMessage, ChatbotProfile, HighlightItem, ApiStatus } from "@/types";
import { MOOD_OPTIONS, clampResponseCount } from "@/lib/constants";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatbotInterfaceProps {
  chatbotProfile: ChatbotProfile;
  onComplete: (
    conversation: ConversationMessage[],
    summary: string,
    highlights: HighlightItem[],
    mood: number
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
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [suggestedMood, setSuggestedMood] = useState<number | null>(null);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [conversationEnded, setConversationEnded] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isAnalyzingMood, setIsAnalyzingMood] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const apiStatusCacheRef = useRef<{ status: ApiStatus | null; timestamp: number } | null>(null);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationStarted = useRef(false);
  const conversationEndedRef = useRef(false);
  const responseLimit = clampResponseCount(chatbotProfile.responseCount);

  const buildSystemPrompt = (profile: ChatbotProfile) =>
    `Converse with the user using this persona or identity in a realistic text-chat tone: ${profile.systemPrompt}. 
  You have a maximum of ${responseLimit} total responses, including your initial greeting and final wrap-up. Plan your questions so that by response #${Math.max(responseLimit - 1,1)} you have conversed enough with the user to achieve your goal/persona, and use response #${responseLimit} to acknowledge what you heard, wrap up, and end the chat.  
  CRITICAL INSTRUCTION: When you receive a message that says "Start the conversation" or when this is the very first message in the conversation, you MUST ignore that message and immediately begin conversing with the user.`;
  const handleConversationCompletion = async (updatedMessages: ConversationMessage[]) => {
    if (conversationEndedRef.current) {
      return;
    }
    conversationEndedRef.current = true;
    setConversationEnded(true);
    onConversationEnd?.();
    setShowMoodSelector(true);
    await Promise.all([prepareMoodSuggestion(updatedMessages), generateEntryPreview(updatedMessages)]);
  };

  const evaluateConversationState = async (updatedMessages: ConversationMessage[]) => {
    const assistantMessages = updatedMessages.filter((m) => m.role === "assistant");
    const assistantMessageCount = assistantMessages.length;
    const reachedResponseLimit = assistantMessageCount >= responseLimit;

    if (!conversationEndedRef.current && reachedResponseLimit) {
      await handleConversationCompletion(updatedMessages);
    }
  };


  useEffect(() => {
    if (initialConversation.length === 0 && !conversationStarted.current) {
      conversationStarted.current = true;
      startConversation();
    }
  }, []);

  useEffect(() => {
    // Check API status on mount only (cached)
    checkApiStatus(true);
  }, []);

  const checkApiStatus = async (useCache: boolean = true) => {
    // Use cache if available and not expired
    if (useCache && apiStatusCacheRef.current) {
      const cacheAge = Date.now() - apiStatusCacheRef.current.timestamp;
      if (cacheAge < CACHE_DURATION) {
        setApiStatus(apiStatusCacheRef.current.status);
        return;
      }
    }

    try {
      const response = await fetch("/api/api-status");
      if (response.ok) {
        const status = await response.json();
        setApiStatus(status);
        // Cache the result
        apiStatusCacheRef.current = {
          status,
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      console.error("Error checking API status:", error);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "assistant" && !conversationEnded) {
      inputRef.current?.focus();
    }
  }, [messages, conversationEnded]);

  useEffect(() => {
    conversationEndedRef.current = conversationEnded;
  }, [conversationEnded]);

  useEffect(() => {
    if (suggestedMood !== null && selectedMood === null) {
      setSelectedMood(suggestedMood);
    }
  }, [suggestedMood, selectedMood]);

  const scrollToBottom = () => {
    if (!chatContainerRef.current || !shouldAutoScrollRef.current) return;
    chatContainerRef.current.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      shouldAutoScrollRef.current = distanceFromBottom < 80;
    };

    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const startConversation = async () => {
    // Don't check API status here - the actual API call will handle errors
    // This reduces unnecessary API requests and rate limit usage
    setIsLoading(true);
    setStreamingMessage("");
    setShowMoodSelector(false);
    setSummary("");
    setHighlights([]);
    setSuggestedMood(null);
    setSelectedMood(null);
    setConversationEnded(false);
    conversationEndedRef.current = false;
    setIsFinalizing(false);
    setIsCompleted(false);
    setIsGeneratingSummary(false);
    setIsAnalyzingMood(false);
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
                const updatedMessages = [greeting];
                setMessages(updatedMessages);
                setStreamingMessage("");
                messageAdded = true;
                void evaluateConversationState(updatedMessages);
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
            const updatedMessages = [greeting];
            setMessages(updatedMessages);
            setStreamingMessage("");
            messageAdded = true;
            void evaluateConversationState(updatedMessages);
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
        const updatedMessages = [greeting];
        setMessages(updatedMessages);
        setStreamingMessage("");
        void evaluateConversationState(updatedMessages);
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

    // Don't check API status here - the actual API call will handle errors
    // This reduces unnecessary API requests and rate limit usage
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

              void evaluateConversationState(updatedMessages);
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
      } else {
        setSuggestedMood(3);
      }
    } catch (error) {
      console.error("Error analyzing mood:", error);
      setSuggestedMood((prev) => prev ?? 3);
    } finally {
      setIsAnalyzingMood(false);
    }
  };

  const generateEntryPreview = async (
    conversation: ConversationMessage[]
  ): Promise<{ summary: string; highlights: HighlightItem[] }> => {
    setIsGeneratingSummary(true);
    try {
      const summaryResponse = await fetch("/api/journal/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation }),
      });

      if (!summaryResponse.ok) {
        throw new Error("Failed to generate summary");
      }

      const data = await summaryResponse.json();
      const parsedHighlights: HighlightItem[] = Array.isArray(data.highlights)
        ? data.highlights.filter(
            (item: HighlightItem) =>
              typeof item?.title === "string" &&
              typeof item?.description === "string" &&
              item.description.trim().length > 0
          )
        : [];

      const parsedSummary =
        typeof data.summary === "string" ? data.summary.trim() : "";

      setHighlights(parsedHighlights);
      setSummary(parsedSummary);

      return { summary: parsedSummary, highlights: parsedHighlights };
    } catch (error) {
      console.error("Error generating entry preview:", error);
      return { summary: "", highlights: [] };
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleMoodPick = (mood: number) => {
    if (isFinalizing || isCompleted) return;
    setSelectedMood(mood);
  };

  const handleSubmitEntry = async () => {
    if (selectedMood === null || isFinalizing || isCompleted) return;

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

      let finalSummary = summary;
      let finalHighlights = highlights;

      if (!finalSummary || finalHighlights.length === 0) {
        const preview = await generateEntryPreview(currentMessages);
        finalSummary = preview.summary;
        finalHighlights = preview.highlights;
      }

      if (!finalSummary) {
        finalSummary = "Summary unavailable. Please update this entry to add more detail.";
      }

      if (finalHighlights.length === 0) {
        finalHighlights = [
          {
            title: "Daily Reflection",
            description: "Highlights unavailable. Please update this entry later.",
          },
        ];
      }

      await onComplete(currentMessages, finalSummary, finalHighlights, selectedMood);
      setIsCompleted(true);
    } catch (error) {
      console.error("Error finalizing conversation:", error);
      alert("Something went wrong while finishing your entry. Please try again.");
    } finally {
      setIsFinalizing(false);
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
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-lg font-semibold">{chatbotProfile.name}</h3>
              <p className="text-sm text-gray-400">{chatbotProfile.description}</p>
            </div>
            {apiStatus && (
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  apiStatus.available ? "bg-green-500" : "bg-red-500"
                }`} />
                <span className="text-xs text-gray-400">
                  {apiStatus.provider === "openrouter" ? "OpenRouter" : "Ollama"}
                </span>
              </div>
            )}
          </div>
          {apiStatus && !apiStatus.available && (
            <div className="mt-2 p-3 bg-red-900/20 border border-red-700/50 rounded text-xs text-red-400">
              <div className="font-semibold mb-1">Error Details:</div>
              <div className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                {apiStatus.error || "API unavailable. Please check your settings."}
              </div>
            </div>
          )}
        </div>

        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
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
              {message.role === "assistant" ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{message.content}</p>
              )}
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
                className="flex-1 bg-github-dark-hover border border-github-dark-border rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-github-green resize-none disabled:cursor-not-allowed disabled:opacity-60"
                rows={2}
                disabled={conversationEnded}
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
          <div className="p-4 border-b border-github-dark-border">
            <h3 className="text-lg font-semibold">Entry Review</h3>
            <p className="text-xs text-gray-400 mt-1">
              Select your mood, review the generated summary, then submit your entry.
            </p>
          </div>
          <div className="p-4 border-b border-github-dark-border">
            <h4 className="font-semibold mb-2">How are you feeling today?</h4>
            <div className="flex gap-2">
              {MOOD_OPTIONS.map((mood) => (
                <button
                  key={mood.value}
                  onClick={() => handleMoodPick(mood.value)}
                  className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                    mood.value === selectedMood
                      ? "border-github-green bg-github-green/20"
                      : "border-github-dark-border hover:border-github-green/50"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  disabled={isFinalizing || isCompleted || isAnalyzingMood}
                >
                  <div className="text-2xl mb-1">{mood.emoji}</div>
                  <div className="text-xs">{mood.label}</div>
                </button>
              ))}
            </div>
            {isAnalyzingMood ? (
              <p className="text-xs text-gray-400 mt-2">Analyzing your mood...</p>
            ) : suggestedMood !== null ? (
              <p className="text-xs text-gray-400 mt-2">
                Suggested: {MOOD_OPTIONS.find((m) => m.value === suggestedMood)?.emoji}{" "}
                {MOOD_OPTIONS.find((m) => m.value === suggestedMood)?.label}
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-2">Select the mood that fits best.</p>
            )}
            {selectedMood === null && !isAnalyzingMood && (
              <p className="text-xs text-yellow-400 mt-1">Choose a mood to enable submission.</p>
            )}
          </div>
          <div className="flex-1 min-h-0 p-4">
            <div className="flex flex-col h-full overflow-hidden">
              <h4 className="font-semibold mb-2">Highlights & Summary</h4>
              <div className="flex-1 min-h-0 bg-github-dark rounded p-4 border border-github-dark-border overflow-y-auto space-y-6">
                {isGeneratingSummary && highlights.length === 0 && !summary ? (
                  <div className="flex flex-col items-start gap-3 text-gray-400 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.15s" }}
                      />
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.3s" }}
                      />
                      <span>Preparing highlights and summary...</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      This may take a few seconds while we analyze your conversation.
                    </p>
                  </div>
                ) : (
                  <>
                    <section>
                      <h5 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
                        Highlights
                      </h5>
                      {highlights.length > 0 ? (
                        <ul className="list-disc space-y-2 pl-5 text-sm text-gray-200">
                          {highlights.map((item, index) => (
                            <li key={`${item.title}-${index}`}>
                              <span className="font-semibold text-white">{item.title}:</span>{" "}
                              <span className="text-gray-300">{item.description}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-400">
                          Highlights will appear here once ready.
                        </p>
                      )}
                    </section>
                    <section className="flex flex-col">
                      <h5 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
                        Summary
                      </h5>
                      {summary ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">
                          Summary will appear here once ready.
                        </p>
                      )}
                    </section>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-github-dark-border space-y-3">
            {!isCompleted && (
              <button
                onClick={handleSubmitEntry}
                disabled={
                  selectedMood === null ||
                  isFinalizing ||
                  isGeneratingSummary ||
                  isAnalyzingMood
                }
                className="w-full px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isFinalizing ? "Saving Entry..." : "Submit Entry"}
              </button>
            )}
            {isFinalizing && !isCompleted && (
              <p className="text-xs text-gray-400">Finalizing your entry...</p>
            )}
            {isCompleted && (
              <div className="p-3 bg-github-green/20 border border-github-green rounded-lg space-y-3">
                <p className="text-sm text-github-green font-semibold">✓ Entry saved successfully!</p>
                <p className="text-xs text-gray-400">
                  Your journal entry has been saved and synced to GitHub.
                </p>
                <div className="flex flex-col gap-2">
                  {entryDate && session?.user && (
                    <a
                      href={`https://github.com/${(session.user as any)?.username || session.user?.name}/gitchat-journal/blob/main/entries/${entryDate}.md`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-github-dark-hover hover:bg-github-dark-border text-white rounded-lg font-medium transition-colors border border-github-dark-border text-center text-sm"
                    >
                      View in GitHub
                    </a>
                  )}
                  {onNavigateToEntries && (
                    <button
                      onClick={onNavigateToEntries}
                      className="px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg font-medium transition-colors text-sm"
                    >
                      View All Entries
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

