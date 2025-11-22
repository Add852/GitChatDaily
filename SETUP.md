# GitChat Journal - Setup Guide

## Prerequisites

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **AI Provider (choose one):**
   - **Ollama** - [Download](https://ollama.ai) (Local, free)
   - **OpenRouter** - [Sign up](https://openrouter.ai) (Cloud, requires API key)
3. **GitHub Account** - For OAuth authentication

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up AI Provider

Choose one of the following options:

#### Option A: Ollama (Local, Recommended for Development)

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull the llama3.2:3b model:
```bash
ollama pull llama3.2:3b
```
3. Verify Ollama is running:
```bash
ollama list
```

Ollama should be running on `http://localhost:11434` by default.

#### Option B: OpenRouter (Cloud)

1. Create an account at [openrouter.ai](https://openrouter.ai)
2. Navigate to [openrouter.ai/keys](https://openrouter.ai/keys) and generate an API key
3. Add credits to your account (required for API usage)
4. After completing the app setup, go to the **Chatbots** page in the app to configure OpenRouter:
   - Select "OpenRouter (Cloud)" as your provider
   - Enter your API key
   - Choose a model from the available options

**Note:** You can switch between Ollama and OpenRouter anytime in the app settings without restarting the server.

### 3. Create GitHub OAuth App

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Click "New OAuth App"
3. Fill in the details:
   - **Application name**: GitChat Journal
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Click "Register application"
5. Copy the **Client ID** and generate a **Client Secret**

### 4. Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

2. Edit `.env.local` and add your values:
```env
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_a_random_secret_here
OLLAMA_API_URL=http://localhost:11434
```

**Note:** `OLLAMA_API_URL` is optional and only needed if using Ollama. If you're using OpenRouter, you can omit this variable.

3. Generate a NextAuth secret:
```bash
openssl rand -base64 32
```
Copy the output to `NEXTAUTH_SECRET` in `.env.local`.

### 5. Run the Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## Features

### ✅ Implemented Features

- **GitHub OAuth Authentication** - Seamless login with GitHub
- **Conversational AI Chatbot** - Supports Ollama (local) or OpenRouter (cloud)
- **Journal Entry System** - Automated markdown summaries
- **GitHub Commit Sync** - Each entry creates a commit in a private repository
- **Contribution Graph** - GitHub-style activity visualization with mood colors
- **Mood Tracking** - 1-5 scale with emoji indicators
- **Chatbots** - Customizable AI personalities
- **Entry Management** - View, edit, and redo journal entries
- **API Provider Selection** - Switch between Ollama and OpenRouter in settings
- **Responsive Design** - Works on all devices

## Usage

1. **Sign In**: Click "Sign in with GitHub" on the homepage
2. **Configure API Provider**: Go to "Chatbots" page to set up Ollama or OpenRouter
3. **Create Entry**: Navigate to "New Entry" and start a conversation
4. **View Entries**: Browse all entries or click on the contribution graph
5. **Edit Entries**: Click on any entry to view, edit, or redo the conversation
6. **Customize Chatbots**: Create custom chatbot personalities in the Chatbots page

## Troubleshooting

### AI Provider Connection Issues

#### Ollama Issues:
- Ensure Ollama is running: `ollama serve`
- Check if llama3.2:3b model is installed: `ollama list`
- Verify the API URL in `.env.local` (default: http://localhost:11434)
- Check firewall settings if connection fails

#### OpenRouter Issues:
- Verify your API key is correct (should start with `sk-or-v1-`)
- Ensure you have credits in your OpenRouter account
- Check that the selected model is available
- Verify API key permissions at [openrouter.ai/keys](https://openrouter.ai/keys)

### GitHub OAuth Issues

- Verify callback URL matches exactly: `http://localhost:3000/api/auth/callback/github`
- Check that Client ID and Secret are correct
- Ensure the OAuth app is not suspended

### Build Issues

**Windows:**
- Stop any running Node processes
- Delete `.next` folder: `Remove-Item -Recurse -Force .next`
- Reinstall dependencies: `Remove-Item -Recurse -Force node_modules; npm install`

**macOS/Linux:**
- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`

**General:**
- Check Node.js version: `node --version` (should be 18+)
- Clear build cache: Delete `tsconfig.tsbuildinfo` if present (auto-generated)

## Production Deployment

For production deployment:

1. Update `NEXTAUTH_URL` to your production domain
2. Update GitHub OAuth callback URL to production domain
3. Set up a proper database (currently using in-memory storage)
4. Configure environment variables on your hosting platform
5. **AI Provider Options:**
   - **Ollama**: Ensure Ollama is accessible from your production environment (consider Docker)
   - **OpenRouter**: Recommended for production - no infrastructure needed, just configure API key
6. Set up proper error monitoring and logging

## Notes

- Journal entries and chatbot profiles are stored in GitHub repositories (persistent storage)
- The GitHub repository `gitchat-journal` is created automatically in your account
- In-memory storage (`lib/storage.ts`) is used as a fallback cache only
- All data persists across server restarts via GitHub storage

## Production Deployment

### Recommended Setup

1. **Use OpenRouter for AI** - No infrastructure needed, just configure API key
2. **Environment Variables** - Set all required variables on your hosting platform
3. **GitHub OAuth** - Update callback URL to your production domain
4. **NextAuth Secret** - Use a strong, randomly generated secret

### Platform-Specific Notes

**Vercel:**
- Add environment variables in project settings
- NextAuth works out of the box
- No additional configuration needed

**Other Platforms:**
- Ensure Node.js 18+ is available
- Set `NEXTAUTH_URL` to your production domain
- Configure GitHub OAuth callback URL

