# GitChat Journal

A GitHub-themed daily conversational chatbot journaling system that syncs your journal entries with GitHub commits.

## Features

- 🔐 GitHub OAuth authentication
- 💬 Conversational AI chatbot for journaling (supports Ollama, OpenRouter, or Gemini)
- 📝 Automated markdown journal entry summaries
- 🔄 GitHub commit sync for each journal entry
- 📊 GitHub-style contribution graph with mood colors
- 🎭 Customizable chatbots
- 😊 Mood tracking (1-5 scale with emojis)
- ✏️ Edit and overwrite journal entries
- ☁️ Cloud AI support via OpenRouter or Gemini (optional)
- 📱 Fully responsive design with mobile support

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

This project is ready for deployment on Vercel, Netlify, or any Node.js hosting service.

### Vercel Deployment (Recommended)

1. **Push your code to GitHub**

2. **Import project to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository

3. **Configure environment variables in Vercel:**
   - Go to Project Settings → Environment Variables
   - Add all required variables:
     - `GITHUB_CLIENT_ID`
     - `GITHUB_CLIENT_SECRET`
     - `NEXTAUTH_URL` (set to your Vercel domain, e.g., `https://your-app.vercel.app`)
     - `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`)
     - `OLLAMA_API_URL` (optional, only if using Ollama)

4. **Update GitHub OAuth App:**
   - Go to GitHub Settings → Developer settings → OAuth Apps
   - Update your OAuth app's callback URL to: `https://your-app.vercel.app/api/auth/callback/github`

5. **Deploy:**
   - Vercel will automatically deploy on every push to your main branch

**Production Checklist:**
- [ ] Update `NEXTAUTH_URL` to production domain
- [ ] Update GitHub OAuth callback URL
- [ ] Configure environment variables on hosting platform
- [ ] Set up AI provider (OpenRouter or Gemini recommended for production)
- [ ] Test authentication flow
- [ ] Verify GitHub repository creation

**Note:** For production, OpenRouter or Gemini is recommended over Ollama as they don't require infrastructure setup.

## License

MIT

## Developers

- **Anthony Dayrit** - [@Add852](https://github.com/Add852)
- **Keith Yamzon** - [@yammzzon](https://github.com/yammzzon)

