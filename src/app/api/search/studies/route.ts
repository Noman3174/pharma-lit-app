import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  // Step 1: Get PMIDs
  const esearch = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=10&term=${encodeURIComponent(q)}`
  ).then((r) => r.json());

  const ids: string[] = esearch?.esearchresult?.idlist ?? [];

  if (!ids.length) {
    return NextResponse.json({ results: [] });
  }

  // Step 2: Get summaries
  const esummary = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`
  ).then((r) => r.json());

  const results = ids.map((id) => {
    const item = esummary?.result?.[id];
    return {
      pmid: id,
      title: item?.title ?? "",
      journal: item?.fulljournalname ?? "",
      year: item?.pubdate ? parseInt(item.pubdate.slice(0, 4)) : null,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
    };
  });

  return NextResponse.json({ results });
}