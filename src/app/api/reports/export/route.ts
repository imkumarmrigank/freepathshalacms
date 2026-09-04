import { NextResponse } from "next/server";
import { today, toISODate } from "@/lib/format";
import ExcelJS from "exceljs";
import { getSession } from "@/lib/auth";
import { runReport, type ReportParams } from "@/lib/reports";
import { currentSession } from "@/lib/queries";
import { reportByKey } from "@/lib/report-meta";

export const dynamic = "force-dynamic";

function csvEscape(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const key = url.searchParams.get("report") ?? "";
  const meta = reportByKey(key);
  if (!meta) return new NextResponse("Unknown report", { status: 400 });

  const session = await currentSession();
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  const params: ReportParams = {
    from: url.searchParams.get("from") || toISODate(monthAgo),
    to: url.searchParams.get("to") || today(),
    centerId: Number(url.searchParams.get("center")) || null,
    classId: Number(url.searchParams.get("class")) || null,
    sessionId: Number(url.searchParams.get("session")) || session?.id || 0,
    role: url.searchParams.get("role") || null,
    groupBy: url.searchParams.get("groupBy") || null,
  };

  let result;
  try {
    result = await runReport(key, params, user);
  } catch (err) {
    return new NextResponse(err instanceof Error ? err.message : "Report failed", { status: 400 });
  }

  const stamp = today();
  const filename = `${key}-${stamp}`;

  // CSV escape hatch, mostly for scripting; the UI asks for xlsx.
  if (url.searchParams.get("format") === "csv") {
    const csv = [
      result.columns.map((c) => csvEscape(c.label)).join(","),
      ...result.rows.map((r) => result.columns.map((c) => csvEscape(r[c.key])).join(",")),
    ].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Pehchaan";
  wb.created = new Date();
  const ws = wb.addWorksheet(result.title.slice(0, 30), {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  // Title block
  const lastCol = Math.max(result.columns.length, 1);
  ws.mergeCells(1, 1, 1, lastCol);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `Pehchaan — ${result.title}`;
  titleCell.font = { size: 14, bold: true, color: { argb: "FF16162A" } };
  titleCell.alignment = { vertical: "middle" };
  ws.getRow(1).height = 24;

  ws.mergeCells(2, 1, 2, lastCol);
  const subCell = ws.getCell(2, 1);
  subCell.value = `${result.subtitle}   ·   generated ${stamp} by ${user.name}`;
  subCell.font = { size: 10, color: { argb: "FF6B6B85" } };

  // Header row
  const header = ws.getRow(3);
  result.columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.label;
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F36A3" } };
    cell.alignment = { vertical: "middle", horizontal: c.numeric ? "right" : "left", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: "FFD7D7E3" } } };
  });
  header.height = 20;

  result.columns.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width ?? (c.numeric ? 11 : 18);
  });

  for (const row of result.rows) {
    const values = result.columns.map((c) => {
      const v = row[c.key];
      if (v === null || v === undefined) return null;
      return c.numeric && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : v;
    });
    const r = ws.addRow(values);
    result.columns.forEach((c, i) => {
      r.getCell(i + 1).alignment = { horizontal: c.numeric ? "right" : "left", vertical: "top" };
      r.getCell(i + 1).font = { size: 10 };
    });
  }

  if (result.rows.length > 0) {
    ws.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: 3, column: lastCol },
    };
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
