"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { supabase } from "@/lib/supabase";

type Project = {
  id: string;
  name: string;
  created_at: string;
  user_email: string;
};

export default function AppHome() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email || "";

  const [name, setName] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadProjects() {
    if (!userEmail) return;
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_email", userEmail)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }
    setProjects((data as Project[]) || []);
  }

  async function createProject() {
    if (!name.trim() || !userEmail) return;
    setLoading(true);

    const { error } = await supabase.from("projects").insert([
      {
        name: name.trim(),
        user_email: userEmail,
      },
    ]);

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setName("");
    loadProjects();
  }

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <button className="text-sm underline" onClick={() => signOut()}>
          Logout
        </button>
      </div>

      <div className="border rounded-xl p-4 space-y-3 bg-white">
        <h2 className="font-medium">Create New Project</h2>

        <div className="flex gap-2">
          <input
            className="flex-1 border rounded-lg p-2"
            placeholder="e.g., Inj. Ceftriaxone"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="bg-black text-white rounded-lg px-4 disabled:opacity-60"
            onClick={createProject}
            disabled={loading}
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </div>

        <p className="text-xs text-gray-500">
          Logged in as: {userEmail}
        </p>
      </div>

      <div className="border rounded-xl p-4 space-y-3 bg-white">
        <h2 className="font-medium">Past Projects</h2>

        <div className="space-y-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/app/projects/${p.id}`}
              className="block border rounded-lg p-3 hover:bg-gray-50"
            >
              {p.name}
            </Link>
          ))}
          {!projects.length && (
            <p className="text-sm text-gray-600">No projects yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}