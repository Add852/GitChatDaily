import { Octokit } from "@octokit/rest";
import { ChatbotProfile } from "@/types";

export async function getProfilesFromGitHub(accessToken: string): Promise<ChatbotProfile[]> {
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.users.getAuthenticated();
  const username = user.login;
  const repoName = "gitchat-journal";

  try {
    const { data } = await octokit.repos.getContent({
      owner: username,
      repo: repoName,
      path: "profiles",
    });

    if (Array.isArray(data)) {
      const profiles: ChatbotProfile[] = [];
      
      for (const item of data) {
        if (item.type === "file" && item.name.endsWith(".json")) {
          try {
            const { data: fileData } = await octokit.repos.getContent({
              owner: username,
              repo: repoName,
              path: item.path,
            });
            
            if ("content" in fileData) {
              const content = Buffer.from(fileData.content, "base64").toString("utf-8");
              const profile = JSON.parse(content) as ChatbotProfile;
              profiles.push(profile);
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
  const repoName = "gitchat-journal";
  const fileName = `profiles/${profile.id}.json`;

  // Try to create repo if it doesn't exist
  try {
    await octokit.repos.get({ owner: username, repo: repoName });
  } catch (error: any) {
    if (error.status === 404) {
      await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        description: "GitChat Journal - Daily journal entries",
        private: true,
        auto_init: true,
      });
    }
  }

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
  const repoName = "gitchat-journal";
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

