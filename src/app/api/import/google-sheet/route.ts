import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { url?: string };
  const parsed = parseGoogleSheetUrl(body.url ?? "");
  if (!parsed) {
    return NextResponse.json({ error: "Invalid Google Sheet URL" }, { status: 400 });
  }

  const exportUrl = `https://docs.google.com/spreadsheets/d/${parsed.spreadsheetId}/export?format=csv&gid=${parsed.gid}`;
  const response = await fetch(exportUrl, { cache: "no-store" }).catch(() => null);
  if (!response?.ok) {
    return NextResponse.json({ error: "Failed to fetch Google Sheet" }, { status: 502 });
  }

  const csv = await response.text();
  const rows = csvToObjects(csv);
  return NextResponse.json({ rows });
}

function parseGoogleSheetUrl(urlText: string): { spreadsheetId: string; gid: string } | null {
  const spreadsheetMatch = urlText.match(/\/spreadsheets\/d\/([^/]+)/);
  if (!spreadsheetMatch?.[1]) return null;
  const gidMatch = urlText.match(/[?#&]gid=(\d+)/);
  return {
    spreadsheetId: spreadsheetMatch[1],
    gid: gidMatch?.[1] ?? "0"
  };
}

function csvToObjects(csv: string): Record<string, string>[] {
  const rows = parseCsv(csv).filter((row) => row.some((cell) => cell.trim()));
  const headers = rows[0]?.map((header) => header.trim()) ?? [];
  return rows.slice(1).map((row) => {
    const object: Record<string, string> = {};
    headers.forEach((header, index) => {
      object[header] = row[index]?.trim() ?? "";
    });
    return object;
  });
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}
