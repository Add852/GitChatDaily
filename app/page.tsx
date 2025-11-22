"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";

const sellingPoints = [
  {
    icon: "💬",
    title: "Conversational journaling",
    description: "Answer a handful of focused prompts—the AI turns your chat into narrative gold.",
  },
  {
    icon: "🌙",
    title: "Nightly wind-down ritual",
    description: "Talk to the bot before bed, unblock thoughts, and head into tomorrow lighter.",
  },
  {
    icon: "📡",
    title: "Signal your progress",
    description: "Every entry becomes a private GitHub commit that keeps your graph pulsing.",
  },
];

export default function Home() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  return (
    <div className="min-h-screen bg-github-dark">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
          <div className="space-y-4 sm:space-y-6">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-github-green font-semibold bg-github-green/10 px-3 py-1 rounded-full">
              Developer wellness platform
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
              Code your day. <span className="text-github-green">Commit your feelings.</span>
            </h1>
            <p className="text-base sm:text-lg text-gray-300">
              GitChat Journal pairs a personalized AI conversation with automated Markdown commits so
              you can reflect nightly, capture real emotions, and keep your GitHub graph glowing—
              without sacrificing mental health.
            </p>
            {status === "loading" ? (
              <div className="text-gray-400">Loading...</div>
            ) : (
              <div className="flex flex-wrap gap-3 sm:gap-4">
                <button
                  onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
                  className="px-6 sm:px-8 py-3 sm:py-4 bg-github-green hover:bg-github-green-hover text-white rounded-lg text-base sm:text-lg font-semibold transition-colors"
                >
                  Sign in with GitHub
                </button>
              </div>
            )}
            <p className="text-xs sm:text-sm text-gray-500">
              Be productive while protecting your headspace. No more empty journal streaks.
            </p>
          </div>

          <div className="bg-github-dark-hover border border-github-dark-border rounded-xl sm:rounded-2xl p-6 sm:p-8 shadow-2xl shadow-github-green/5">
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">What happens when you log a day?</h2>
            <ul className="space-y-3 sm:space-y-4 text-gray-300">
              <li className="flex items-start gap-2 sm:gap-3">
                <span className="text-xl sm:text-2xl flex-shrink-0">🤖</span>
                <div>
                  <p className="font-semibold text-white text-sm sm:text-base">Conversational journaling</p>
                  <p className="text-xs sm:text-sm">
                    A focused chatbot gathers highlights, blockers, and gratitude in under five
                    responses.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2 sm:gap-3">
                <span className="text-xl sm:text-2xl flex-shrink-0">📝</span>
                <div>
                  <p className="font-semibold text-white text-sm sm:text-base">Auto-generated entry</p>
                  <p className="text-xs sm:text-sm">
                    Mood, summary, and highlights are compiled instantly—ready for reflection.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2 sm:gap-3">
                <span className="text-xl sm:text-2xl flex-shrink-0">📈</span>
                <div>
                  <p className="font-semibold text-white text-sm sm:text-base">GitHub commit</p>
                  <p className="text-xs sm:text-sm">
                    Every entry becomes a private repo commit—proof of consistency on your graph.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <section id="benefits" className="mt-12 sm:mt-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {sellingPoints.map((point) => (
              <div
                key={point.title}
                className="bg-github-dark-hover border border-github-dark-border rounded-xl p-4 sm:p-6 space-y-2"
              >
                <div className="text-2xl sm:text-3xl">{point.icon}</div>
                <h3 className="text-lg sm:text-xl font-semibold">{point.title}</h3>
                <p className="text-xs sm:text-sm text-gray-400">{point.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

