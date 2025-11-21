import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { ApiStatus, UserApiSettings } from "@/types";
import { getUserApiSettingsFromGitHub } from "@/app/api/github/user-settings-helpers";

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434";

interface ParsedError {
  message: string;
  details?: string;
  type: "network" | "authentication" | "configuration" | "api" | "unknown";
}

function parseError(error: any, provider: "ollama" | "openrouter", context?: string): ParsedError {
  // Network errors
  if (error.name === "AbortError" || error.message?.includes("timeout")) {
    return {
      message: `Connection timeout: Unable to reach ${provider === "openrouter" ? "OpenRouter" : "Ollama"} API`,
      details: "The API did not respond within the expected time. Check your network connection and API URL.",
      type: "network",
    };
  }

  if (error.message?.includes("Failed to fetch") || error.message?.includes("ECONNREFUSED")) {
    return {
      message: `Connection failed: Cannot connect to ${provider === "openrouter" ? "OpenRouter" : "Ollama"} API`,
      details: provider === "ollama" 
        ? "Make sure Ollama is running and the API URL is correct."
        : "Check your internet connection and try again.",
      type: "network",
    };
  }

  // Try to parse JSON error responses
  if (typeof error === "string") {
    try {
      const parsed = JSON.parse(error);
      return parseJsonError(parsed, provider);
    } catch {
      // Not JSON, continue with string parsing
    }
  }

  // Check for error objects with common structures
  if (error && typeof error === "object") {
    return parseJsonError(error, provider);
  }

  // Default error message
  return {
    message: error?.message || "Unknown error occurred",
    details: context || "Please check your API configuration and try again.",
    type: "unknown",
  };
}

function parseJsonError(error: any, provider: "ollama" | "openrouter"): ParsedError {
  // OpenRouter error format
  if (error.error) {
    const errorObj = typeof error.error === "string" ? { message: error.error } : error.error;
    const errorMessage = errorObj.message?.toLowerCase() || "";
    
    // Check for authentication errors - be more specific to avoid false positives
    const isAuthError = 
      error.status === 401 && (
        errorMessage.includes("invalid api key") ||
        errorMessage.includes("user not found") ||
        errorMessage.includes("unauthorized") ||
        errorMessage.includes("authentication failed") ||
        errorMessage.includes("invalid key") ||
        errorObj.code === "invalid_api_key" ||
        errorObj.code === "authentication_error"
      );
    
    if (isAuthError) {
      return {
        message: "Authentication failed: Invalid API key or User Not Found",
        details: "Your OpenRouter API key is invalid, expired, or doesn't exist. Please:\n1. Check your API key at https://openrouter.ai/keys\n2. Ensure the key starts with 'sk-or-v1-'\n3. Copy the key exactly without extra spaces\n4. Create a new key if needed\n5. Verify the key hasn't been revoked",
        type: "authentication",
      };
    }

    // Check for insufficient credits
    if (error.status === 402 || errorMessage.includes("insufficient credits") || errorMessage.includes("payment required")) {
      return {
        message: "Insufficient credits: Account balance too low",
        details: "Your OpenRouter account doesn't have enough credits. Please add credits to continue.",
        type: "api",
      };
    }

    // Check for model not found or access issues
    if (error.status === 404 || errorMessage.includes("model not found") || errorMessage.includes("not found")) {
      const modelName = error.model || errorObj.model || "unknown";
      return {
        message: "Model not found or inaccessible",
        details: `The model "${modelName}" is not available or you don't have access to it.\n\nPossible reasons:\n1. Model name is incorrect\n2. Model requires special access/permissions\n3. Model has been deprecated\n\nPlease select a different model from the dropdown.`,
        type: "configuration",
      };
    }

    // Check for rate limiting
    if (error.status === 429 || errorMessage.includes("rate limit") || errorMessage.includes("too many requests")) {
      return {
        message: "Rate limit exceeded",
        details: "You've made too many requests. Please wait a moment and try again.",
        type: "api",
      };
    }

    return {
      message: errorObj.message || "API error occurred",
      details: errorObj.details || `Error code: ${errorObj.code || "unknown"}`,
      type: "api",
    };
  }

  // Ollama error format
  if (error.error) {
    return {
      message: `Ollama API error: ${error.error}`,
      details: "Check that Ollama is running and the model name is correct.",
      type: "api",
    };
  }

  // Generic error message
  return {
    message: error.message || "API error occurred",
    details: JSON.stringify(error, null, 2).substring(0, 200),
    type: "api",
  };
}

function formatErrorForDisplay(parsed: ParsedError): string {
  let formatted = parsed.message;
  
  if (parsed.details) {
    formatted += `\n\n${parsed.details}`;
  }

  return formatted;
}

async function checkOllamaStatus(apiUrl: string, model: string): Promise<ApiStatus> {
  try {
    const response = await fetch(`${apiUrl}/api/tags`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      let errorText = "";
      try {
        errorText = await response.text();
      } catch {
        errorText = `HTTP ${response.status}`;
      }

      const parsed = parseError(errorText, "ollama", `Ollama API returned status ${response.status}`);
      return {
        available: false,
        provider: "ollama",
        error: formatErrorForDisplay(parsed),
        lastChecked: new Date().toISOString(),
      };
    }

    const data = await response.json();
    const models = data.models || [];
    const modelExists = models.some((m: any) => m.name === model);

    if (!modelExists) {
      const availableModels = models.map((m: any) => m.name).join(", ");
      return {
        available: false,
        provider: "ollama",
        error: formatErrorForDisplay({
          message: `Model "${model}" not found`,
          details: availableModels 
            ? `Available models: ${availableModels}\n\nTo install the model, run: ollama pull ${model}`
            : "No models are currently installed. Install a model using: ollama pull <model-name>",
          type: "configuration",
        }),
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      available: true,
      provider: "ollama",
      lastChecked: new Date().toISOString(),
    };
  } catch (error: any) {
    const parsed = parseError(error, "ollama", "Failed to connect to Ollama API");
    return {
      available: false,
      provider: "ollama",
      error: formatErrorForDisplay(parsed),
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkOpenRouterStatus(apiKey: string, model: string): Promise<ApiStatus> {
  try {
    // First, validate API key format
    if (!apiKey || !apiKey.trim()) {
      return {
        available: false,
        provider: "openrouter",
        error: formatErrorForDisplay({
          message: "API key is missing",
          details: "Please enter your OpenRouter API key in settings.",
          type: "configuration",
        }),
        lastChecked: new Date().toISOString(),
      };
    }

    // Check if API key has correct format
    if (!apiKey.startsWith("sk-or-v1-")) {
      return {
        available: false,
        provider: "openrouter",
        error: formatErrorForDisplay({
          message: "Invalid API key format",
          details: "OpenRouter API keys should start with 'sk-or-v1-'. Please check your API key format.",
          type: "configuration",
        }),
        lastChecked: new Date().toISOString(),
      };
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "test" }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      let errorData: any = {};
      try {
        const errorText = await response.text();
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
      } catch {
        errorData = { message: `HTTP ${response.status}` };
      }

      // Add status code to error data
      errorData.status = response.status;
      errorData.model = model;

      // For 401 errors, be more careful - check if it's actually an auth error
      // Sometimes 401 can be returned for other reasons (model access, rate limits, etc.)
      if (response.status === 401) {
        const errorMessage = (errorData.error?.message || errorData.message || "").toLowerCase();
        // Only treat as auth error if message clearly indicates authentication issue
        if (!errorMessage.includes("user not found") && 
            !errorMessage.includes("invalid api key") &&
            !errorMessage.includes("unauthorized") &&
            !errorMessage.includes("authentication")) {
          // Might be a model access issue or other problem, not necessarily auth
          const parsed = parseError(errorData, "openrouter", `OpenRouter API returned status ${response.status}`);
          return {
            available: false,
            provider: "openrouter",
            error: formatErrorForDisplay({
              message: `API returned 401 error`,
              details: `This might indicate:\n1. Authentication issue (check your API key)\n2. Model access restrictions\n3. Rate limiting\n\nError details: ${errorData.error?.message || errorData.message || "Unknown error"}\n\nTry checking your API key or selecting a different model.`,
              type: "api",
            }),
            lastChecked: new Date().toISOString(),
          };
        }
      }

      const parsed = parseError(errorData, "openrouter", `OpenRouter API returned status ${response.status}`);
      return {
        available: false,
        provider: "openrouter",
        error: formatErrorForDisplay(parsed),
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      available: true,
      provider: "openrouter",
      lastChecked: new Date().toISOString(),
    };
  } catch (error: any) {
    const parsed = parseError(error, "openrouter", "Failed to connect to OpenRouter API");
    return {
      available: false,
      provider: "openrouter",
      error: formatErrorForDisplay(parsed),
      lastChecked: new Date().toISOString(),
    };
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let settings: UserApiSettings | null = null;

    // Try GitHub first
    if (session.user.accessToken) {
      try {
        settings = await getUserApiSettingsFromGitHub(session.user.accessToken);
      } catch (error) {
        console.error("Error fetching settings from GitHub:", error);
      }
    }

    // Default settings if none found
    if (!settings) {
      settings = {
        provider: "ollama",
        ollamaApiUrl: OLLAMA_API_URL,
        ollamaModel: "llama3.2:3b",
      };
    }

    let status: ApiStatus;

    if (settings.provider === "openrouter") {
      if (!settings.openRouterApiKey || !settings.openRouterModel) {
        status = {
          available: false,
          provider: "openrouter",
          error: "OpenRouter API key or model not configured",
          lastChecked: new Date().toISOString(),
        };
      } else {
        status = await checkOpenRouterStatus(
          settings.openRouterApiKey,
          settings.openRouterModel
        );
      }
    } else {
      // Ollama
      const apiUrl = settings.ollamaApiUrl || OLLAMA_API_URL;
      const model = settings.ollamaModel || "llama3.2:3b";
      status = await checkOllamaStatus(apiUrl, model);
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error("Error checking API status:", error);
    return NextResponse.json(
      {
        available: false,
        provider: "ollama",
        error: "Failed to check API status",
        lastChecked: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

