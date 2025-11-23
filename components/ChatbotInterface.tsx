"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ConversationMessage, ChatbotProfile, HighlightItem, ApiStatus } from "@/types";
import { MOOD_OPTIONS, clampResponseCount } from "@/lib/constants";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Modal } from "@/components/Modal";

// EntryStatus component - moved outside to prevent recreation on every render
const EntryStatus = memo(({ selectedDate }: { selectedDate: string }) => {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "exists" | "none">("checking");
  const checkedDatesRef = useRef<Map<string, "exists" | "none">>(new Map());
  const isCheckingRef = useRef(false);

  useEffect(() => {
    // Skip if we've already checked this date
    if (checkedDatesRef.current.has(selectedDate)) {
      setStatus(checkedDatesRef.current.get(selectedDate)!);
      return;
    }

    // Skip if already checking
    if (isCheckingRef.current) {
      return;
    }

    const controller = new AbortController();
    isCheckingRef.current = true;
    setStatus("checking");

    const checkEntry = async () => {
      try {
        const response = await fetch(`/api/journal?date=${selectedDate}`, {
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        let result: "exists" | "none";
        if (response.ok) {
          result = "exists";
        } else if (response.status === 404) {
          result = "none";
        } else {
          result = "none";
        }

        // Cache the result
        checkedDatesRef.current.set(selectedDate, result);
        setStatus(result);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Entry status check failed:", error);
          const result = "none";
          checkedDatesRef.current.set(selectedDate, result);
          setStatus(result);
        }
      } finally {
        isCheckingRef.current = false;
      }
    };

    void checkEntry();

    return () => {
      controller.abort();
      isCheckingRef.current = false;
    };
  }, [selectedDate]);

  if (status === "checking") {
    return <span className="text-xs text-gray-500">Checking...</span>;
  } else if (status === "exists") {
    return (
      <button
        onClick={() => router.push(`/entries/${selectedDate}`)}
        className="text-xs text-yellow-400 hover:text-yellow-300 underline"
      >
        Entry exists
      </button>
    );
  } else {
    return <span className="text-xs text-green-400">New entry</span>;
  }
});

EntryStatus.displayName = "EntryStatus";

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
  onNavigateToProfiles?: () => void;
  entryDate?: string;
  selectedDate?: string;
  onDateChange?: (date: string) => void;
}

export function ChatbotInterface({
  chatbotProfile,
  onComplete,
  initialConversation = [],
  onConversationStart,
  onConversationEnd,
  onNavigateToEntries,
  onNavigateToProfiles,
  entryDate,
  selectedDate,
  onDateChange,
}: ChatbotInterfaceProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [messages, setMessages] = useState<ConversationMessage[]>(initialConversation);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [showMoodSelector, setShowMoodSelector] = useState(false);
  const [isReviewReady, setIsReviewReady] = useState(false);
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
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [entryExists, setEntryExists] = useState<boolean | null>(null);
  const apiStatusCacheRef = useRef<{ status: ApiStatus | null; timestamp: number } | null>(null);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationStarted = useRef(false);
  const conversationEndedRef = useRef(false);
  const originalBodyOverflowRef = useRef<string | null>(null);
  const responseLimit = clampResponseCount(chatbotProfile.responseCount);

  const buildSystemPrompt = (profile: ChatbotProfile, currentAssistantCount: number = 0) => {
    const remainingResponses = responseLimit - currentAssistantCount;
    const isFinalResponse = remainingResponses === 1;
    
    let responseLimitInstruction = '';
    if (isFinalResponse) {
      responseLimitInstruction = `⚠️ CRITICAL FINAL RESPONSE INSTRUCTION ⚠️
This is your LAST response (#${responseLimit} of ${responseLimit}). After this message, the conversation WILL END automatically.

YOU MUST:
✓ Acknowledge what the user shared in a warm, personal way
✓ Provide a brief, meaningful wrap-up that reflects your persona
✓ End with a clear closing statement (e.g., "Thanks for sharing", "Take care", "Until next time")

YOU MUST NOT:
✗ Ask any questions
✗ Ask for more information or details
✗ Suggest continuing the conversation
✗ Leave the conversation open-ended
✗ Use phrases like "feel free to share more" or "let me know if you want to continue"

The conversation ends immediately after your response. Make this a proper conclusion that feels complete and final.`;
    } else {
      responseLimitInstruction = `You have ${remainingResponses} responses remaining (including this one). You have a maximum of ${responseLimit} total responses, including your initial greeting and final wrap-up. Plan your questions so that by response #${Math.max(responseLimit - 1,1)} you have conversed enough with the user to achieve your goal/persona.`;
    }
    
    return `Converse with the user using this persona or identity in a realistic text-chat tone: ${profile.systemPrompt}. 

${responseLimitInstruction}

CRITICAL INSTRUCTION: When you receive a message that says "Start the conversation" or when this is the very first message in the conversation, you MUST ignore that message and immediately begin conversing with the user.`;
  };
  const handleConversationCompletion = async (updatedMessages: ConversationMessage[]) => {
    if (conversationEndedRef.current) {
      return;
    }
    conversationEndedRef.current = true;
    setConversationEnded(true);
    onConversationEnd?.();
    // Show review button immediately, even while generating mood/summary
    setIsReviewReady(true);
    // Generate mood and summary in background
    Promise.all([prepareMoodSuggestion(updatedMessages), generateEntryPreview(updatedMessages)]);
  };

  const evaluateConversationState = async (updatedMessages: ConversationMessage[]) => {
    const assistantMessages = updatedMessages.filter((m) => m.role === "assistant");
    const assistantMessageCount = assistantMessages.length;
    const reachedResponseLimit = assistantMessageCount >= responseLimit;

    if (!conversationEndedRef.current && reachedResponseLimit) {
      await handleConversationCompletion(updatedMessages);
    }
  };


  const startConversation = async () => {
    // Don't check API status here - the actual API call will handle errors
    // This reduces unnecessary API requests and rate limit usage
    setIsLoading(true);
    setStreamingMessage("");
    setShowMoodSelector(false);
    setIsReviewReady(false);
    setConversationEnded(false);
    conversationEndedRef.current = false;
    // Always start with empty messages to ensure chatbot initiates conversation
    setMessages([]);
    setInput("");
    setIsCompleted(false);
    setIsReviewModalOpen(false);
    onConversationStart?.();
    let messageAdded = false; // Declare outside try block so it's accessible in finally
    try {
      const response = await fetch("/api/ollama/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [], // Always start with empty messages to ensure chatbot initiates
          chatbotProfile,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Process any remaining buffer
          if (buffer.trim()) {
            const lines = buffer.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") {
                  break;
                }
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.content) {
                    fullContent += parsed.content;
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.startsWith("data: ") ? line.slice(6) : line;
            if (data === "[DONE]") {
              // Mark that we've received the done signal, but continue processing
              // to ensure we don't miss any buffered content
              if (fullContent.trim() && !messageAdded) {
                const assistantMessage: ConversationMessage = {
                  role: "assistant",
                  content: fullContent.trim(),
                  timestamp: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, assistantMessage]);
                messageAdded = true;
                setStreamingMessage("");
              }
              break;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullContent += parsed.content;
                setStreamingMessage(fullContent);
    }
            } catch (e) {
              // Ignore parse errors for incomplete JSON
            }
          }
        }
      }

      // Final check: if we have content but haven't added the message yet
      if (fullContent.trim() && !messageAdded) {
        const assistantMessage: ConversationMessage = {
          role: "assistant",
          content: fullContent.trim(),
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setStreamingMessage("");
      }
    } catch (error) {
      console.error("Error starting conversation:", error);
      alert("Failed to start conversation. Please check your API settings.");
    } finally {
      setIsLoading(false);
      // Don't clear streaming message here - it should already be cleared when message is added
      // Only clear if we're in an error state
      if (!messageAdded) {
        setStreamingMessage("");
      }
    }
  };

  const checkApiStatus = useCallback(async (useCache: boolean = true) => {
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
  }, [CACHE_DURATION]);

  useEffect(() => {
    // Check API status on mount only (cached)
    checkApiStatus(true);
  }, [checkApiStatus]);

  // Always start conversation on mount, regardless of initialConversation
  useEffect(() => {
    if (!conversationStarted.current) {
      conversationStarted.current = true;
      startConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  // Scroll to bottom when keyboard appears on mobile
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const handleViewportResize = () => {
      const viewport = window.visualViewport;
      if (!viewport) return;
      
      // Check if keyboard is likely open (viewport height decreased significantly)
      const heightDiff = window.innerHeight - viewport.height;
      if (heightDiff > 150) {
        // Keyboard is likely open, scroll to bottom
        setTimeout(() => {
          shouldAutoScrollRef.current = true;
          scrollToBottom();
        }, 100);
      }
    };

    const viewport = window.visualViewport;
    viewport.addEventListener("resize", handleViewportResize);
    return () => {
      viewport?.removeEventListener("resize", handleViewportResize);
    };
  }, []);

  // Check if entry exists for the selected date
  useEffect(() => {
    const dateToCheck = entryDate || selectedDate;
    if (!dateToCheck) {
      setEntryExists(null);
      return;
    }

    const checkEntryExists = async () => {
      try {
        const response = await fetch(`/api/journal?date=${dateToCheck}`);
        setEntryExists(response.ok);
      } catch (error) {
        console.error("Error checking entry existence:", error);
        setEntryExists(null);
      }
    };

    void checkEntryExists();
  }, [entryDate, selectedDate]);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "assistant" && !conversationEnded) {
      inputRef.current?.focus();
    }
  }, [messages, conversationEnded]);

  useEffect(() => {
    conversationEndedRef.current = conversationEnded;
  }, [conversationEnded]);

  // Prevent body scrolling when review panel is open
  useEffect(() => {
    if (showMoodSelector || isReviewModalOpen) {
      // Store original overflow value if not already stored
      if (originalBodyOverflowRef.current === null) {
        originalBodyOverflowRef.current = document.body.style.overflow || "";
      }
      document.body.style.overflow = "hidden";
    } else {
      // Restore original overflow value
      if (originalBodyOverflowRef.current !== null) {
        document.body.style.overflow = originalBodyOverflowRef.current;
        originalBodyOverflowRef.current = null;
      }
    }
  }, [showMoodSelector, isReviewModalOpen]);

  useEffect(() => {
    if (suggestedMood !== null && selectedMood === null) {
      setSelectedMood(suggestedMood);
    }
  }, [suggestedMood, selectedMood]);

  const scrollToBottom = () => {
    if (!chatContainerRef.current || !shouldAutoScrollRef.current) return;
    chatContainerRef.current.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: "auto",
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


  const handleSend = async () => {
    if (!input.trim() || isLoading || conversationEnded) return;

    // Check if we've reached the response limit before sending
    const currentAssistantCount = messages.filter((m) => m.role === "assistant").length;
    if (currentAssistantCount >= responseLimit) {
      // Should not happen due to conversationEnded check, but double-check
      setConversationEnded(true);
      return;
    }

    // Don't check API status here - the actual API call will handle errors
    // This reduces unnecessary API requests and rate limit usage
    const userMessage: ConversationMessage = {
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    // Reset textarea height to single line after sending
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = "2.5rem";
    }
    setIsLoading(true);
    setStreamingMessage("");

    try {
      const response = await fetch("/api/ollama/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          systemPrompt: buildSystemPrompt(chatbotProfile, currentAssistantCount),
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

  // Render the review panel content
  const renderReviewPanelContent = () => (
    <>
      <div className="p-3 sm:p-4 border-b border-github-dark-border">
        <h3 className="text-base sm:text-lg font-semibold">Entry Review</h3>
        <p className="text-xs text-gray-400 mt-1">
          Select your mood, review the generated summary, then submit your entry.
        </p>
      </div>
      <div className="p-3 sm:p-4 border-b border-github-dark-border">
        <h4 className="font-semibold mb-2 text-sm sm:text-base">How are you feeling today?</h4>
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {MOOD_OPTIONS.map((mood) => (
            <button
              key={mood.value}
              onClick={() => handleMoodPick(mood.value)}
              className={`p-2 sm:p-3 rounded-lg border-2 transition-all ${
                mood.value === selectedMood
                  ? "border-github-green bg-github-green/20"
                  : "border-github-dark-border hover:border-github-green/50"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              disabled={isFinalizing || isCompleted || isAnalyzingMood}
            >
              <div className="text-xl sm:text-2xl mb-0.5 sm:mb-1">{mood.emoji}</div>
              <div className="text-[10px] sm:text-xs leading-tight">{mood.label}</div>
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
      <div className="flex-1 min-h-0 p-3 sm:p-4">
        <div className="flex flex-col h-full overflow-hidden">
          <h4 className="font-semibold mb-2 text-sm sm:text-base">Highlights & Summary</h4>
          <div className="flex-1 min-h-0 bg-github-dark rounded p-3 sm:p-4 border border-github-dark-border overflow-y-auto space-y-4 sm:space-y-6" style={{ WebkitOverflowScrolling: "touch" }}>
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
      <div className="p-3 sm:p-4 border-t border-github-dark-border space-y-3">
        {!isCompleted && (
          <>
            <button
              onClick={handleSubmitEntry}
              disabled={
                selectedMood === null ||
                isFinalizing ||
                isGeneratingSummary ||
                isAnalyzingMood
              }
              className="w-full px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg text-sm sm:text-base font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFinalizing ? "Saving Entry..." : "Submit Entry"}
            </button>
            {entryExists === true && (
              <p className="text-xs text-yellow-400 mt-1">
                ⚠️ Warning: This will overwrite the existing entry for this date.
              </p>
            )}
          </>
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
              {entryDate && (
                <button
                  onClick={() => router.push(`/entries/${entryDate}`)}
                  className="px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  View Entry
                </button>
              )}
              {entryDate && session?.user && (
                <a
                  href={`https://github.com/${(session.user as any)?.username || session.user?.name}/gitchat-journal/blob/main/entries/${entryDate}.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg font-medium transition-colors text-center text-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" clipRule="evenodd" />
                  </svg>
                  View in GitHub
                </a>
              )}
              {onNavigateToEntries && (
                <button
                  onClick={onNavigateToEntries}
                  className="px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  View All Entries
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );


  return (
    <div className="flex flex-col h-full overflow-hidden min-h-0">
      {/* Chat Interface - Mobile First Design */}
      <div className={`flex flex-col ${showMoodSelector ? "flex-1 lg:w-auto" : "w-full"} h-full bg-github-dark min-w-0 overflow-hidden min-h-0`}>
        {/* Chat Header - Mobile First */}
        <div className="flex-shrink-0 bg-github-dark-hover border-b border-github-dark-border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Left: Back button, Chatbot name, Status */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                onClick={() => router.push("/dashboard")}
                className="p-1.5 hover:bg-github-dark rounded-lg transition-colors flex-shrink-0 md:hidden"
                aria-label="Back to dashboard"
              >
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-white truncate">{chatbotProfile.name}</h3>
                  {apiStatus && (
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    apiStatus.available ? "bg-green-500" : "bg-red-500"
                  }`} />
                  )}
                </div>
                {selectedDate && onDateChange && (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        if (!conversationEnded) {
                          onDateChange(e.target.value);
                        }
                      }}
                      disabled={conversationEnded}
                      className="bg-github-dark border border-github-dark-border rounded px-2 py-0.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-github-green disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <EntryStatus selectedDate={selectedDate} />
                </div>
              )}
              </div>
            </div>
            {/* Right: Settings button */}
              {onNavigateToProfiles && (
                <button
                  onClick={onNavigateToProfiles}
                className="p-2 hover:bg-github-dark rounded-lg transition-colors flex-shrink-0"
                title="Chatbot settings"
                aria-label="Chatbot settings"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-gray-400 hover:text-white transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}
          </div>
          {apiStatus && !apiStatus.available && (
            <div className="mt-2 p-2 bg-red-900/20 border border-red-700/50 rounded text-xs text-red-400">
              <div className="font-semibold mb-1">API Error:</div>
              <div className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed overflow-x-auto">
                {apiStatus.error || "API unavailable"}
              </div>
            </div>
          )}
        </div>

        <div 
          ref={chatContainerRef} 
          data-chat-container
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[80%] rounded-lg p-2.5 sm:p-3 ${
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
        {isLoading && !streamingMessage && messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">Loading...</div>
          </div>
        )}
        </div>

        {!showMoodSelector && !isReviewReady && (
          <div className="flex-shrink-0 bg-github-dark border-t border-github-dark-border p-3 sm:p-4">
            <div className="flex items-end gap-2 max-w-7xl mx-auto px-4 sm:px-6">
              <textarea
                ref={inputRef}
                value={input}
                onKeyPress={handleKeyPress}
                onFocus={() => {
                  // Auto-scroll to bottom on mobile when user starts typing
                  if (typeof window !== "undefined" && window.innerWidth < 768) {
                    setTimeout(() => {
                      shouldAutoScrollRef.current = true;
                      scrollToBottom();
                    }, 300);
                  }
                }}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Auto-scroll when user types on mobile
                  if (typeof window !== "undefined" && window.innerWidth < 768) {
                    setTimeout(() => {
                      shouldAutoScrollRef.current = true;
                      scrollToBottom();
                    }, 100);
                  }
                }}
                placeholder="Type your message..."
                className="flex-1 bg-github-dark-hover border border-github-dark-border rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-github-green resize-none disabled:cursor-not-allowed disabled:opacity-60 max-h-32 overflow-y-auto min-h-[2.5rem]"
                rows={1}
                style={{ height: "auto", minHeight: "2.5rem" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
                }}
                disabled={conversationEnded}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || conversationEnded}
                className="px-4 sm:px-6 py-2 h-[2.5rem] bg-github-green hover:bg-github-green-hover text-white rounded-lg text-sm sm:text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                Send
              </button>
            </div>
          </div>
        )}
        {!showMoodSelector && isReviewReady && (
          <div className="flex-shrink-0 bg-github-dark border-t border-github-dark-border p-3 sm:p-4">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <button
                onClick={() => {
                  setShowMoodSelector(true);
                  // Auto-open modal on mobile devices
                  if (typeof window !== "undefined" && window.innerWidth < 1024) {
                    setIsReviewModalOpen(true);
                  }
                }}
                className="w-full px-4 py-3 bg-github-green hover:bg-github-green-hover text-white rounded-lg text-sm sm:text-base font-medium transition-all flex items-center justify-center gap-2 animate-pulse hover:animate-none shadow-lg shadow-github-green/50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Review Entry
              </button>
            </div>
          </div>
        )}
        {showMoodSelector && (
          <div className="flex-shrink-0 bg-github-dark border-t border-github-dark-border p-3 sm:p-4 lg:hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <button
              onClick={() => setIsReviewModalOpen(true)}
              className="w-full px-4 py-3 bg-github-green hover:bg-github-green-hover text-white rounded-lg text-sm sm:text-base font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Review Entry
            </button>
            </div>
          </div>
        )}
      </div>

      {/* Review Entry Button - Desktop */}
      {!showMoodSelector && isReviewReady && (
        <div className="hidden lg:flex lg:w-96 items-center justify-center">
          <button
            onClick={() => setShowMoodSelector(true)}
            className="px-6 py-4 bg-github-green hover:bg-github-green-hover text-white rounded-lg text-base font-medium transition-all flex items-center justify-center gap-2 animate-pulse hover:animate-none shadow-lg shadow-github-green/50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Review Entry
          </button>
        </div>
      )}

      {/* Summary and Mood Selector Panel - Desktop Side Panel */}
      {showMoodSelector && (
        <div className="hidden lg:flex lg:w-96 bg-github-dark border border-github-dark-border rounded-lg flex-col h-full max-h-full overflow-hidden">
          {renderReviewPanelContent()}
        </div>
      )}

      {/* Summary and Mood Selector Panel - Mobile Modal */}
      {showMoodSelector && (
        <Modal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          title="Entry Review"
          size="lg"
        >
          <div className="flex flex-col h-full min-h-0">
            {/* Description Section */}
            <div className="flex-shrink-0 p-3 sm:p-4 border-b border-github-dark-border">
              <p className="text-xs text-gray-400">
                Select your mood, review the generated summary, then submit your entry.
              </p>
            </div>
            
            {/* Mood Selector Section */}
            <div className="flex-shrink-0 p-3 sm:p-4 border-b border-github-dark-border">
              <h4 className="font-semibold mb-2 text-sm sm:text-base">How are you feeling today?</h4>
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {MOOD_OPTIONS.map((mood) => (
                  <button
                    key={mood.value}
                    onClick={() => handleMoodPick(mood.value)}
                    className={`p-2 sm:p-3 rounded-lg border-2 transition-all ${
                      mood.value === selectedMood
                        ? "border-github-green bg-github-green/20"
                        : "border-github-dark-border hover:border-github-green/50"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    disabled={isFinalizing || isCompleted || isAnalyzingMood}
                  >
                    <div className="text-xl sm:text-2xl mb-0.5 sm:mb-1">{mood.emoji}</div>
                    <div className="text-[10px] sm:text-xs leading-tight">{mood.label}</div>
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
            
            {/* Scrollable Content Section */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4" style={{ WebkitOverflowScrolling: "touch" }}>
              <div className="flex flex-col">
                <h4 className="font-semibold mb-2 text-sm sm:text-base">Highlights & Summary</h4>
                <div className="bg-github-dark rounded p-3 sm:p-4 border border-github-dark-border space-y-4 sm:space-y-6">
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
            
            {/* Footer Section */}
            <div className="flex-shrink-0 p-3 sm:p-4 border-t border-github-dark-border space-y-3">
              {!isCompleted && (
                <>
                  <button
                    onClick={handleSubmitEntry}
                    disabled={
                      selectedMood === null ||
                      isFinalizing ||
                      isGeneratingSummary ||
                      isAnalyzingMood
                    }
                    className="w-full px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg text-sm sm:text-base font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isFinalizing ? "Saving Entry..." : "Submit Entry"}
                  </button>
                  {entryExists === true && (
                    <p className="text-xs text-yellow-400 mt-1">
                      ⚠️ Warning: This will overwrite the existing entry for this date.
                    </p>
                  )}
                </>
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
                    {entryDate && (
                      <button
                        onClick={() => window.location.href = `/entries/${entryDate}`}
                        className="px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View Entry
                      </button>
                    )}
                    {entryDate && session?.user && (
                      <a
                        href={`https://github.com/${(session.user as any)?.username || session.user?.name}/gitchat-journal/blob/main/entries/${entryDate}.md`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg font-medium transition-colors text-center text-sm flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" clipRule="evenodd" />
                        </svg>
                        View in GitHub
                      </a>
                    )}
                    {onNavigateToEntries && (
                      <button
                        onClick={onNavigateToEntries}
                        className="px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                        View All Entries
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

