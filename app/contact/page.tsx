"use client";

import Image from "next/image";

const developers = [
  {
    name: "Anthony Dayrit",
    role: "Full Stack Developer",
    bio: "Passionate about building developer tools and creating meaningful experiences. Loves working with Next.js, TypeScript, and AI technologies.",
    github: "https://github.com/Add852",
    email: "xadd852x@gmail.com",
    avatar: "https://github.com/Add852.png",
    skills: ["Next.js", "TypeScript", "AI/ML", "Full Stack"],
  },
  {
    name: "Keith Yamzon",
    role: "Full Stack Developer",
    bio: "Passionate developer working on innovative projects. Enjoys building scalable applications and contributing to open source.",
    github: "https://github.com/yammzzon",
    email: "keithrussel.ricohermoso.yamzon@gmail.com",
    avatar: "https://github.com/yammzzon.png",
    skills: ["Next.js", "TypeScript", "Full Stack", "Open Source"],
  },
];

export default function ContactPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Meet the Developers</h1>
          <p className="text-gray-400 text-lg">
            Get in touch with the team behind GitChat Journal
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {developers.map((developer, index) => (
            <div
              key={index}
              className="bg-github-dark-hover border border-github-dark-border rounded-2xl p-8 hover:border-github-green transition-colors"
            >
              <div className="flex flex-col items-center text-center mb-6">
                <div className="relative w-24 h-24 mb-4">
                  <Image
                    src={developer.avatar}
                    alt={developer.name}
                    width={96}
                    height={96}
                    className="rounded-full border-2 border-github-dark-border object-cover"
                    onError={(e) => {
                      // Fallback to a default avatar if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.src =
                        "https://ui-avatars.com/api/?name=" +
                        encodeURIComponent(developer.name) +
                        "&background=238636&color=fff&size=128";
                    }}
                    unoptimized
                  />
                </div>
                <h2 className="text-2xl font-semibold mb-1">{developer.name}</h2>
                <p className="text-github-green text-sm font-medium mb-4">
                  {developer.role}
                </p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {developer.bio}
                </p>
              </div>

              <div className="border-t border-github-dark-border pt-6 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">
                    Skills
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {developer.skills.map((skill, skillIndex) => (
                      <span
                        key={skillIndex}
                        className="px-3 py-1 bg-github-dark border border-github-dark-border rounded-full text-xs text-gray-300"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <a
                    href={developer.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-4 py-2 bg-github-dark border border-github-dark-border rounded-lg text-center text-sm font-medium text-gray-300 hover:bg-github-green hover:text-white hover:border-github-green transition-colors"
                  >
                    GitHub
                  </a>
                  <a
                    href={`mailto:${developer.email}`}
                    className="flex-1 px-4 py-2 bg-github-dark border border-github-dark-border rounded-lg text-center text-sm font-medium text-gray-300 hover:bg-github-green hover:text-white hover:border-github-green transition-colors"
                  >
                    Email
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <div className="bg-github-dark-hover border border-github-dark-border rounded-xl p-6 max-w-2xl mx-auto">
            <h3 className="text-lg font-semibold mb-2">Project Repository</h3>
            <p className="text-gray-400 text-sm mb-4">
              Check out the source code and contribute to GitChat Daily
            </p>
            <a
              href="https://github.com/Add852/GitChatDaily"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg font-medium transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              View on GitHub
            </a>
          </div>
        </div>
    </main>
  );
}

