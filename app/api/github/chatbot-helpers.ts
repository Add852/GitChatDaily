import { Octokit } from "@octokit/rest";
import { ChatbotProfile } from "@/types";

const REPO_NAME = "gitchat-journal";
const CURRENT_CHATBOT_PATH = "chatbots/current.json";

async function ensureRepoExists(octokit: Octokit, owner: string) {
  try {
    await octokit.repos.get({ owner, repo: REPO_NAME });
  } catch (error: any) {
    if (error.status === 404) {
      await octokit.repos.createForAuthenticatedUser({
        name: REPO_NAME,
        description: "GitChat Journal - Daily journal entries",
        private: true,
        auto_init: true,
      });
    } else {
      throw error;
    }
  }
}

export async function getChatbotsFromGitHub(accessToken: string): Promise<ChatbotProfile[]> {
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.users.getAuthenticated();
  const username = user.login;
  const repoName = REPO_NAME;

  try {
    const { data } = await octokit.repos.getContent({
      owner: username,
      repo: repoName,
      path: "chatbots",
    });

    if (Array.isArray(data)) {
      const chatbots: ChatbotProfile[] = [];
      
      for (const item of data) {
        if (item.type === "file" && item.name.endsWith(".json") && item.name !== "current.json") {
          try {
            const { data: fileData } = await octokit.repos.getContent({
              owner: username,
              repo: repoName,
              path: item.path,
            });
            
            if ("content" in fileData) {
              const content = Buffer.from(fileData.content, "base64").toString("utf-8");
              const chatbot = JSON.parse(content) as ChatbotProfile;
              if (chatbot?.id && chatbot?.name && chatbot?.systemPrompt) {
                chatbots.push(chatbot);
              }
            }
          } catch (e) {
            console.error(`Error reading chatbot ${item.name}:`, e);
          }
        }
      }
      
      return chatbots;
    }
  } catch (error: any) {
    if (error.status === 404) {
      return [];
    }
    throw error;
  }

  return [];
}

export async function getChatbotFromGitHub(accessToken: string, chatbotId: string): Promise<ChatbotProfile | null> {
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.users.getAuthenticated();
  const username = user.login;
  const repoName = "gitchat-journal";

  try {
    const { data: fileData } = await octokit.repos.getContent({
      owner: username,
      repo: repoName,
      path: `chatbots/${chatbotId}.json`,
    });
    
    if ("content" in fileData) {
      const content = Buffer.from(fileData.content, "base64").toString("utf-8");
      return JSON.parse(content) as ChatbotProfile;
    }
  } catch (error: any) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }

  return null;
}

export async function saveChatbotToGitHub(accessToken: string, chatbot: ChatbotProfile): Promise<void> {
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.users.getAuthenticated();
  const username = user.login;
  const repoName = REPO_NAME;
  const fileName = `chatbots/${chatbot.id}.json`;

  // Try to create repo if it doesn't exist
  await ensureRepoExists(octokit, username);

  // Get file content if it exists
  let sha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({
      owner: username,
      repo: repoName,
      path: fileName,
    });
    if ("sha" in data) {
      sha = data.sha;
    }
  } catch (error: any) {
    // File doesn't exist, that's okay
  }

  // Create or update the file
  const content = JSON.stringify(chatbot, null, 2);
  const contentBase64 = Buffer.from(content).toString("base64");

  await octokit.repos.createOrUpdateFileContents({
    owner: username,
    repo: repoName,
    path: fileName,
    message: `Save chatbot: ${chatbot.name}`,
    content: contentBase64,
    sha: sha,
  });
}

export async function deleteChatbotFromGitHub(accessToken: string, chatbotId: string): Promise<void> {
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.users.getAuthenticated();
  const username = user.login;
  const repoName = REPO_NAME;
  const fileName = `chatbots/${chatbotId}.json`;

  // Get file content to get SHA
  let sha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({
      owner: username,
      repo: repoName,
      path: fileName,
    });
    if ("sha" in data) {
      sha = data.sha;
    }
  } catch (error: any) {
    if (error.status === 404) {
      // File doesn't exist, nothing to delete
      return;
    }
    throw error;
  }

  // Delete the file
  if (sha) {
    await octokit.repos.deleteFile({
      owner: username,
      repo: repoName,
      path: fileName,
      message: `Delete chatbot: ${chatbotId}`,
      sha: sha,
    });
  }
}

export async function getCurrentChatbotIdFromGitHub(accessToken: string): Promise<string | null> {
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.users.getAuthenticated();
  const username = user.login;

  try {
    const { data } = await octokit.repos.getContent({
      owner: username,
      repo: REPO_NAME,
      path: CURRENT_CHATBOT_PATH,
    });

    if ("content" in data) {
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      const parsed = JSON.parse(content) as { profileId?: string; currentProfileId?: string; chatbotId?: string; currentChatbotId?: string };
      return parsed.chatbotId || parsed.currentChatbotId || parsed.profileId || parsed.currentProfileId || null;
    }
  } catch (error: any) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }

  return null;
}

export async function saveCurrentChatbotIdToGitHub(accessToken: string, chatbotId: string): Promise<void> {
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.users.getAuthenticated();
  const username = user.login;

  await ensureRepoExists(octokit, username);

  let sha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({
      owner: username,
      repo: REPO_NAME,
      path: CURRENT_CHATBOT_PATH,
    });
    if ("sha" in data) {
      sha = data.sha;
    }
  } catch (error: any) {
    if (error.status !== 404) {
      throw error;
    }
  }

  const content = JSON.stringify({ chatbotId }, null, 2);
  const contentBase64 = Buffer.from(content).toString("base64");

  await octokit.repos.createOrUpdateFileContents({
    owner: username,
    repo: REPO_NAME,
    path: CURRENT_CHATBOT_PATH,
    message: `Set current chatbot to ${chatbotId}`,
    content: contentBase64,
    sha,
  });
}

