import { Octokit } from "@octokit/rest";
import { ChatbotProfile } from "@/types";

const REPO_NAME = "gitchat-journal";
const CURRENT_PROFILE_PATH = "profiles/current.json";

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

export async function getProfilesFromGitHub(accessToken: string): Promise<ChatbotProfile[]> {
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.users.getAuthenticated();
  const username = user.login;
  const repoName = REPO_NAME;

  try {
    const { data } = await octokit.repos.getContent({
      owner: username,
      repo: repoName,
      path: "profiles",
    });

    if (Array.isArray(data)) {
      const profiles: ChatbotProfile[] = [];
      
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
              const profile = JSON.parse(content) as ChatbotProfile;
              if (profile?.id && profile?.name && profile?.systemPrompt) {
                profiles.push(profile);
              }
            }
          } catch (e) {
            console.error(`Error reading profile ${item.name}:`, e);
          }
        }
      }
      
      return profiles;
    }
  } catch (error: any) {
    if (error.status === 404) {
      return [];
    }
    throw error;
  }

  return [];
}

export async function getProfileFromGitHub(accessToken: string, profileId: string): Promise<ChatbotProfile | null> {
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.users.getAuthenticated();
  const username = user.login;
  const repoName = "gitchat-journal";

  try {
    const { data: fileData } = await octokit.repos.getContent({
      owner: username,
      repo: repoName,
      path: `profiles/${profileId}.json`,
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

export async function saveProfileToGitHub(accessToken: string, profile: ChatbotProfile): Promise<void> {
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.users.getAuthenticated();
  const username = user.login;
  const repoName = REPO_NAME;
  const fileName = `profiles/${profile.id}.json`;

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
  const content = JSON.stringify(profile, null, 2);
  const contentBase64 = Buffer.from(content).toString("base64");

  await octokit.repos.createOrUpdateFileContents({
    owner: username,
    repo: repoName,
    path: fileName,
    message: `Save chatbot profile: ${profile.name}`,
    content: contentBase64,
    sha: sha,
  });
}

export async function deleteProfileFromGitHub(accessToken: string, profileId: string): Promise<void> {
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.users.getAuthenticated();
  const username = user.login;
  const repoName = REPO_NAME;
  const fileName = `profiles/${profileId}.json`;

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
      message: `Delete chatbot profile: ${profileId}`,
      sha: sha,
    });
  }
}

export async function getCurrentProfileIdFromGitHub(accessToken: string): Promise<string | null> {
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.users.getAuthenticated();
  const username = user.login;

  try {
    const { data } = await octokit.repos.getContent({
      owner: username,
      repo: REPO_NAME,
      path: CURRENT_PROFILE_PATH,
    });

    if ("content" in data) {
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      const parsed = JSON.parse(content) as { profileId?: string; currentProfileId?: string };
      return parsed.profileId || parsed.currentProfileId || null;
    }
  } catch (error: any) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }

  return null;
}

export async function saveCurrentProfileIdToGitHub(accessToken: string, profileId: string): Promise<void> {
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.users.getAuthenticated();
  const username = user.login;

  await ensureRepoExists(octokit, username);

  let sha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({
      owner: username,
      repo: REPO_NAME,
      path: CURRENT_PROFILE_PATH,
    });
    if ("sha" in data) {
      sha = data.sha;
    }
  } catch (error: any) {
    if (error.status !== 404) {
      throw error;
    }
  }

  const content = JSON.stringify({ profileId }, null, 2);
  const contentBase64 = Buffer.from(content).toString("base64");

  await octokit.repos.createOrUpdateFileContents({
    owner: username,
    repo: REPO_NAME,
    path: CURRENT_PROFILE_PATH,
    message: `Set current chatbot profile to ${profileId}`,
    content: contentBase64,
    sha,
  });
}

