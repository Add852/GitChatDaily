"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { ChatbotProfile } from "@/types";
import { DEFAULT_CHATBOT_PROFILE } from "@/lib/constants";

export default function ProfilesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profiles, setProfiles] = useState<ChatbotProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ChatbotProfile | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    systemPrompt: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchProfiles();
    }
  }, [session]);

  const fetchProfiles = async () => {
    try {
      const response = await fetch("/api/chatbot-profiles");
      if (response.ok) {
        const data = await response.json();
        setProfiles(data);
      }
    } catch (error) {
      console.error("Error fetching profiles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const profile: ChatbotProfile = {
      id: editingProfile?.id || `profile-${Date.now()}`,
      name: formData.name,
      description: formData.description,
      systemPrompt: formData.systemPrompt,
      isCurrent: editingProfile?.isCurrent ?? false,
      createdAt: editingProfile?.createdAt || new Date().toISOString(),
    };

    try {
      const response = await fetch("/api/chatbot-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (response.ok) {
        await fetchProfiles();
        setShowCreateForm(false);
        setEditingProfile(null);
        setFormData({
          name: "",
          description: "",
          systemPrompt: "",
        });
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Failed to save profile. Please try again.");
    }
  };

  const handleEdit = (profile: ChatbotProfile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      description: profile.description,
      systemPrompt: profile.systemPrompt,
    });
    setShowCreateForm(true);
  };

  const handleSetCurrent = async (profile: ChatbotProfile) => {
    try {
      const response = await fetch("/api/chatbot-profiles/current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id }),
      });

      if (response.ok) {
        await fetchProfiles();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to set current profile");
      }
    } catch (error) {
      console.error("Error setting current profile:", error);
      alert("Failed to set current profile. Please try again.");
    }
  };

  const handleDelete = async (profile: ChatbotProfile) => {
    // Don't allow deleting the default profile
    if (profile.id === "default") {
      alert("Cannot delete the default profile");
      return;
    }

    if (!confirm(`Are you sure you want to delete "${profile.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/chatbot-profiles?id=${profile.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchProfiles();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete profile");
      }
    } catch (error) {
      console.error("Error deleting profile:", error);
      alert("Failed to delete profile. Please try again.");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-github-dark">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-github-dark">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Chatbot Profiles</h1>
            <p className="text-gray-400">Customize your AI companion&rsquo;s personality</p>
            <p className="text-sm text-gray-500 mt-1">
              Only the current profile is used in conversations. Switch it below when you&rsquo;re ready for a new persona.
            </p>
          </div>
          <button
            onClick={() => {
              setShowCreateForm(true);
              setEditingProfile(null);
              setFormData({
                name: "",
                description: "",
                systemPrompt: DEFAULT_CHATBOT_PROFILE.systemPrompt,
              });
            }}
            className="px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg transition-colors"
          >
            Create Profile
          </button>
        </div>

        {showCreateForm && (
          <div className="bg-github-dark border border-github-dark-border rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingProfile ? "Edit Profile" : "Create New Profile"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-github-dark-hover border border-github-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-github-green"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-github-dark-hover border border-github-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-github-green"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">System Prompt</label>
                <textarea
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  className="w-full h-48 bg-github-dark-hover border border-github-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-github-green resize-none font-mono text-sm"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Define the chatbot&rsquo;s personality, goals, and behavior
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg transition-colors"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingProfile(null);
                  }}
                  className="px-4 py-2 bg-github-dark-hover hover:bg-github-dark-border text-white rounded-lg transition-colors border border-github-dark-border"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-4">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="bg-github-dark border border-github-dark-border rounded-lg p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-semibold">{profile.name}</h3>
                    {profile.isCurrent && (
                      <span className="px-2 py-1 bg-github-green/20 text-github-green text-xs rounded">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 mb-3">{profile.description}</p>
                  <div className="bg-github-dark-hover rounded p-3">
                    <p className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
                      {(profile.systemPrompt ?? "").substring(0, 200)}
                      {(profile.systemPrompt ?? "").length > 200 && "..."}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!profile.isCurrent && (
                    <button
                      onClick={() => handleSetCurrent(profile)}
                      className="px-4 py-2 bg-github-green/20 hover:bg-github-green/30 text-github-green rounded-lg text-sm transition-colors border border-github-green/40"
                    >
                      Set as current
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(profile)}
                    className="px-4 py-2 bg-github-dark-hover hover:bg-github-dark-border text-white rounded-lg text-sm transition-colors border border-github-dark-border"
                  >
                    Edit
                  </button>
                  {profile.id !== "default" && (
                    <button
                      onClick={() => handleDelete(profile)}
                      className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm transition-colors border border-red-600/30"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

