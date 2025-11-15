# GitChat Journal

A GitHub-themed daily conversational chatbot journaling system that syncs your journal entries with GitHub commits.

## Features

- 🔐 GitHub OAuth authentication
- 💬 Conversational AI chatbot for journaling (powered by Ollama)
- 📝 Automated markdown journal entry summaries
- 🔄 GitHub commit sync for each journal entry
- 📊 GitHub-style contribution graph with mood colors
- 🎭 Customizable chatbot profiles
- 😊 Mood tracking (1-5 scale with emojis)
- ✏️ Edit and overwrite journal entries

## Getting Started

### Prerequisites

- Node.js 18+ 
- Ollama installed and running with llama3.2:3b model

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
```

3. Configure your environment variables:
- `GITHUB_CLIENT_ID` - Your GitHub OAuth App Client ID
- `GITHUB_CLIENT_SECRET` - Your GitHub OAuth App Client Secret
- `NEXTAUTH_URL` - Your application URL (e.g., http://localhost:3000)
- `NEXTAUTH_SECRET` - A random secret for NextAuth (generate with `openssl rand -base64 32`)
- `OLLAMA_API_URL` - Your Ollama API URL (default: http://localhost:11434)

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## GitHub OAuth Setup

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create a new OAuth App
3. Set Authorization callback URL to: `http://localhost:3000/api/auth/callback/github`
4. Copy the Client ID and Client Secret to your `.env.local` file

## Ollama Setup

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull the llama3.2:3b model:
```bash
ollama pull llama3.2:3b
```
3. Start Ollama (it should run on http://localhost:11434 by default)

## License

MIT

## Developers

- **Anthony Dayrit** - [@Add852](https://github.com/Add852)
- **Keith Yamzon** - [@yammzzon](https://github.com/yammzzon)

