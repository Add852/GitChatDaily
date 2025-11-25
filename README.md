# GitChat Journal

A GitHub-themed daily conversational chatbot journaling system that syncs your journal entries with GitHub commits.

## Features

- 🔐 **GitHub OAuth** - Seamless authentication with GitHub
- 💬 **AI-Powered Journaling** - Conversational chatbot (Ollama, OpenRouter, or Gemini)
- 📝 **Smart Summaries** - AI-generated markdown journal entries with highlights
- 🔄 **GitHub Sync** - Automatic commits to your private `gitchat-journal` repository
- 📊 **Contribution Graph** - GitHub-style activity visualization with mood colors
- 🎭 **Custom Chatbots** - Create personalized AI companions with unique personalities
- 😊 **Mood Tracking** - 1-5 scale with emoji indicators
- ✏️ **Entry Management** - View, edit, and redo journal entries
- 📱 **PWA Support** - Installable as a mobile/desktop app
- ⚡ **Offline-First** - IndexedDB caching for instant loading
- 🎨 **Dark Theme** - Beautiful GitHub-inspired dark UI

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- GitHub account (for OAuth)
- AI Provider (choose one):
  - **Ollama** (local, free) - [Download](https://ollama.ai)
  - **OpenRouter** (cloud) - [Sign up](https://openrouter.ai)
  - **Gemini** (cloud, Google) - [Get API key](https://makersuite.google.com/app/apikey)

### Installation

1. **Clone and install:**
   ```bash
   git clone <repository-url>
   cd GitChatDaily
   npm install
   ```

2. **Set up environment variables:**
   
   Create a `.env.local` file in the root directory with the following variables:
   ```env
   GITHUB_CLIENT_ID=your_github_client_id_here
   GITHUB_CLIENT_SECRET=your_github_client_secret_here
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=generate_a_random_secret_here
   OLLAMA_API_URL=http://localhost:11434  # Optional, only if using Ollama
   ```
   
   See [SETUP.md](./SETUP.md) for detailed instructions.

3. **Run development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

For detailed setup instructions, see [SETUP.md](./SETUP.md).

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── api/               # API routes (auth, journal, AI providers)
│   ├── chatbots/          # Chatbot management page
│   ├── contact/           # Developer contact page
│   ├── dashboard/         # Dashboard with contribution graph
│   ├── entries/           # Journal entries listing & detail
│   ├── journal/           # New entry creation (chat interface)
│   └── manifest.ts        # PWA manifest configuration
├── components/            # React components
│   ├── ChatbotInterface/  # Main chat UI component
│   ├── ContributionGraph/ # GitHub-style activity graph
│   └── ...                # Layout, modals, skeletons
├── hooks/                 # Custom React hooks
├── lib/                   # Core utilities
│   ├── cache/             # IndexedDB caching & sync
│   ├── api-provider.ts    # AI provider abstraction
│   └── github-journal.ts  # GitHub API helpers
├── public/                # Static assets & PWA icons
└── types/                 # TypeScript type definitions
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - TypeScript type checking

## Deployment

This project is production-ready and optimized for deployment on Vercel, Netlify, or any Node.js hosting platform.

### Vercel Deployment (Recommended)

1. **Push your code to GitHub**

2. **Import to Vercel:**
   - Go to [vercel.com](https://vercel.com) and click "Add New Project"
   - Import your GitHub repository
   - Vercel auto-detects Next.js configuration

3. **Configure Environment Variables:**
   Navigate to Project Settings → Environment Variables and add:

   | Variable | Value | Required |
   |----------|-------|----------|
   | `GITHUB_CLIENT_ID` | Your GitHub OAuth App Client ID | ✅ |
   | `GITHUB_CLIENT_SECRET` | Your GitHub OAuth App Secret | ✅ |
   | `NEXTAUTH_URL` | Your production URL (e.g., `https://your-app.vercel.app`) | ✅ |
   | `NEXTAUTH_SECRET` | Generate with `openssl rand -base64 32` | ✅ |

4. **Update GitHub OAuth App:**
   - Go to GitHub Settings → Developer settings → OAuth Apps
   - Update callback URL to: `https://your-app.vercel.app/api/auth/callback/github`

5. **Deploy:**
   - Vercel auto-deploys on every push to main branch
   - First deployment may take 2-3 minutes

### Production Checklist

- [ ] Environment variables configured on hosting platform
- [ ] `NEXTAUTH_URL` set to production domain
- [ ] GitHub OAuth callback URL updated
- [ ] AI provider configured (OpenRouter or Gemini recommended)
- [ ] Test authentication flow end-to-end
- [ ] Verify journal entry creation and GitHub sync
- [ ] Test on mobile devices (PWA installation)

### AI Provider Recommendations

| Provider | Best For | Setup |
|----------|----------|-------|
| **Gemini** | Production (free tier available) | API key from [Google AI Studio](https://makersuite.google.com/app/apikey) |
| **OpenRouter** | Production (pay-per-use) | API key from [openrouter.ai](https://openrouter.ai) |
| **Ollama** | Local development only | Not suitable for cloud deployments |

> **Note:** Ollama requires a local server and is not compatible with serverless platforms like Vercel.

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) with App Router
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Authentication:** [NextAuth.js](https://next-auth.js.org/) with GitHub OAuth
- **Storage:** GitHub API + IndexedDB (offline-first caching)
- **AI Providers:** Ollama, OpenRouter, Google Gemini
- **Deployment:** Optimized for Vercel

## License

MIT License - see [LICENSE](LICENSE) for details.

## Developers

Built with 💚 by:

- **Anthony Dayrit** - [@Add852](https://github.com/Add852)
- **Keith Yamzon** - [@yammzzon](https://github.com/yammzzon)

---

*Submitted for HackNode 2025*

