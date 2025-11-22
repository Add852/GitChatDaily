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
  const errorMessage = typeof error === "string" ? error : error?.message || "";
  const errorLower = errorMessage.toLowerCase();

  // Network errors
  if (error.name === "AbortError" || errorLower.includes("timeout") || errorLower.includes("timed out")) {
    return {
      message: `Connection timeout: Unable to reach ${provider === "openrouter" ? "OpenRouter" : "Ollama"} API`,
      details: provider === "ollama"
        ? "Ollama did not respond within 5 seconds. Make sure:\n1. Ollama is running on your computer\n2. The API URL is correct (default: http://localhost:11434)\n3. Ollama is not blocked by firewall or antivirus"
        : "The API did not respond within the expected time. Check your network connection and API URL.",
      type: "network",
    };
  }

  if (errorLower.includes("failed to fetch") || 
      errorLower.includes("econnrefused") || 
      errorLower.includes("connection refused") ||
      errorLower.includes("networkerror") ||
      errorLower.includes("network error") ||
      errorLower.includes("err_connection_refused") ||
      errorLower.includes("err_network_changed")) {
    return {
      message: `Cannot connect to ${provider === "openrouter" ? "OpenRouter" : "Ollama"} API`,
      details: provider === "ollama" 
        ? "Unable to reach Ollama. Please check:\n1. Is Ollama running? (Open Ollama app or run 'ollama serve')\n2. Is the API URL correct? (Check Settings → API Settings → Ollama API URL)\n3. Default URL: http://localhost:11434\n4. If using a different port, make sure it matches your Ollama configuration"
        : "Check your internet connection and try again.",
      type: "network",
    };
  }

  // CORS errors
  if (errorLower.includes("cors") || errorLower.includes("cross-origin")) {
    return {
      message: "CORS error: Cross-origin request blocked",
      details: provider === "ollama"
        ? "Ollama is blocking cross-origin requests. Make sure Ollama is configured to allow requests from this application."
        : "The API is blocking requests from this origin.",
      type: "network",
    };
  }

  // Try to parse JSON error responses
  if (typeof error === "string") {
    try {
      const parsed = JSON.parse(error);
      return parseJsonError(parsed, provider);
    } catch {
      // Not JSON, check if it's an HTTP status code string
      if (error.match(/^HTTP \d+$/)) {
        const statusCode = parseInt(error.match(/\d+/)?.[0] || "0", 10);
        return {
          message: `Ollama API returned error ${statusCode}`,
          details: statusCode === 404
            ? "The API endpoint was not found. Check that your Ollama API URL is correct."
            : statusCode === 500
            ? "Ollama server encountered an error. Try restarting Ollama."
            : `HTTP error ${statusCode}. Please check your Ollama configuration.`,
          type: "api",
        };
      }
      // Continue with string parsing below
    }
  }

  // Check for error objects with common structures
  if (error && typeof error === "object") {
    return parseJsonError(error, provider);
  }

  // Handle string errors that weren't JSON
  if (typeof error === "string" && error.trim()) {
    // If it looks like a technical error message, provide a user-friendly one
    if (errorLower.includes("getaddrinfo") || errorLower.includes("enotfound")) {
      return {
        message: "Cannot resolve hostname",
        details: provider === "ollama"
          ? "The Ollama API URL hostname cannot be resolved. Check:\n1. Is the URL correct? (e.g., http://localhost:11434)\n2. If using a hostname, make sure it's accessible\n3. Try using 'localhost' or '127.0.0.1' instead"
          : "The API hostname cannot be resolved. Check your internet connection.",
        type: "network",
      };
    }
    
    // Generic string error - provide context
    return {
      message: "Connection error",
      details: provider === "ollama"
        ? `Unable to connect to Ollama: ${error}\n\nMake sure Ollama is running and the API URL is correct.`
        : error,
      type: "network",
    };
  }

  // Default error message
  return {
    message: provider === "ollama" 
      ? "Unable to connect to Ollama"
      : "Unknown error occurred",
    details: context || (provider === "ollama"
      ? "Please check:\n1. Ollama is running\n2. API URL is correct (Settings → API Settings)\n3. No firewall is blocking the connection"
      : "Please check your API configuration and try again."),
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
    const ollamaError = typeof error.error === "string" ? error.error : error.error.message || JSON.stringify(error.error);
    const errorLower = ollamaError.toLowerCase();
    
    // Provide user-friendly messages for common Ollama errors
    if (errorLower.includes("model") && errorLower.includes("not found")) {
      return {
        message: "Model not found",
        details: "The specified model is not installed in Ollama.\n\nTo install it, run:\nollama pull <model-name>\n\nOr check your model name in Settings → API Settings.",
        type: "configuration",
      };
    }
    
    if (errorLower.includes("connection") || errorLower.includes("refused")) {
      return {
        message: "Cannot connect to Ollama",
        details: "Make sure Ollama is running and the API URL is correct.",
        type: "network",
      };
    }
    
    return {
      message: "Ollama API error",
      details: `${ollamaError}\n\nCheck that Ollama is running and configured correctly.`,
      type: "api",
    };
  }

  // Handle HTTP status codes
  if (error.status) {
    const status = error.status;
    if (status === 404) {
      return {
        message: "API endpoint not found",
        details: provider === "ollama"
          ? "The Ollama API endpoint was not found. Check that:\n1. Your API URL is correct\n2. Ollama is running\n3. The URL includes the correct port (default: 11434)"
          : "The API endpoint was not found. Check your API configuration.",
        type: "configuration",
      };
    }
    if (status === 500) {
      return {
        message: "Server error",
        details: provider === "ollama"
          ? "Ollama server encountered an error. Try:\n1. Restarting Ollama\n2. Checking Ollama logs\n3. Verifying your model is installed correctly"
          : "The API server encountered an error. Please try again later.",
        type: "api",
      };
    }
  }

  // Generic error message - avoid showing raw JSON
  const errorMsg = error.message || "API error occurred";
  return {
    message: errorMsg,
    details: provider === "ollama"
      ? "Please check your Ollama configuration and ensure Ollama is running."
      : "Please check your API configuration and try again.",
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
      let errorData: any = { status: response.status };
      try {
        const errorText = await response.text();
        try {
          errorData = { ...JSON.parse(errorText), status: response.status };
        } catch {
          // Not JSON, treat as plain text
          errorData = { message: errorText, status: response.status };
        }
      } catch {
        errorData = { message: `HTTP ${response.status}`, status: response.status };
      }

      const parsed = parseError(errorData, "ollama");
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

