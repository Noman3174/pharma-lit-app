"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";

import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

/* ---------------- TYPES ---------------- */

type Study = {
  pmid: string;
  title: string;
  journal: string;
  year: number | null;
  url: string;
};

type SavedStudyRow = {
  id: string;
  project_id: string;
  order_index: number;
  pmid: string | null;
  title: string | null;
  journal: string | null;
  year: number | null;
  url: string | null;

  evidence_type?: string | null;
  population?: string | null;
  comparator?: string | null;
  primary_endpoint?: string | null;
  sample_size?: string | null;

  key_takeaway?: string | null;
  qualitative_bullets?: string[] | null;
  quantitative_bullets?: string[] | null;
};

/* ---------------- MAIN PAGE ---------------- */

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id;

  const [projectName, setProjectName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Study[]>([]);
  const [saved, setSaved] = useState<SavedStudyRow[]>([]);
  const [savingPmid, setSavingPmid] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor));

  async function loadProject() {
    if (!projectId) return;

    const { data, error } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single();

    if (error) {
      console.error("loadProject error:", error);
      return;
    }

    setProjectName(data?.name || "");
  }

  async function loadSaved() {
    if (!projectId) return;

    const { data, error } = await supabase
      .from("project_studies")
      .select("*")
      .eq("project_id", projectId)
      .order("order_index", { ascending: true });

    if (error) {
      console.error("loadSaved error:", error);
      return;
    }

    setSaved((data as SavedStudyRow[]) || []);
  }

  async function searchStudies() {
    if (!query.trim()) return;

    setSearching(true);
    try {
      const res = await fetch(
        `/api/search/studies?q=${encodeURIComponent(query)}`
      );
      const json = await res.json();
      setResults(json.results || []);
    } catch (e) {
      console.error(e);
      alert("Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function saveStudy(study: Study) {
    if (!projectId) return;

    setSavingPmid(study.pmid);

    try {
      const { data: current, error: currentErr } = await supabase
        .from("project_studies")
        .select("order_index")
        .eq("project_id", projectId)
        .order("order_index", { ascending: false })
        .limit(1);

      if (currentErr) {
        alert(currentErr.message);
        return;
      }

      const lastIndex = current?.[0]?.order_index ?? 0;

      const { error } = await supabase.from("project_studies").insert([
        {
          project_id: projectId,
          order_index: lastIndex + 1,
          pmid: study.pmid,
          title: study.title,
          journal: study.journal,
          year: study.year,
          url: study.url,
        },
      ]);

      if (error) {
        alert(error.message);
        return;
      }

      await loadSaved();
    } finally {
      setSavingPmid(null);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = saved.findIndex((s) => s.id === active.id);
    const newIndex = saved.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(saved, oldIndex, newIndex);

    // UI update immediately
    setSaved(
      newOrder.map((item, index) => ({
        ...item,
        order_index: index + 1,
      }))
    );

    // persist to DB
    for (let i = 0; i < newOrder.length; i++) {
      await supabase
        .from("project_studies")
        .update({ order_index: i + 1 })
        .eq("id", newOrder[i].id);
    }
  }

  async function downloadPdf() {
    if (!saved.length) {
      alert("No saved studies to export.");
      return;
    }

    const res = await fetch("/api/export-project-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: "BIOCARE PHARMACEUTICA",
        projectName: projectName || "Literature Aide",
        studies: saved,
      }),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || "PDF export failed");
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${(projectName || "literature-aide")
      .replace(/[^a-z0-9-_ ]/gi, "")
      .slice(0, 40)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
  }

  useEffect(() => {
    loadProject();
    loadSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header + PDF button */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/app" className="text-sm underline">
            ← Back
          </Link>
          <h1 className="text-2xl font-semibold mt-2">{projectName}</h1>
        </div>

        <button
          onClick={downloadPdf}
          className="bg-black text-white px-4 py-2 rounded"
          type="button"
        >
          Download PDF
        </button>
      </div>

      {/* SEARCH */}
      <div className="border rounded-lg p-4 bg-white space-y-3">
        <h2 className="font-semibold">Search Studies</h2>

        <div className="flex gap-2">
          <input
            className="border p-2 flex-1 rounded"
            placeholder="Search studies..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            onClick={searchStudies}
            className="bg-black text-white px-4 py-2 rounded"
            disabled={searching}
            type="button"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </div>

        <div className="space-y-3">
          {results.map((s) => (
            <div
              key={s.pmid}
              className="border p-3 rounded flex justify-between items-start"
            >
              <div className="pr-3">
                <div className="font-medium">{s.title}</div>
                <div className="text-sm text-gray-600">
                  {s.journal} {s.year ? `(${s.year})` : ""}
                </div>
                <div className="text-xs text-gray-500">PMID: {s.pmid}</div>
              </div>

              <div className="flex gap-2 shrink-0">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border px-3 py-1 rounded text-sm"
                >
                  Open
                </a>

                <button
                  onClick={() => saveStudy(s)}
                  disabled={savingPmid === s.pmid}
                  className="bg-gray-900 text-white px-3 py-1 rounded text-sm disabled:opacity-60"
                  type="button"
                >
                  {savingPmid === s.pmid ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ))}

          {!results.length && (
            <p className="text-sm text-gray-500">
              No search results yet. Try searching above.
            </p>
          )}
        </div>
      </div>

      {/* SAVED */}
      <div className="border rounded-lg p-4 bg-white">
        <h2 className="font-semibold mb-3">Saved Studies</h2>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={saved.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {saved.map((s) => (
                <SortableStudyItem key={s.id} id={s.id}>
                  <SavedStudyCard
                    study={s}
                    onUpdated={loadSaved}
                    projectName={projectName}
                  />
                </SortableStudyItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {!saved.length && (
          <p className="text-sm text-gray-500">No studies saved yet.</p>
        )}
      </div>
    </div>
  );
}

/* ---------------- SORTABLE WRAPPER ---------------- */

function SortableStudyItem({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="flex gap-2">
        <button
          {...listeners}
          className="cursor-grab border px-2 rounded"
          type="button"
        >
          ☰
        </button>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- STUDY CARD ---------------- */

function SavedStudyCard({
  study,
  onUpdated,
  projectName,
}: {
  study: SavedStudyRow;
  onUpdated: () => Promise<void>;
  projectName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const qualitative = Array.isArray(study.qualitative_bullets)
    ? study.qualitative_bullets
    : [];
  const quantitative = Array.isArray(study.quantitative_bullets)
    ? study.quantitative_bullets
    : [];

  const [editTakeaway, setEditTakeaway] = useState(study.key_takeaway || "");
  const [editQual, setEditQual] = useState<string[]>(qualitative);
  const [editQuant, setEditQuant] = useState<string[]>(quantitative);

  // ✅ Keep edit inputs synced with DB *only when not editing*
  useEffect(() => {
    if (editMode) return;
    setEditTakeaway(study.key_takeaway || "");
    setEditQual(qualitative);
    setEditQuant(quantitative);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editMode,
    study.id,
    study.key_takeaway,
    study.qualitative_bullets,
    study.quantitative_bullets,
  ]);

  function openEdit() {
    setEditTakeaway(study.key_takeaway || "");
    setEditQual(qualitative);
    setEditQuant(quantitative);
    setEditMode(true);
  }

  function cancelEdits() {
    setEditMode(false);
  }

  async function analyze() {
    if (!study.pmid) return;

    setLoading(true);
    try {
      const res = await fetch("/api/analyze-study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pmid: study.pmid,
          productName: projectName,
          title: study.title,
          journal: study.journal,
          year: study.year,
          url: study.url,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json?.error || "Analysis failed");
        return;
      }

      const { error } = await supabase
        .from("project_studies")
        .update({
          evidence_type: json.evidence_type ?? "Other",
          population: json.population ?? null,
          comparator: json.comparator ?? null,
          primary_endpoint: json.primary_endpoint ?? null,
          sample_size: json.sample_size ?? null,
          key_takeaway: json.key_takeaway ?? null,
          qualitative_bullets: json.qualitative_bullets ?? [],
          quantitative_bullets: json.quantitative_bullets ?? [],
        })
        .eq("id", study.id);

      if (error) {
        alert(error.message);
        return;
      }

      await onUpdated();
    } catch (e: any) {
      alert(e?.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  async function saveEdits() {
    setSavingEdits(true);

    const cleanedQual = editQual.map((x) => x.trim()).filter(Boolean);
    const cleanedQuant = editQuant.map((x) => x.trim()).filter(Boolean);
    const cleanedTakeaway = editTakeaway.trim();

    const { error } = await supabase
      .from("project_studies")
      .update({
        key_takeaway: cleanedTakeaway || null,
        qualitative_bullets: cleanedQual,
        quantitative_bullets: cleanedQuant,
      })
      .eq("id", study.id);

    if (error) {
      alert(error.message);
      setSavingEdits(false);
      return;
    }

    await onUpdated();
    setEditMode(false);
    setSavingEdits(false);
  }

  async function deleteStudy() {
    const ok = confirm("Delete this study?");
    if (!ok) return;

    setDeleting(true);

    const { error } = await supabase
      .from("project_studies")
      .delete()
      .eq("id", study.id);

    if (error) {
      alert(error.message);
      setDeleting(false);
      return;
    }

    await onUpdated();
    setDeleting(false);
  }

  function addQual() {
    setEditQual((prev) => [...prev, ""]);
  }
  function addQuant() {
    setEditQuant((prev) => [...prev, ""]);
  }
  function updateQual(i: number, val: string) {
    setEditQual((prev) => prev.map((x, idx) => (idx === i ? val : x)));
  }
  function updateQuant(i: number, val: string) {
    setEditQuant((prev) => prev.map((x, idx) => (idx === i ? val : x)));
  }
  function removeQual(i: number) {
    setEditQual((prev) => prev.filter((_, idx) => idx !== i));
  }
  function removeQuant(i: number) {
    setEditQuant((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="border p-3 rounded space-y-3 bg-white">
      <div className="space-y-1">
        <div className="font-medium">
          {study.order_index}. {study.title}
        </div>

        {study.evidence_type && (
          <div className="inline-block text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 border">
            {study.evidence_type}
          </div>
        )}

        <div className="text-sm text-gray-600">
          {study.journal} {study.year ? `(${study.year})` : ""}{" "}
          {study.pmid ? `• PMID: ${study.pmid}` : ""}
        </div>

        {(study.population ||
          study.comparator ||
          study.primary_endpoint ||
          study.sample_size) && (
          <div className="text-xs text-gray-700 space-y-1 mt-1">
            {study.population && (
              <div>
                <strong>Population:</strong> {study.population}
              </div>
            )}
            {study.comparator && (
              <div>
                <strong>Comparator:</strong> {study.comparator}
              </div>
            )}
            {study.primary_endpoint && (
              <div>
                <strong>Primary endpoint:</strong> {study.primary_endpoint}
              </div>
            )}
            {study.sample_size && (
              <div>
                <strong>Sample size:</strong> {study.sample_size}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        {study.url && (
          <a
            href={study.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-sm"
          >
            Open
          </a>
        )}

        <button
          onClick={analyze}
          disabled={loading || !study.pmid}
          className="bg-black text-white px-3 py-1 rounded text-sm disabled:opacity-60"
          type="button"
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>

        <button
          onClick={openEdit}
          className="bg-zinc-800 text-white px-3 py-1 rounded text-sm"
          type="button"
        >
          Edit
        </button>

        <button
          onClick={deleteStudy}
          disabled={deleting}
          className="bg-red-600 text-white px-3 py-1 rounded text-sm disabled:opacity-60"
          type="button"
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>

      {!editMode ? (
        <div className="space-y-2">
          {study.key_takeaway && (
            <>
              <div className="font-semibold text-sm">Key Takeaway</div>
              <div className="text-sm">{study.key_takeaway}</div>
            </>
          )}

          {!!qualitative.length && (
            <>
              <div className="font-semibold text-sm">
                Qualitative Advantages
              </div>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {qualitative.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </>
          )}

          {!!quantitative.length && (
            <>
              <div className="font-semibold text-sm">
                Quantitative Advantages
              </div>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {quantitative.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4 border-t pt-3">
          <div className="space-y-2">
            <div className="font-semibold text-sm">Key Takeaway</div>
            <textarea
              className="w-full border p-2 rounded text-sm"
              value={editTakeaway}
              onChange={(e) => setEditTakeaway(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-sm">Qualitative</span>
              <button
                onClick={addQual}
                className="text-sm underline"
                type="button"
              >
                + Add
              </button>
            </div>

            {editQual.map((b, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="flex-1 border p-1 rounded text-sm"
                  value={b}
                  onChange={(e) => updateQual(i, e.target.value)}
                />
                <button
                  onClick={() => removeQual(i)}
                  className="bg-red-600 text-white px-2 rounded text-sm"
                  type="button"
                >
                  X
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-sm">Quantitative</span>
              <button
                onClick={addQuant}
                className="text-sm underline"
                type="button"
              >
                + Add
              </button>
            </div>

            {editQuant.map((b, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="flex-1 border p-1 rounded text-sm"
                  value={b}
                  onChange={(e) => updateQuant(i, e.target.value)}
                />
                <button
                  onClick={() => removeQuant(i)}
                  className="bg-red-600 text-white px-2 rounded text-sm"
                  type="button"
                >
                  X
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={saveEdits}
              disabled={savingEdits}
              className="bg-black text-white px-3 py-1 rounded text-sm disabled:opacity-60"
              type="button"
            >
              {savingEdits ? "Saving..." : "Save"}
            </button>

            <button
              onClick={cancelEdits}
              className="border px-3 py-1 rounded text-sm"
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}