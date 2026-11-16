import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { downloadManager } from "@/lib/download-manager";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  let body: { action?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const action = body.action;
  if (action !== "pause" && action !== "resume") {
    return NextResponse.json({ error: "عملیات نامعتبر است" }, { status: 400 });
  }
  const download =
    action === "pause"
      ? await downloadManager.pause(id)
      : await downloadManager.resume(id);
  if (!download) {
    return NextResponse.json({ error: "دانلود یافت نشد" }, { status: 404 });
  }
  return NextResponse.json({ download });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const ok = await downloadManager.remove(id);
  if (!ok) {
    return NextResponse.json({ error: "دانلود یافت نشد" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
