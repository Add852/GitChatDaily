import { Octokit } from "@octokit/rest";
import { UserApiSettings } from "@/types";

const REPO_NAME = "gitchat-journal";
const SETTINGS_PATH = "settings/api.json";

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

export async function getUserApiSettingsFromGitHub(
  accessToken: string
): Promise<UserApiSettings | null> {
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.users.getAuthenticated();
  const username = user.login;

  try {
    const { data } = await octokit.repos.getContent({
      owner: username,
      repo: REPO_NAME,
      path: SETTINGS_PATH,
    });

    if ("content" in data) {
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      return JSON.parse(content) as UserApiSettings;
    }
  } catch (error: any) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }

  return null;
}

export async function saveUserApiSettingsToGitHub(
  accessToken: string,
  settings: UserApiSettings
): Promise<void> {
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.users.getAuthenticated();
  const username = user.login;

  await ensureRepoExists(octokit, username);

  let sha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({
      owner: username,
      repo: REPO_NAME,
      path: SETTINGS_PATH,
    });
    if ("sha" in data) {
      sha = data.sha;
    }
  } catch (error: any) {
    if (error.status !== 404) {
      throw error;
    }
  }

  const content = JSON.stringify(settings, null, 2);
  const contentBase64 = Buffer.from(content).toString("base64");

  await octokit.repos.createOrUpdateFileContents({
    owner: username,
    repo: REPO_NAME,
    path: SETTINGS_PATH,
    message: "Update API settings",
    content: contentBase64,
    sha,
  });
}

