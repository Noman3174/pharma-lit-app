"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type ProjectRow = {
  id: string;
  name: string | null;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
};

export default function AppHome() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function requireUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) console.error(error);

    const u = data?.user;
    if (!u) {
      router.push("/login");
      return;

      console.log("getUser()", data?.user);
    }

    setUserId(u.id);
    setUserEmail(u.email ?? null);
  }

  async function loadProjects(uid?: string | null) {
    const actualUid = uid ?? userId;
    if (!actualUid) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", actualUid)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert(error.message);
      setLoading(false);
      return;
    }

    setProjects((data as ProjectRow[]) || []);
    setLoading(false);
  }

  async function createProject() {
    if (!newName.trim()) return;
    if (!userId) return;

    setCreating(true);

    const { error } = await supabase.from("projects").insert([
      {
        name: newName.trim(),
        user_id: userId,          // ✅ IMPORTANT
        user_email: userEmail,    // optional
      },
    ]);

    if (error) {
      console.error(error);
      alert(error.message);
      setCreating(false);
      return;
    }

    setNewName("");
    await loadProjects(userId);
    setCreating(false);
  }

  async function logout() {
    setLoggingOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert(error.message);
      setLoggingOut(false);
      return;
    }
    router.push("/login");
  }

  useEffect(() => {
    (async () => {
      await requireUser();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadProjects(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>

        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className="border px-3 py-2 rounded"
        >
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>

      <div className="border rounded p-4 space-y-3 bg-white">
        <div className="font-semibold">Create Project</div>

        <div className="flex gap-2">
          <input
            className="border p-2 rounded flex-1"
            placeholder="e.g., inj. ceftriaxone"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />

          <button
            type="button"                  // ✅ IMPORTANT
            onClick={createProject}
            disabled={creating}
            className="bg-black text-white px-4 py-2 rounded disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>

      <div className="border rounded p-4 bg-white">
        <div className="font-semibold mb-3">Past Projects</div>

        {loading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : projects.length ? (
          <div className="space-y-2">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="block border rounded p-3 hover:bg-gray-50"
              >
                <div className="font-medium">{p.name ?? "(untitled)"}</div>
                <div className="text-xs text-gray-500">{p.id}</div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            No projects found for this user.
          </div>
        )}
      </div>
    </div>
  );
}