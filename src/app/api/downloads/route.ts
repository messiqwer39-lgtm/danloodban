import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { downloadManager } from "@/lib/download-manager";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const downloads = await downloadManager.list();
    return NextResponse.json({ downloads });
  } catch {
    return NextResponse.json({ downloads: [] });
  }
}

export async function POST(req: NextRequest) {
  let body: { url?: unknown; speedLimitKbps?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const url = typeof body.url === "string" ? body.url : "";
  const limit = typeof body.speedLimitKbps === "number" ? body.speedLimitKbps : 0;
  if (!url.trim()) {
    return NextResponse.json({ error: "لینک واردشده معتبر نیست" }, { status: 400 });
  }
  try {
    const download = await downloadManager.add(url, limit);
    return NextResponse.json({ download }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "خطای ناشناخته در شروع دانلود";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
