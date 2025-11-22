# GitChat Journal

A GitHub-themed daily conversational chatbot journaling system that syncs your journal entries with GitHub commits.

## Features

- 🔐 GitHub OAuth authentication
- 💬 Conversational AI chatbot for journaling (supports Ollama or OpenRouter)
- 📝 Automated markdown journal entry summaries
- 🔄 GitHub commit sync for each journal entry
- 📊 GitHub-style contribution graph with mood colors
- 🎭 Customizable chatbots
- 😊 Mood tracking (1-5 scale with emojis)
- ✏️ Edit and overwrite journal entries
- ☁️ Cloud AI support via OpenRouter (optional)
- 📱 Fully responsive design with mobile support

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- GitHub account (for OAuth)
- AI Provider (choose one):
  - **Ollama** (local, free) - [Download](https://ollama.ai)
  - **OpenRouter** (cloud) - [Sign up](https://openrouter.ai)

### Installation

1. **Clone and install:**
   ```bash
   git clone <repository-url>
   cd GitChatDaily
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your configuration (see [SETUP.md](./SETUP.md) for details).

3. **Run development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

For detailed setup instructions, see [SETUP.md](./SETUP.md).

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── chatbots/          # Chatbots management page
│   ├── dashboard/        # Dashboard page
│   ├── entries/           # Journal entries pages
│   └── journal/           # New entry page
├── components/            # React components
├── lib/                   # Utility functions and helpers
└── types/                 # TypeScript type definitions
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - TypeScript type checking

## Deployment

This project is ready for deployment on platforms like Vercel, Netlify, or any Node.js hosting service.

**Production Checklist:**
- [ ] Update `NEXTAUTH_URL` to production domain
- [ ] Update GitHub OAuth callback URL
- [ ] Configure environment variables on hosting platform
- [ ] Set up AI provider (OpenRouter recommended for production)
- [ ] Test authentication flow
- [ ] Verify GitHub repository creation

**Note:** For production, OpenRouter is recommended over Ollama as it doesn't require infrastructure setup.

## License

MIT

## Developers

- **Anthony Dayrit** - [@Add852](https://github.com/Add852)
- **Keith Yamzon** - [@yammzzon](https://github.com/yammzzon)

