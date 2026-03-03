import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

type SavedStudyRow = {
  order_index: number;
  pmid: string | null;
  title: string | null;
  journal: string | null;
  year: number | null;
  url: string | null;
  key_takeaway?: string | null;
  qualitative_bullets?: string[] | null;
  quantitative_bullets?: string[] | null;
};

function wrapText(text: string, maxChars: number) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length <= maxChars) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const projectName: string = body.projectName || "Literature Aide";
    const companyName: string = body.companyName || "Your Company";
    const studies: SavedStudyRow[] = Array.isArray(body.studies) ? body.studies : [];

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // ✅ Try to load /public/logo.png
    let logoImage: any = null;
    try {
      const logoPath = path.join(process.cwd(), "public", "logo.png");
      const logoBytes = await fs.readFile(logoPath);
      logoImage = await pdfDoc.embedPng(logoBytes);
    } catch {
      // If logo missing or unreadable, we silently continue without it
      logoImage = null;
    }

    const margin = 40;
    const headerH = 90; // you already set this and it looks good
    const footerH = 35;
    const lineH = 14;
    const maxChars = 95;

    const createdAt = new Date().toLocaleString();

    const pages: any[] = [];

    let page = pdfDoc.addPage();
    pages.push(page);

    let { width, height } = page.getSize();
    let y = height - margin - headerH;

    const drawHeader = () => {
      // Header divider line
      page.drawLine({
        start: { x: margin, y: height - margin - headerH + 20 },
        end: { x: width - margin, y: height - margin - headerH + 20 },
        thickness: 1,
        color: rgb(0.75, 0.75, 0.75),
      });

      // ✅ Draw logo (top-left)
      const logoBoxW = 90; // display width
      const logoBoxH = 35; // display height
      const logoX = margin;
      const logoY = height - margin - 35; // top area

      if (logoImage) {
        const imgW = logoImage.width;
        const imgH = logoImage.height;

        // scale to fit in box while keeping aspect ratio
        const scale = Math.min(logoBoxW / imgW, logoBoxH / imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;

        page.drawImage(logoImage, {
          x: logoX,
          y: logoY,
          width: drawW,
          height: drawH,
        });
      }

      // Company name to the right of logo
      const companyTextX = logoImage ? margin + 110 : margin;

      page.drawText(companyName, {
        x: companyTextX,
        y: height - margin - 20,
        size: 14,
        font: fontBold,
      });

      page.drawText(`Project: ${projectName}`, {
        x: companyTextX,
        y: height - margin - 40,
        size: 11,
        font,
      });

      page.drawText(`Generated: ${createdAt}`, {
        x: width - margin - 220,
        y: height - margin - 40,
        size: 9,
        font,
      });

      page.drawText("Confidential – Internal Use Only", {
        x: companyTextX,
        y: height - margin - 65,
        size: 9,
        font: fontBold,
        color: rgb(0.6, 0, 0),
      });
    };

    const drawFooter = (pageIndex: number, totalPages: number) => {
      const footerY = margin - 10;

      page.drawLine({
        start: { x: margin, y: footerY + 18 },
        end: { x: width - margin, y: footerY + 18 },
        thickness: 1,
        color: rgb(0.75, 0.75, 0.75),
      });

      page.drawText(`Page ${pageIndex} of ${totalPages}`, {
        x: width - margin - 90,
        y: footerY,
        size: 9,
        font,
      });
    };

    const newPage = () => {
      page = pdfDoc.addPage();
      pages.push(page);
      ({ width, height } = page.getSize());
      y = height - margin - headerH;
      drawHeader();
    };

    const ensureSpace = (needed: number) => {
      if (y < margin + footerH + needed) newPage();
    };

    const drawLine = (text: string, bold = false, size = 11, indent = 0) => {
      ensureSpace(lineH);
      page.drawText(text, {
        x: margin + indent,
        y,
        size,
        font: bold ? fontBold : font,
      });
      y -= lineH;
    };

    const drawWrapped = (text: string, bold = false, size = 11, indent = 0) => {
      const lines = wrapText(text, Math.max(25, maxChars - Math.floor(indent / 6)));
      for (const ln of lines) drawLine(ln, bold, size, indent);
    };

    // First page header
    drawHeader();

    // Main title
    y -= 20;
    drawLine("Pharma Literature Aide", true, 18);
    y -= 12;

    // Body
    for (const s of studies) {
      ensureSpace(60);

      const idx = s.order_index ?? 0;
      const title = s.title || "Untitled study";
      const journal = s.journal || "";
      const year = s.year ? String(s.year) : "";
      const pmid = s.pmid || "";
      const url = s.url || "";

      drawWrapped(`${idx}. ${title}`, true, 12);

      if (journal || year) {
        drawLine(`${journal}${journal && year ? " " : ""}${year ? `(${year})` : ""}`, false, 10);
      }
      if (pmid) drawLine(`PMID: ${pmid}`, false, 10);
      if (url) drawWrapped(`URL: ${url}`, false, 9);

      if (s.key_takeaway) {
        y -= 4;
        drawLine("Key takeaway:", true, 10);
        drawWrapped(s.key_takeaway, false, 10, 14);
      }

      const qual = Array.isArray(s.qualitative_bullets) ? s.qualitative_bullets : [];
      if (qual.length) {
        y -= 4;
        drawLine("Qualitative advantages:", true, 10);
        for (const b of qual) drawWrapped(`• ${b}`, false, 10, 14);
      }

      const quant = Array.isArray(s.quantitative_bullets) ? s.quantitative_bullets : [];
      if (quant.length) {
        y -= 4;
        drawLine("Quantitative advantages:", true, 10);
        for (const b of quant) drawWrapped(`• ${b}`, false, 10, 14);
      }

      y -= 12;
    }

    // Footer pages
    const totalPages = pages.length;
    for (let i = 0; i < totalPages; i++) {
      page = pages[i];
      ({ width, height } = page.getSize());
      drawFooter(i + 1, totalPages);
    }

    const bytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${projectName
          .replace(/[^a-z0-9-_ ]/gi, "")
          .slice(0, 40) || "literature-aide"}.pdf"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "PDF export failed" }, { status: 500 });
  }
}