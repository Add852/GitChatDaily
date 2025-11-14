"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ConversationMessage, ChatbotProfile } from "@/types";
import { MOOD_OPTIONS } from "@/lib/constants";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatbotInterfaceProps {
  chatbotProfile: ChatbotProfile;
  onComplete: (conversation: ConversationMessage[], summary: string, mood: number) => void;
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
  const [streamingSummary, setStreamingSummary] = useState("");
  const [suggestedMood, setSuggestedMood] = useState<number | null>(null);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [conversationEnded, setConversationEnded] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isAnalyzingMood, setIsAnalyzingMood] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationStarted = useRef(false);

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
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "assistant" && !conversationEnded) {
      inputRef.current?.focus();
    }
  }, [messages, conversationEnded]);

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
    setIsLoading(true);
    setStreamingMessage("");
    setShowMoodSelector(false);
    setSummary("");
    setStreamingSummary("");
    setSuggestedMood(null);
    setSelectedMood(null);
    setConversationEnded(false);
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

  const generateSummary = async (conversation: ConversationMessage[]) => {
    setIsGeneratingSummary(true);
    setStreamingSummary("");
    try {
      // Check if summarize endpoint supports streaming
      const summaryResponse = await fetch("/api/journal/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation }),
      });

      if (!summaryResponse.body) {
        throw new Error("No response body");
      }

      // Try to stream the summary if possible
      const reader = summaryResponse.body.getReader();
      const decoder = new TextDecoder();
      let fullSummary = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          
          // Try streaming format first
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content !== undefined) {
                fullSummary += data.content;
                setStreamingSummary(fullSummary);
              }
              if (data.done && fullSummary) {
                setSummary(fullSummary);
                setStreamingSummary("");
                return fullSummary;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          } else {
            // If not streaming format, try to parse as JSON directly (fallback)
            try {
              const data = JSON.parse(line);
              if (data.summary) {
                fullSummary = data.summary;
                setStreamingSummary(fullSummary);
                setSummary(fullSummary);
                setStreamingSummary("");
                return fullSummary;
              }
            } catch (e) {
              // Not JSON, continue
            }
          }
        }
      }

      // If we got content but no done signal, set it anyway
      if (fullSummary && !summary) {
        setSummary(fullSummary);
        setStreamingSummary("");
      }
      
      return fullSummary;
    } catch (error) {
      console.error("Error generating summary:", error);
      return "";
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

      const finalSummary = summary || (await generateSummary(currentMessages));
      await onComplete(currentMessages, finalSummary, selectedMood);
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
          <h3 className="text-lg font-semibold">{chatbotProfile.name}</h3>
          <p className="text-sm text-gray-400">{chatbotProfile.description}</p>
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
              <h4 className="font-semibold mb-2">Summary</h4>
              <div className="flex-1 min-h-0 max-h-full overflow-hidden">
                {isGeneratingSummary ? (
                  <div className="bg-github-dark rounded p-3 border border-github-dark-border h-full overflow-y-auto">
                    {streamingSummary ? (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingSummary}</ReactMarkdown>
                        <span className="inline-block w-2 h-4 bg-gray-400 ml-1 animate-pulse" />
                      </div>
                    ) : (
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
                    )}
                  </div>
                ) : summary ? (
                  <div className="prose prose-invert prose-sm max-w-none bg-github-dark rounded p-3 border border-github-dark-border h-full overflow-y-auto">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400 border border-dashed border-github-dark-border rounded p-3">
                    Summary will appear here once ready.
                  </div>
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

