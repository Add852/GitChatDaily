# GitChat Journal - Setup Guide

## Prerequisites

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **Ollama** - [Download](https://ollama.ai)
3. **GitHub Account** - For OAuth authentication

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Ollama

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull the phi3.5 model:
```bash
ollama pull phi3.5
```
3. Verify Ollama is running:
```bash
ollama list
```

Ollama should be running on `http://localhost:11434` by default.

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
- **Conversational AI Chatbot** - Powered by Ollama (phi3.5)
- **Journal Entry System** - Automated markdown summaries
- **GitHub Commit Sync** - Each entry creates a commit in a private repository
- **Contribution Graph** - GitHub-style activity visualization with mood colors
- **Mood Tracking** - 1-5 scale with emoji indicators
- **Chatbot Profiles** - Customizable AI personalities
- **Entry Management** - View, edit, and redo journal entries
- **Responsive Design** - Works on all devices

## Usage

1. **Sign In**: Click "Sign in with GitHub" on the homepage
2. **Create Entry**: Navigate to "New Entry" and start a conversation
3. **View Entries**: Browse all entries or click on the contribution graph
4. **Edit Entries**: Click on any entry to view, edit, or redo the conversation
5. **Customize Profiles**: Go to "Profiles" to create custom chatbot personalities

## Troubleshooting

### Ollama Connection Issues

- Ensure Ollama is running: `ollama serve`
- Check if phi3.5 model is installed: `ollama list`
- Verify the API URL in `.env.local`

### GitHub OAuth Issues

- Verify callback URL matches exactly: `http://localhost:3000/api/auth/callback/github`
- Check that Client ID and Secret are correct
- Ensure the OAuth app is not suspended

### Build Issues

- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (should be 18+)

## Production Deployment

For production deployment:

1. Update `NEXTAUTH_URL` to your production domain
2. Update GitHub OAuth callback URL to production domain
3. Set up a proper database (currently using in-memory storage)
4. Configure environment variables on your hosting platform
5. Ensure Ollama is accessible from your production environment

## Notes

- Journal entries are currently stored in-memory (will be lost on server restart)
- For production, replace `lib/storage.ts` with a proper database solution
- The GitHub repository is created automatically as `gitchat-journal` in your account

