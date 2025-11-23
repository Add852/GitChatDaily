"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useRef } from "react";
import { ChatbotInterface } from "@/components/ChatbotInterface";
import { ChatbotInterfaceSkeleton } from "@/components/Skeleton";
import { ChatbotProfile, ConversationMessage, HighlightItem, JournalEntry } from "@/types";
import { DEFAULT_CHATBOT_PROFILE } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

function JournalPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [chatbotProfile, setChatbotProfile] = useState<ChatbotProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversationActive, setConversationActive] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    // Get date from URL parameter, default to today
    const dateParam = searchParams.get("date");
    if (dateParam) {
      setSelectedDate(dateParam);
    } else {
      setSelectedDate(formatDate(new Date()));
    }
  }, [searchParams]);

  useEffect(() => {
    if (session) {
      fetchChatbotProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.githubId]);

  // Disable body scrolling when journal page is mounted
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Handle mobile keyboard - adjust container height to fit visual viewport
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Prevent scrolling at multiple levels
    const preventScroll = () => {
      document.documentElement.style.overflow = "hidden";
      document.documentElement.style.height = "100%";
      document.documentElement.style.position = "fixed";
      document.documentElement.style.width = "100%";
      document.body.style.overflow = "hidden";
      document.body.style.height = "100%";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      window.scrollTo(0, 0);
    };

    // Prevent touch scrolling on the page, but allow it in chat container, modal, and textarea
    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const chatContainer = document.querySelector('[data-chat-container]');
      const textarea = target.closest('textarea');
      const modalScrollable = target.closest('.modal-scrollable');
      
      // Allow scrolling in chat container, modal scrollable content, and textarea
      if (chatContainer && (chatContainer.contains(target) || chatContainer === target)) {
        return; // Allow scrolling
      }
      if (textarea) {
        return; // Allow scrolling in textarea
      }
      if (modalScrollable) {
        return; // Allow scrolling in modal scrollable content
      }
      
      // Prevent scrolling everywhere else
      e.preventDefault();
    };

    const updateViewportHeight = () => {
      // Calculate available height within the content area
      if (containerRef.current) {
        const parent = containerRef.current.parentElement;
        if (parent) {
          // Get the parent's available height (content area from AppLayout)
          const parentHeight = parent.clientHeight;
          setViewportHeight(parentHeight);
        } else {
          // Fallback: use visual viewport height minus navbar heights
          const mobileNavbarHeight = window.innerWidth < 768 ? 64 : 0;
          const desktopNavbarHeight = window.innerWidth >= 768 ? 64 : 0;
          const navbarHeight = mobileNavbarHeight + desktopNavbarHeight;
          
          if (window.visualViewport) {
            const height = window.visualViewport.height - navbarHeight;
            setViewportHeight(Math.max(height, 0));
          } else {
            const height = window.innerHeight - navbarHeight;
            setViewportHeight(Math.max(height, 0));
          }
        }
      } else {
        // Initial render - use visual viewport height minus navbar heights
        const mobileNavbarHeight = window.innerWidth < 768 ? 64 : 0;
        const desktopNavbarHeight = window.innerWidth >= 768 ? 64 : 0;
        const navbarHeight = mobileNavbarHeight + desktopNavbarHeight;
        
        if (window.visualViewport) {
          const height = window.visualViewport.height - navbarHeight;
          setViewportHeight(Math.max(height, 0));
        } else {
          const height = window.innerHeight - navbarHeight;
          setViewportHeight(Math.max(height, 0));
        }
      }
      preventScroll();
    };

    // Set initial height and prevent scrolling
    preventScroll();
    updateViewportHeight();

    // Add touch move handler to prevent page scrolling
    document.addEventListener("touchmove", handleTouchMove, { passive: false });

    // Use Visual Viewport API if available
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateViewportHeight);
      window.visualViewport.addEventListener("scroll", preventScroll);

      return () => {
        window.visualViewport?.removeEventListener("resize", updateViewportHeight);
        window.visualViewport?.removeEventListener("scroll", preventScroll);
        document.removeEventListener("touchmove", handleTouchMove);
        // Restore scrolling on unmount
        document.documentElement.style.overflow = "";
        document.documentElement.style.height = "";
        document.documentElement.style.position = "";
        document.documentElement.style.width = "";
        document.body.style.overflow = "";
        document.body.style.height = "";
        document.body.style.position = "";
        document.body.style.width = "";
      };
    } else {
      // Fallback for browsers without Visual Viewport API
      window.addEventListener("resize", updateViewportHeight);
      window.addEventListener("orientationchange", updateViewportHeight);
      
      return () => {
        window.removeEventListener("resize", updateViewportHeight);
        window.removeEventListener("orientationchange", updateViewportHeight);
        document.removeEventListener("touchmove", handleTouchMove);
        // Restore scrolling on unmount
        document.documentElement.style.overflow = "";
        document.documentElement.style.height = "";
        document.documentElement.style.position = "";
        document.documentElement.style.width = "";
        document.body.style.overflow = "";
        document.body.style.height = "";
        document.body.style.position = "";
        document.body.style.width = "";
      };
    }
  }, []);

  const fetchChatbotProfile = async () => {
    try {
      const response = await fetch("/api/chatbot-profiles");
      if (response.ok) {
        const chatbots = await response.json();
        if (Array.isArray(chatbots) && chatbots.length > 0) {
          const current =
            chatbots.find((c: ChatbotProfile) => c.isCurrent) ||
            chatbots[0] ||
            DEFAULT_CHATBOT_PROFILE;
          setChatbotProfile(current);
          return;
        }
      }
      // If response not ok or no chatbots
      if (!chatbotProfile) {
        setChatbotProfile(DEFAULT_CHATBOT_PROFILE);
      }
    } catch (error) {
      console.error("Error fetching chatbots:", error);
      if (!chatbotProfile) {
        setChatbotProfile(DEFAULT_CHATBOT_PROFILE);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (
    conversation: ConversationMessage[],
    summary: string,
    highlights: HighlightItem[],
    mood: number
  ) => {
    if (!session?.user?.githubId || !selectedDate || !chatbotProfile) return;

    const entry: JournalEntry = {
      id: `${session.user.githubId}-${selectedDate}`,
      date: selectedDate,
      highlights,
      summary,
      conversation,
      mood,
      chatbotProfileId: chatbotProfile.id,
      chatbotProfileName: chatbotProfile.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      // Save to local storage/API
      const saveResponse = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });

      if (!saveResponse.ok) {
        throw new Error("Failed to save journal entry");
      }

      // Sync to GitHub
      const githubResponse = await fetch("/api/github/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          summary,
          highlights,
          conversation,
          mood,
          chatbotProfileName: chatbotProfile.name,
        }),
      });

      if (!githubResponse.ok) {
        console.error("Failed to sync to GitHub, but entry saved locally");
      }

      // Don't auto-redirect - let user view the summary
      // If redirect is needed, go to entries page instead
      // router.push("/entries");
    } catch (error) {
      console.error("Error saving journal entry:", error);
      alert("Failed to save journal entry. Please try again.");
    }
  };

  if (!session) {
    if (status === "loading") {
      return (
        <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">Loading...</div>
        </div>
      );
    }
    return null;
  }

  return (
    <div 
      ref={containerRef}
      className="h-full flex flex-col overflow-hidden"
      style={{
        height: viewportHeight ? `${viewportHeight}px` : "100%",
        maxHeight: viewportHeight ? `${viewportHeight}px` : "100%",
      }}
    >
          {loading || !chatbotProfile ? (
            <ChatbotInterfaceSkeleton />
          ) : (
            <ChatbotInterface
              key={`${chatbotProfile.id}-${selectedDate}`}
              chatbotProfile={chatbotProfile}
              onComplete={handleComplete}
              onConversationStart={() => setConversationActive(true)}
              onConversationEnd={() => setConversationActive(false)}
              onNavigateToEntries={() => router.push("/entries")}
              onNavigateToProfiles={() => router.push("/chatbots")}
              entryDate={selectedDate}
          selectedDate={selectedDate}
          onDateChange={(newDate) => {
            setSelectedDate(newDate);
            router.push(`/journal?date=${newDate}`);
          }}
            />
          )}
    </div>
  );
}

function JournalPageFallback() {
  return (
    <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading...</div>
    </div>
  );
}

export default function JournalPage() {
  return (
    <Suspense fallback={<JournalPageFallback />}>
      <JournalPageContent />
    </Suspense>
  );
}

