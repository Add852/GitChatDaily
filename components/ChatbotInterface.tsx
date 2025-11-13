"use client";

import { useState, useRef, useEffect } from "react";
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
}

export function ChatbotInterface({
  chatbotProfile,
  onComplete,
  initialConversation = [],
  onConversationStart,
  onConversationEnd,
}: ChatbotInterfaceProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>(initialConversation);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [showMoodSelector, setShowMoodSelector] = useState(false);
  const [summary, setSummary] = useState("");
  const [suggestedMood, setSuggestedMood] = useState(3);
  const [conversationEnded, setConversationEnded] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationStarted = useRef(false);

  const buildSystemPrompt = (profile: ChatbotProfile) =>
    `Can you converse with me about my day? In doing so, your goal is to gather three key pieces of information: today's highlight or standout moment, a problem I dealt with today, and something I'm grateful for. You may ask follow-up questions when helpful, but stay focused on collecting just enough detail to craft a concise journal entry. Assume I don't want to entertain too many questions, so keep the total question count to five or fewer.
Begin the conversation immediately with a short greeting and your first question—do not wait for the user to speak first. Conduct the conversation in a realistic text-chat tone.
Adopt this persona or identity during the conversation: ${profile.systemPrompt}.
After you have collected the needed information, acknowledge it, wrap up the conversation, and end with a 📝 emoji as a delimiter to signal the chat is finished. Do not mention or include the persona in that closing message. Don't respond to this instruction directly; start the conversation now.`;

  useEffect(() => {
    if (initialConversation.length === 0 && !conversationStarted.current) {
      conversationStarted.current = true;
      startConversation();
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const startConversation = async () => {
    setIsLoading(true);
    setStreamingMessage("");
    setShowMoodSelector(false);
    setSummary("");
    setSuggestedMood(3);
    setConversationEnded(false);
    setIsFinalizing(false);
    onConversationStart?.();
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
              const greeting: ConversationMessage = {
                role: "assistant",
                content: fullContent,
                timestamp: new Date().toISOString(),
              };
              setMessages([greeting]);
              setStreamingMessage("");
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    } catch (error) {
      console.error("Error starting conversation:", error);
    } finally {
      setIsLoading(false);
      setStreamingMessage("");
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || conversationEnded) return;

    const userMessage: ConversationMessage = {
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

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
                void prepareMoodSuggestion(updatedMessages);
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
    try {
      const moodResponse = await fetch("/api/ollama/analyze-mood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation }),
      });

      const moodData = await moodResponse.json();
      if (typeof moodData.mood === "number") {
        setSuggestedMood(moodData.mood);
      }
    } catch (error) {
      console.error("Error analyzing mood:", error);
    }
  };

  const generateSummary = async (conversation: ConversationMessage[]) => {
    const summaryResponse = await fetch("/api/journal/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation }),
    });

    const summaryData = await summaryResponse.json();
    setSummary(summaryData.summary);
    return summaryData.summary as string;
  };

  const handleMoodSelect = async (mood: number) => {
    if (isFinalizing) return;

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
      await onComplete(currentMessages, finalSummary, mood);
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
    <div className="flex flex-col h-full bg-github-dark border border-github-dark-border rounded-lg">
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
        <div ref={messagesEndRef} />
      </div>

      {showMoodSelector && (
        <div className="p-4 border-t border-github-dark-border bg-github-dark-hover">
          {summary && (
            <div className="mb-4">
              <h4 className="font-semibold mb-2">Summary:</h4>
              <div className="prose prose-invert prose-sm max-w-none bg-github-dark rounded p-3">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
              </div>
            </div>
          )}
          <div>
            <h4 className="font-semibold mb-2">How are you feeling today?</h4>
            <div className="flex gap-2">
              {MOOD_OPTIONS.map((mood) => (
                <button
                  key={mood.value}
                  onClick={() => handleMoodSelect(mood.value)}
                  className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                    mood.value === suggestedMood
                      ? "border-github-green bg-github-green/20"
                      : "border-github-dark-border hover:border-github-green/50"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  disabled={isFinalizing}
                >
                  <div className="text-2xl mb-1">{mood.emoji}</div>
                  <div className="text-xs">{mood.label}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Suggested: {MOOD_OPTIONS.find((m) => m.value === suggestedMood)?.emoji}{" "}
              {MOOD_OPTIONS.find((m) => m.value === suggestedMood)?.label}
            </p>
            {isFinalizing && (
              <p className="text-xs text-gray-400 mt-2">Finalizing your entry...</p>
            )}
          </div>
        </div>
      )}

      {!showMoodSelector && (
        <div className="p-4 border-t border-github-dark-border">
          <div className="flex gap-2">
            <textarea
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
  );
}

