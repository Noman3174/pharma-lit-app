import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs"; // ensure Node runtime on Vercel

function stripXmlTags(s: string) {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

async function fetchPubMedAbstract(pmid: string) {
  const url =
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi" +
    `?db=pubmed&id=${encodeURIComponent(pmid)}&retmode=xml`;

  const xml = await fetch(url, { cache: "no-store" }).then((r) => r.text());

  const matches = [
    ...xml.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g),
  ];
  const abstract = matches.map((m) => stripXmlTags(m[1])).join("\n").trim();

  return abstract;
}

const EVIDENCE_TYPES = [
  "Randomized Controlled Trial (RCT)",
  "Meta-analysis",
  "Systematic Review",
  "Observational - Cohort",
  "Observational - Case-Control",
  "Observational - Cross-sectional",
  "Guideline / Consensus",
  "Case Report / Case Series",
  "In Vitro",
  "Animal Study",
  "Pharmacokinetics / Pharmacodynamics",
  "Review (Narrative)",
  "Other",
] as const;

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY missing in environment" },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey });

    const body = await req.json();
    const { pmid, productName, title, journal, year, url } = body ?? {};

    if (!pmid || typeof pmid !== "string") {
      return NextResponse.json({ error: "pmid is required" }, { status: 400 });
    }

    const abstract = await fetchPubMedAbstract(pmid);

    const evidenceTypeList = EVIDENCE_TYPES.map((x) => `- ${x}`).join("\n");

    const input = `
You are helping build a pharmaceutical literature aide for the product: ${
      productName || "the product"
    }.

Only use the study text provided (title + abstract). If superiority/advantage is not explicitly supported, say "Not stated in abstract".
Do not invent numbers. If numbers are missing, write "Not stated in abstract".

Additionally, classify the STUDY TYPE (evidence type) into exactly ONE of these options:
${evidenceTypeList}

Rules for evidence_type:
- Choose the best single match from the list.
- If unclear from title/abstract, choose "Other".
- Do NOT add any new label outside the list.

Study:
- Title: ${title || ""}
- Journal: ${journal || ""}
- Year: ${year ?? ""}
- PMID: ${pmid}
- Link: ${url || ""}

Abstract:
${abstract || "[No abstract available from PubMed]"}
`.trim();

    const resp = await client.responses.create({
      model: "gpt-4o-mini-2024-07-18",
      input,
      text: {
        format: {
          type: "json_schema",
          name: "study_advantage_summary",
          strict: true,
          schema: {
  type: "object",
  additionalProperties: false,
  required: [
    "evidence_type",
    "population",
    "comparator",
    "primary_endpoint",
    "sample_size",
    "key_takeaway",
    "qualitative_bullets",
    "quantitative_bullets",
    "evidence_notes",
    "limitations",
  ],
  properties: {
    evidence_type: {
      type: "string",
      enum: [...EVIDENCE_TYPES],
    },

    population: { type: "string" },
    comparator: { type: "string" },
    primary_endpoint: { type: "string" },
    sample_size: { type: "string" },

    key_takeaway: { type: "string" },

    qualitative_bullets: {
      type: "array",
      items: { type: "string" },
    },

    quantitative_bullets: {
      type: "array",
      items: { type: "string" },
    },

    evidence_notes: {
      type: "array",
      items: { type: "string" },
    },

    limitations: {
      type: "array",
      items: { type: "string" },
    },
  },
}
        },
      },
    });

    const result = JSON.parse(resp.output_text);

    return NextResponse.json({
      ...result,
      pmid,
      abstract_available: Boolean(abstract),
    });
  } catch (err: any) {
    console.error("analyze-study error:", err);
    return NextResponse.json(
      { error: err?.message || "Unknown server error" },
      { status: 500 }
    );
  }
}