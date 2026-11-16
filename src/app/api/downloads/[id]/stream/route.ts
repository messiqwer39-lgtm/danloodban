import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { downloadManager } from "@/lib/download-manager";
import fs from "fs";
import { Readable } from "stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".ts": "video/mp2t",
};

function contentTypeFor(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : "";
  return MIME[ext] || "video/mp4";
}

function parseRange(
  header: string,
  total: number
): { start: number; end: number } | "416" | "invalid" {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) return "invalid";
  let start: number;
  let end: number;
  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (suffix === 0) return "416";
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? total - 1 : Math.min(Number(match[2]), total - 1);
  }
  if (start >= total) return "416";
  if (end < start) return "invalid";
  return { start, end };
}

async function fileExistsAt(filePath: string, bytePos: number): Promise<boolean> {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).size > bytePos;
  } catch {
    return false;
  }
}

async function waitForByte(
  filePath: string,
  bytePos: number,
  timeoutMs: number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fileExistsAt(filePath, bytePos)) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

function serveRange(
  filePath: string,
  start: number,
  end: number,
  total: number,
  contentType: string
): NextResponse {
  const nodeStream = fs.createReadStream(filePath, { start, end });
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;
  return new NextResponse(webStream, {
    status: 206,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Content-Length": String(end - start + 1),
    },
  });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const info = await downloadManager.getLiveInfo(id);
  if (!info || !fs.existsSync(info.filePath)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const size = fs.statSync(info.filePath).size;
  // طول نهایی فایل را اعلام می‌کنیم تا مرورگر نگاشت زمان/بایت را درست انجام دهد
  const total =
    info.totalBytes != null && info.totalBytes >= size ? info.totalBytes : size;
  const contentType = contentTypeFor(info.filename);
  const baseHeaders: Record<string, string> = {
    "Accept-Ranges": "bytes",
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  };

  const rangeHeader = req.headers.get("range");
  let start = 0;
  let end = total - 1;
  if (rangeHeader) {
    const parsed = parseRange(rangeHeader, total);
    if (parsed === "416") {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${total}` },
      });
    }
    if (parsed !== "invalid") {
      start = parsed.start;
      end = parsed.end;
    }
  }

  // فقط بایت‌های موجود را می‌دهیم؛ مرورگر باقی را بعداً درخواست می‌کند
  let availEnd = Math.min(end, size - 1);
  if (start > availEnd) {
    if (info.status === "downloading" && start < total) {
      const appeared = await waitForByte(info.filePath, start, 10000);
      if (appeared) {
        const grownSize = fs.statSync(info.filePath).size;
        availEnd = Math.min(end, grownSize - 1);
        return serveRange(info.filePath, start, availEnd, total, contentType);
      }
    }
    return new NextResponse(null, {
      status: 416,
      headers: { ...baseHeaders, "Content-Range": `bytes */${total}` },
    });
  }

  return serveRange(info.filePath, start, availEnd, total, contentType);
}
