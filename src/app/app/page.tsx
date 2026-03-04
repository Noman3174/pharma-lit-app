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
};

export default function AppHome() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [newName, setNewName] = useState("");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function requireUser() {
    const { data } = await supabase.auth.getUser();

    const u = data?.user;

    if (!u) {
      router.push("/login");
      return;
    }

    setUserId(u.id);
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
        user_id: userId,
      },
    ]);

    if (error) {
      alert(error.message);
      setCreating(false);
      return;
    }

    setNewName("");
    await loadProjects(userId);
    setCreating(false);
  }

  async function deleteSelected() {
    const ids = Object.keys(selected).filter((k) => selected[k]);

    if (!ids.length) {
      alert("Select projects first");
      return;
    }

    const ok = confirm("Delete selected projects?");
    if (!ok) return;

    setDeleting(true);

    await supabase.from("project_studies").delete().in("project_id", ids);

    const { error } = await supabase
      .from("projects")
      .delete()
      .in("id", ids);

    if (error) {
      alert(error.message);
      setDeleting(false);
      return;
    }

    await loadProjects(userId);
    setDeleting(false);
  }

  async function logout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
  }

  function toggle(id: string) {
    setSelected((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  useEffect(() => {
    requireUser();
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadProjects(userId);
  }, [userId]);

  return (
    <div className="min-h-screen flex bg-gray-50">

      {/* SIDEBAR */}
      <div className="w-64 bg-white border-r p-4 space-y-4">

        <div className="text-xl font-semibold">
          Literature Aide
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">
            Create Project
          </div>

          <input
            className="border p-2 rounded w-full"
            placeholder="Project name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />

          <button
            onClick={createProject}
            disabled={creating}
            className="w-full bg-black text-white p-2 rounded"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>

        <button
          onClick={logout}
          disabled={loggingOut}
          className="border w-full p-2 rounded"
        >
          {loggingOut ? "Logging out..." : "Logout"}
        </button>

      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-6">

        <div className="flex justify-between mb-4">
          <h1 className="text-2xl font-semibold">
            My Projects
          </h1>

          <button
            onClick={deleteSelected}
            disabled={deleting}
            className="bg-red-600 text-white px-4 py-2 rounded"
          >
            {deleting ? "Deleting..." : "Delete Selected"}
          </button>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : projects.length ? (
          <div className="space-y-2">

            {projects.map((p) => (
              <div
                key={p.id}
                className="border rounded p-3 flex justify-between items-center"
              >

                <div className="flex items-center gap-3">

                  <input
                    type="checkbox"
                    checked={selected[p.id] || false}
                    onChange={() => toggle(p.id)}
                  />

                  <div>
                    <div className="font-medium">
                      {p.name ?? "(untitled)"}
                    </div>

                    <div className="text-xs text-gray-500">
                      {new Date(p.created_at).toLocaleString()}
                    </div>
                  </div>

                </div>

                <Link
                  href={`/app/projects/${p.id}`}
                  className="border px-3 py-1 rounded"
                >
                  Open
                </Link>

              </div>
            ))}

          </div>
        ) : (
          <div>No projects yet.</div>
        )}

      </div>

    </div>
  );
}