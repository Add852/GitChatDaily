"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { CardSkeleton } from "@/components/Skeleton";
import { Modal } from "@/components/Modal";
import { ChatbotProfile, UserApiSettings, ApiStatus, OpenRouterModel, ApiProvider } from "@/types";
import {
  DEFAULT_CHATBOT_PROFILE,
  DEFAULT_RESPONSE_COUNT,
  RESPONSE_COUNT_MAX,
  RESPONSE_COUNT_MIN,
  clampResponseCount,
} from "@/lib/constants";

export default function ChatbotsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [chatbots, setChatbots] = useState<ChatbotProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingChatbot, setEditingChatbot] = useState<ChatbotProfile | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    responseCountInput: DEFAULT_RESPONSE_COUNT.toString(),
  });
  const [isSaving, setIsSaving] = useState(false);
  const [settingCurrentId, setSettingCurrentId] = useState<string | null>(null);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [apiSettings, setApiSettings] = useState<UserApiSettings>({
    provider: "ollama",
    ollamaApiUrl: process.env.NEXT_PUBLIC_OLLAMA_API_URL || "http://localhost:11434",
    ollamaModel: "llama3.2:3b",
  });
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [savingApiSettings, setSavingApiSettings] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const apiStatusCacheRef = useRef<{ status: ApiStatus | null; timestamp: number } | null>(null);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchChatbots();
      fetchApiSettings();
      // Use cached status if available, otherwise check
      checkApiStatus(true);
    }
  }, [session]);

  useEffect(() => {
    if (apiSettings.provider === "openrouter" && showApiSettings) {
      fetchOpenRouterModels();
    }
  }, [apiSettings.provider, showApiSettings]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(event.target as Node)
      ) {
        setIsModelDropdownOpen(false);
        setModelSearchQuery("");
      }
    };

    if (isModelDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isModelDropdownOpen]);

  const fetchChatbots = async () => {
    try {
      const response = await fetch("/api/chatbot-profiles");
      if (response.ok) {
        const data = await response.json();
        setChatbots(data);
      }
    } catch (error) {
      console.error("Error fetching chatbots:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    const parsedCount = Number.parseInt(formData.responseCountInput, 10);
    const responseCount = clampResponseCount(
      Number.isNaN(parsedCount) ? DEFAULT_RESPONSE_COUNT : parsedCount
    );

    const chatbot: ChatbotProfile = {
      id: editingChatbot?.id || `chatbot-${Date.now()}`,
      name: formData.name,
      description: formData.description,
      systemPrompt: formData.systemPrompt,
      responseCount,
      isCurrent: editingChatbot?.isCurrent ?? false,
      createdAt: editingChatbot?.createdAt || new Date().toISOString(),
    };

    try {
      const response = await fetch("/api/chatbot-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatbot),
      });

      if (response.ok) {
        await fetchChatbots();
        setShowCreateForm(false);
        setEditingChatbot(null);
        setFormData({
          name: "",
          description: "",
          systemPrompt: "",
          responseCountInput: DEFAULT_RESPONSE_COUNT.toString(),
        });
      }
    } catch (error) {
      console.error("Error saving chatbot:", error);
      alert("Failed to save chatbot. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseChatbotForm = () => {
    setShowCreateForm(false);
    setEditingChatbot(null);
    setFormData({
      name: "",
      description: "",
      systemPrompt: "",
      responseCountInput: DEFAULT_RESPONSE_COUNT.toString(),
    });
  };

  const handleEdit = (chatbot: ChatbotProfile) => {
    setEditingChatbot(chatbot);
    setFormData({
      name: chatbot.name,
      description: chatbot.description,
      systemPrompt: chatbot.systemPrompt,
      responseCountInput: (chatbot.responseCount ?? DEFAULT_RESPONSE_COUNT).toString(),
    });
    setShowCreateForm(true);
  };

  const handleSetCurrent = async (chatbot: ChatbotProfile) => {
    setSettingCurrentId(chatbot.id);
    try {
      const response = await fetch("/api/chatbot-profiles/current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: chatbot.id }),
      });

      if (response.ok) {
        await fetchChatbots();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to set current chatbot");
      }
    } catch (error) {
      console.error("Error setting current chatbot:", error);
      alert("Failed to set current chatbot. Please try again.");
    } finally {
      setSettingCurrentId(null);
    }
  };

  const handleDelete = async (chatbot: ChatbotProfile) => {
    // Don't allow deleting the default chatbot
    if (chatbot.id === "default") {
      alert("Cannot delete the default chatbot");
      return;
    }

    if (!confirm(`Are you sure you want to delete "${chatbot.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/chatbot-profiles?id=${chatbot.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchChatbots();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete chatbot");
      }
    } catch (error) {
      console.error("Error deleting chatbot:", error);
      alert("Failed to delete chatbot. Please try again.");
    }
  };

  const fetchApiSettings = async () => {
    try {
      const response = await fetch("/api/user-settings");
      if (response.ok) {
        const settings = await response.json();
        setApiSettings(settings);
      }
    } catch (error) {
      console.error("Error fetching API settings:", error);
    }
  };

  const fetchOpenRouterModels = async () => {
    setLoadingModels(true);
    try {
      const response = await fetch("/api/openrouter/models");
      if (response.ok) {
        const models = await response.json();
        setOpenRouterModels(models);
      } else {
        console.error("Failed to fetch OpenRouter models");
      }
    } catch (error) {
      console.error("Error fetching OpenRouter models:", error);
    } finally {
      setLoadingModels(false);
    }
  };

  const checkApiStatus = async (useCache: boolean = false) => {
    // Use cache if available and not expired
    if (useCache && apiStatusCacheRef.current) {
      const cacheAge = Date.now() - apiStatusCacheRef.current.timestamp;
      if (cacheAge < CACHE_DURATION) {
        setApiStatus(apiStatusCacheRef.current.status);
        return;
      }
    }

    setCheckingStatus(true);
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
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleSaveApiSettings = async () => {
    setSavingApiSettings(true);
    try {
      const response = await fetch("/api/user-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiSettings),
      });

      if (response.ok) {
        // Clear cache and force fresh check after settings change
        apiStatusCacheRef.current = null;
        await checkApiStatus(false);
        setShowApiSettings(false);
        alert("API settings saved successfully!");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to save API settings");
      }
    } catch (error) {
      console.error("Error saving API settings:", error);
      alert("Failed to save API settings. Please try again.");
    } finally {
      setSavingApiSettings(false);
    }
  };

  const handleCloseApiSettings = () => {
    setShowApiSettings(false);
    fetchApiSettings(); // Reset to saved settings
  };

  if (!session) {
    if (status === "loading") {
      return (
        <div className="min-h-screen bg-github-dark">
          <Navbar />
          <div className="flex items-center justify-center h-screen">
            <div className="text-gray-400">Loading...</div>
          </div>
        </div>
      );
    }
    return null;
  }

  const isDefaultLocked = editingChatbot?.id === "default";

  return (
    <div className="min-h-screen bg-github-dark">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Chatbots</h1>
            <p className="text-sm sm:text-base text-gray-400">Customize your AI companion&rsquo;s personality</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Only the current chatbot is used in conversations. Switch it below when you&rsquo;re ready for a new persona.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setShowApiSettings(!showApiSettings);
                if (!showApiSettings) {
                  fetchApiSettings();
                  // Don't check status here - it's already checked on mount
                  // User can manually refresh if needed
                }
              }}
              className="px-3 sm:px-4 py-2 bg-github-dark-hover hover:bg-github-dark-border text-white rounded-lg text-xs sm:text-sm transition-colors border border-github-dark-border"
            >
              API Settings
            </button>
            <button
              onClick={() => {
                setShowCreateForm(true);
                setEditingChatbot(null);
                setFormData({
                  name: "",
                  description: "",
                  systemPrompt: DEFAULT_CHATBOT_PROFILE.systemPrompt,
                  responseCountInput: (
                    DEFAULT_CHATBOT_PROFILE.responseCount ?? DEFAULT_RESPONSE_COUNT
                  ).toString(),
                });
              }}
              className="px-3 sm:px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg text-xs sm:text-sm transition-colors"
            >
              Create Chatbot
            </button>
          </div>
        </div>

        {/* API Status Indicator */}
        {apiStatus && (
          <div className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg border ${
            apiStatus.available
              ? "bg-green-900/20 border-green-700/50"
              : "bg-red-900/20 border-red-700/50"
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 font-semibold text-sm sm:text-base">
                  <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${
                    apiStatus.available ? "bg-green-500" : "bg-red-500"
                  }`} />
                  <span>
                    {apiStatus.available
                      ? `${apiStatus.provider === "openrouter" ? "OpenRouter" : "Ollama"} API Available`
                      : `${apiStatus.provider === "openrouter" ? "OpenRouter" : "Ollama"} API Unavailable`}
                  </span>
                </div>
                {apiStatus.error && (
                  <div className="text-xs sm:text-sm text-gray-400 mt-2">
                    <div className="font-semibold mb-1">Error Details:</div>
                    <div className="whitespace-pre-wrap font-mono text-[10px] sm:text-xs leading-relaxed bg-github-dark-hover p-2 rounded border border-github-dark-border overflow-x-auto">
                      {apiStatus.error}
                    </div>
                  </div>
                )}
                {apiStatus.lastChecked && (
                  <div className="text-xs text-gray-500 mt-1">
                    Last checked: {new Date(apiStatus.lastChecked).toLocaleTimeString()}
                  </div>
                )}
              </div>
              <button
                onClick={() => checkApiStatus(false)}
                disabled={checkingStatus}
                className="px-3 py-1 text-xs sm:text-sm bg-github-dark-hover hover:bg-github-dark-border rounded border border-github-dark-border disabled:opacity-60 flex-shrink-0"
              >
                {checkingStatus ? "Checking..." : "Refresh"}
              </button>
            </div>
          </div>
        )}

        {/* API Settings Modal */}
        <Modal
          isOpen={showApiSettings}
          onClose={handleCloseApiSettings}
          title="API Settings"
          size="md"
        >
          <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0 overflow-y-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
              <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">API Provider</label>
                <select
                  value={apiSettings.provider}
                  onChange={(e) => {
                    const provider = e.target.value as ApiProvider;
                    setApiSettings({
                      ...apiSettings,
                      provider,
                      // Reset provider-specific fields when switching
                      ...(provider === "openrouter"
                        ? { openRouterApiKey: "", openRouterModel: "" }
                        : {
                            ollamaApiUrl: process.env.NEXT_PUBLIC_OLLAMA_API_URL || "http://localhost:11434",
                            ollamaModel: "llama3.2:3b",
                          }),
                    });
                  }}
                  className="w-full bg-github-dark-hover border border-github-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-github-green"
                >
                  <option value="ollama">Ollama (Local)</option>
                  <option value="openrouter">OpenRouter (Cloud)</option>
                </select>
              </div>

              {apiSettings.provider === "openrouter" ? (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">OpenRouter API Key</label>
                    <input
                      type="password"
                      value={apiSettings.openRouterApiKey || ""}
                      onChange={(e) =>
                        setApiSettings({ ...apiSettings, openRouterApiKey: e.target.value })
                      }
                      placeholder="sk-or-v1-..."
                      className="w-full bg-github-dark-hover border border-github-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-github-green"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Get your API key from{" "}
                      <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-github-green hover:underline"
                      >
                        openrouter.ai/keys
                      </a>
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Model</label>
                    {loadingModels ? (
                      <div className="text-gray-400">Loading models...</div>
                    ) : openRouterModels.length === 0 ? (
                      <>
                        <p className="text-xs text-gray-400 mt-1 mb-2">
                          Click &ldquo;Load Models&rdquo; to fetch available models
                        </p>
                        <button
                          onClick={fetchOpenRouterModels}
                          className="px-3 py-1 text-sm bg-github-dark-hover hover:bg-github-dark-border rounded border border-github-dark-border"
                        >
                          Load Models
                        </button>
                      </>
                    ) : (
                      <div className="relative" ref={modelDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                          className="w-full bg-github-dark-hover border border-github-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-github-green text-left flex items-center justify-between"
                        >
                          <span className="truncate">
                            {apiSettings.openRouterModel
                              ? openRouterModels.find((m) => m.id === apiSettings.openRouterModel)?.name ||
                                apiSettings.openRouterModel
                              : "Select a model"}
                          </span>
                          <svg
                            className={`w-5 h-5 transition-transform ${
                              isModelDropdownOpen ? "rotate-180" : ""
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                        {isModelDropdownOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-github-dark border border-github-dark-border rounded-lg shadow-lg max-h-96 overflow-hidden flex flex-col">
                            <div className="p-2 border-b border-github-dark-border">
                              <input
                                type="text"
                                value={modelSearchQuery}
                                onChange={(e) => setModelSearchQuery(e.target.value)}
                                placeholder="Search models..."
                                className="w-full bg-github-dark-hover border border-github-dark-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-github-green"
                                autoFocus
                              />
                            </div>
                            <div className="overflow-y-auto max-h-80">
                              {openRouterModels
                                .filter((model) => {
                                  if (!modelSearchQuery) return true;
                                  const query = modelSearchQuery.toLowerCase();
                                  return (
                                    model.name.toLowerCase().includes(query) ||
                                    model.id.toLowerCase().includes(query) ||
                                    (model.description &&
                                      model.description.toLowerCase().includes(query))
                                  );
                                })
                                .map((model) => (
                                  <button
                                    key={model.id}
                                    type="button"
                                    onClick={() => {
                                      setApiSettings({
                                        ...apiSettings,
                                        openRouterModel: model.id,
                                      });
                                      setIsModelDropdownOpen(false);
                                      setModelSearchQuery("");
                                    }}
                                    className={`w-full text-left px-4 py-2 hover:bg-github-dark-hover transition-colors ${
                                      apiSettings.openRouterModel === model.id
                                        ? "bg-github-green/20 text-github-green"
                                        : "text-gray-300"
                                    }`}
                                  >
                                    <div className="font-medium">{model.name}</div>
                                    <div className="text-xs text-gray-400 mt-0.5">
                                      {model.id}
                                      {model.context_length &&
                                        ` • ${model.context_length.toLocaleString()} context`}
                                    </div>
                                    {model.description && (
                                      <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                                        {model.description}
                                      </div>
                                    )}
                                  </button>
                                ))}
                              {openRouterModels.filter((model) => {
                                if (!modelSearchQuery) return true;
                                const query = modelSearchQuery.toLowerCase();
                                return (
                                  model.name.toLowerCase().includes(query) ||
                                  model.id.toLowerCase().includes(query) ||
                                  (model.description &&
                                    model.description.toLowerCase().includes(query))
                                );
                              }).length === 0 && (
                                <div className="px-4 py-8 text-center text-gray-400">
                                  No models found matching &ldquo;{modelSearchQuery}&rdquo;
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Ollama API URL</label>
                    <input
                      type="text"
                      value={apiSettings.ollamaApiUrl || ""}
                      onChange={(e) =>
                        setApiSettings({ ...apiSettings, ollamaApiUrl: e.target.value })
                      }
                      placeholder="http://localhost:11434"
                      className="w-full bg-github-dark-hover border border-github-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-github-green"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Model</label>
                    <input
                      type="text"
                      value={apiSettings.ollamaModel || ""}
                      onChange={(e) =>
                        setApiSettings({ ...apiSettings, ollamaModel: e.target.value })
                      }
                      placeholder="llama3.2:3b"
                      className="w-full bg-github-dark-hover border border-github-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-github-green"
                    />
                  </div>
                </>
              )}
              </div>
            </div>
            <div className="flex-shrink-0 flex flex-wrap gap-2 pt-4 border-t border-github-dark-border mt-4">
              <button
                onClick={handleSaveApiSettings}
                disabled={savingApiSettings}
                className="px-3 sm:px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg text-xs sm:text-sm transition-colors disabled:opacity-60 disabled:cursor-wait"
              >
                {savingApiSettings ? "Saving..." : "Save Settings"}
              </button>
              <button
                onClick={handleCloseApiSettings}
                className="px-3 sm:px-4 py-2 bg-github-dark-hover hover:bg-github-dark-border text-white rounded-lg text-xs sm:text-sm transition-colors border border-github-dark-border"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>

        {/* Create/Edit Chatbot Modal */}
        <Modal
          isOpen={showCreateForm}
          onClose={handleCloseChatbotForm}
          title={editingChatbot ? "Edit Chatbot" : "Create New Chatbot"}
          size="lg"
        >
          {isDefaultLocked && (
            <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
              <p className="text-xs text-yellow-400 uppercase tracking-wide">
                Default chatbot is read-only
              </p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="flex-1 min-h-0 overflow-y-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
              <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-github-dark-hover border border-github-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-github-green disabled:opacity-60"
                  required
                  disabled={isDefaultLocked}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-github-dark-hover border border-github-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-github-green disabled:opacity-60"
                  required
                  disabled={isDefaultLocked}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">System Prompt</label>
                <textarea
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  className="w-full h-48 bg-github-dark-hover border border-github-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-github-green resize-none font-mono text-sm disabled:opacity-60"
                  required
                  disabled={isDefaultLocked}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Define the chatbot&rsquo;s personality, goals, and behavior
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Responses per conversation</label>
                <input
                  type="number"
                  min={RESPONSE_COUNT_MIN}
                  max={RESPONSE_COUNT_MAX}
                  value={formData.responseCountInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || /^[0-9]*$/.test(value)) {
                      setFormData({
                        ...formData,
                        responseCountInput: value,
                      });
                    }
                  }}
                  onBlur={() => {
                    const parsedValue = Number.parseInt(formData.responseCountInput, 10);
                    const clampedValue = clampResponseCount(
                      Number.isNaN(parsedValue) ? DEFAULT_RESPONSE_COUNT : parsedValue
                    );
                    setFormData((prev) => ({
                      ...prev,
                      responseCountInput: clampedValue.toString(),
                    }));
                  }}
                  className="w-full bg-github-dark-hover border border-github-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-github-green disabled:opacity-60"
                  required
                  disabled={isDefaultLocked}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Includes the AI&rsquo;s initial greeting and final wrap-up. Choose between {RESPONSE_COUNT_MIN} and {RESPONSE_COUNT_MAX} responses.
                </p>
              </div>
              </div>
            </div>
            <div className="flex-shrink-0 flex flex-wrap gap-2 pt-4 border-t border-github-dark-border mt-4">
              <button
                type="submit"
                disabled={isSaving || isDefaultLocked}
                className="px-3 sm:px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg text-xs sm:text-sm transition-colors disabled:opacity-60 disabled:cursor-wait"
              >
                {isDefaultLocked ? "Read Only" : isSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={handleCloseChatbotForm}
                className="px-3 sm:px-4 py-2 bg-github-dark-hover hover:bg-github-dark-border text-white rounded-lg text-xs sm:text-sm transition-colors border border-github-dark-border"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>

        <div className="space-y-3 sm:space-y-4">
          {loading ? (
            <>
              {Array.from({ length: 2 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </>
          ) : (
          chatbots.map((chatbot) => (
            <div
              key={chatbot.id}
              className="bg-github-dark border border-github-dark-border rounded-lg p-4 sm:p-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="text-lg sm:text-xl font-semibold">{chatbot.name}</h3>
                    {chatbot.isCurrent && (
                      <span className="px-2 py-1 bg-github-green/20 text-github-green text-xs rounded">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-sm sm:text-base text-gray-400 mb-2 sm:mb-3">{chatbot.description}</p>
                  <div className="bg-github-dark-hover rounded p-2 sm:p-3">
                    <p className="text-xs sm:text-sm text-gray-300 font-mono whitespace-pre-wrap break-words">
                      {(chatbot.systemPrompt ?? "").substring(0, 200)}
                      {(chatbot.systemPrompt ?? "").length > 200 && "..."}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 sm:mt-3">
                    Responses per conversation:{" "}
                    <span className="text-white font-semibold">
                      {chatbot.responseCount ?? DEFAULT_RESPONSE_COUNT}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 flex-shrink-0">
                  {!chatbot.isCurrent && (
                    <button
                      onClick={() => handleSetCurrent(chatbot)}
                      disabled={settingCurrentId === chatbot.id}
                      className="px-3 sm:px-4 py-1.5 sm:py-2 bg-github-green/20 hover:bg-github-green/30 text-github-green rounded-lg text-xs sm:text-sm transition-colors border border-github-green/40 disabled:opacity-60 disabled:cursor-wait"
                    >
                      {settingCurrentId === chatbot.id ? "Setting..." : "Set as current"}
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(chatbot)}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-github-dark-hover hover:bg-github-dark-border text-white rounded-lg text-xs sm:text-sm transition-colors border border-github-dark-border"
                  >
                    Edit
                  </button>
                  {chatbot.id !== "default" && (
                    <button
                      onClick={() => handleDelete(chatbot)}
                      className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs sm:text-sm transition-colors border border-red-600/30"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
          )}
        </div>
      </main>
    </div>
  );
}

