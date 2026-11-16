import { db } from "@/lib/db";
import fs from "fs";
import path from "path";

export type DownloadStatus = "queued" | "downloading" | "paused" | "completed" | "error";

export interface DownloadDTO {
  id: string;
  url: string;
  filename: string;
  status: DownloadStatus;
  receivedBytes: number;
  totalBytes: number | null;
  speed: number;
  etaSeconds: number | null;
  error: string | null;
  contentType: string | null;
  createdAt: string;
}

const STORAGE_ROOT = process.env.STORAGE_DIR || path.join(process.cwd(), "storage", "downloads");
const SAMPLES_ROOT = process.env.SAMPLES_DIR || path.join(process.cwd(), "storage", "samples");
const MAX_CONCURRENT = 3;

interface SpeedSample {
  t: number;
  b: number;
}

interface Task {
  id: string;
  url: string;
  filename: string;
  filePath: string;
  status: DownloadStatus;
  receivedBytes: number;
  totalBytes: number | null;
  contentType: string | null;
  speedLimitKbps: number;
  speedEma: number;
  samples: SpeedSample[];
  nextTime: number | undefined;
  error: string | null;
  createdAt: Date;
  controller: AbortController | null;
  stopRequested: "pause" | "cancel" | null;
}

function deriveFilename(url: string): string {
  let name = "";
  if (url.toLowerCase().startsWith("sample://")) {
    name = decodeURIComponent(url.slice("sample://".length));
  } else {
    try {
      const parsed = new URL(url);
      name = decodeURIComponent(parsed.pathname.split("/").pop() || "");
    } catch {
      name = "";
    }
  }
  name = name.replace(/[\\/:*?"<>|]/g, "").trim();
  if (!name) name = `video-${Date.now()}.mp4`;
  if (!/\.[a-z0-9]{2,5}$/i.test(name)) name += ".mp4";
  return name;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function faErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/HTTP 403/.test(message)) return "دسترسی به این لینک مجاز نیست (HTTP 403)";
  if (/HTTP 404/.test(message)) return "لینک یافت نشد (HTTP 404)";
  if (/HTTP (\d+)/.test(message)) return `پاسخ ناموفق از سرور (${message.replace("HTTP ", "")})`;
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|network|timed out|timeout/i.test(message))
    return "خطا در اتصال به سرور؛ لینک یا اتصال اینترنت را بررسی کنید";
  return message || "خطای ناشناخته در دانلود";
}

interface ManagerStore {
  tasks: Map<string, Task>;
  initPromise: Promise<void> | null;
}

const globalForManager = globalThis as unknown as {
  __danloodbanStore?: ManagerStore;
};

const managerStore: ManagerStore =
  globalForManager.__danloodbanStore ??
  { tasks: new Map<string, Task>(), initPromise: null };

globalForManager.__danloodbanStore = managerStore;

class DownloadManager {
  private tasks = managerStore.tasks;

  async init(): Promise<void> {
    if (!managerStore.initPromise) {
      managerStore.initPromise = (async () => {
        fs.mkdirSync(STORAGE_ROOT, { recursive: true });
        fs.mkdirSync(SAMPLES_ROOT, { recursive: true });
        await db.$executeRawUnsafe(
          `CREATE TABLE IF NOT EXISTS "Download" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "url" TEXT NOT NULL,
            "filename" TEXT NOT NULL,
            "filePath" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'queued',
            "totalBytes" BIGINT,
            "receivedBytes" BIGINT NOT NULL DEFAULT 0,
            "contentType" TEXT,
            "error" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`
        );
        const rows = await db.download.findMany({ orderBy: { createdAt: "asc" } });
        for (const row of rows) {
          let received = Number(row.receivedBytes);
          let status = row.status as DownloadStatus;
          let fileExists = false;
          try {
            fileExists = fs.existsSync(row.filePath);
            if (fileExists) received = fs.statSync(row.filePath).size;
          } catch {
            fileExists = false;
          }
          if (status === "downloading" || status === "queued") status = "paused";
          if ((status === "completed" || status === "paused") && !fileExists) {
            status = "error";
          }
          const task: Task = {
            id: row.id,
            url: row.url,
            filename: row.filename,
            filePath: row.filePath,
            status,
            receivedBytes: received,
            totalBytes: row.totalBytes == null ? null : Number(row.totalBytes),
            contentType: row.contentType,
            speedLimitKbps: 0,
            speedEma: 0,
            samples: [],
            nextTime: undefined,
            error: status === "error" ? "فایل روی دیسک یافت نشد" : row.error,
            createdAt: row.createdAt,
            controller: null,
            stopRequested: null,
          };
          this.tasks.set(task.id, task);
          if (status !== row.status || received !== Number(row.receivedBytes)) {
            this.persist(task);
          }
        }
      })().catch((err) => {
        console.error("download-manager init failed:", err);
      });
    }
    return managerStore.initPromise;
  }

  async add(url: string, speedLimitKbps = 0): Promise<DownloadDTO> {
    await this.init();
    const trimmed = (url || "").trim();
    if (!/^(https?:\/\/|sample:\/\/)/i.test(trimmed)) {
      throw new Error("لینک واردشده معتبر نیست");
    }
    const filename = deriveFilename(trimmed);
    fs.mkdirSync(STORAGE_ROOT, { recursive: true });
    let filePath = path.join(STORAGE_ROOT, filename);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      filePath = path.join(STORAGE_ROOT, `${base}-${Date.now()}${ext}`);
    }
    const row = await db.download.create({
      data: {
        url: trimmed,
        filename: path.basename(filePath),
        filePath,
        status: "queued",
        receivedBytes: 0,
      },
    });
    const task: Task = {
      id: row.id,
      url: row.url,
      filename: row.filename,
      filePath: row.filePath,
      status: "queued",
      receivedBytes: 0,
      totalBytes: null,
      contentType: null,
      speedLimitKbps: Math.max(0, Math.min(102400, Math.round(speedLimitKbps || 0))),
      speedEma: 0,
      samples: [],
      nextTime: undefined,
      error: null,
      createdAt: row.createdAt,
      controller: null,
      stopRequested: null,
    };
    this.tasks.set(task.id, task);
    this.pump();
    return this.view(task);
  }

  async list(): Promise<DownloadDTO[]> {
    await this.init();
    const order: Record<DownloadStatus, number> = {
      downloading: 0,
      queued: 1,
      paused: 2,
      error: 3,
      completed: 4,
    };
    return [...this.tasks.values()]
      .sort(
        (a, b) =>
          order[a.status] - order[b.status] ||
          b.createdAt.getTime() - a.createdAt.getTime()
      )
      .map((task) => this.view(task));
  }

  async getFileInfo(id: string): Promise<{ filePath: string; filename: string } | null> {
    await this.init();
    const task = this.tasks.get(id);
    if (task) return { filePath: task.filePath, filename: task.filename };
    const row = await db.download.findUnique({ where: { id } }).catch(() => null);
    return row ? { filePath: row.filePath, filename: row.filename } : null;
  }

  async getLiveInfo(
    id: string
  ): Promise<{
    filePath: string;
    filename: string;
    size: number;
    status: DownloadStatus;
    totalBytes: number | null;
  } | null> {
    await this.init();
    const resolve = (
      filePath: string,
      filename: string,
      status: DownloadStatus,
      totalBytes: number | null
    ) => {
      try {
        const size = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
        return { filePath, filename, size, status, totalBytes };
      } catch {
        return null;
      }
    };
    const task = this.tasks.get(id);
    if (task) {
      return resolve(task.filePath, task.filename, task.status, task.totalBytes);
    }
    const row = await db.download.findUnique({ where: { id } }).catch(() => null);
    if (!row) return null;
    return resolve(
      row.filePath,
      row.filename,
      row.status as DownloadStatus,
      row.totalBytes == null ? null : Number(row.totalBytes)
    );
  }

  async pause(id: string): Promise<DownloadDTO | null> {
    const task = this.tasks.get(id);
    if (!task) return null;
    if (task.status === "downloading") {
      task.stopRequested = "pause";
      task.status = "paused";
      task.controller?.abort();
    } else if (task.status === "queued") {
      task.status = "paused";
      await this.persist(task);
    }
    return this.view(task);
  }

  async resume(id: string): Promise<DownloadDTO | null> {
    const task = this.tasks.get(id);
    if (!task) return null;
    if (task.status === "paused" || task.status === "error") {
      task.error = null;
      task.stopRequested = null;
      task.status = "queued";
      await this.persist(task);
      this.pump();
    }
    return this.view(task);
  }

  async remove(id: string): Promise<boolean> {
    const task = this.tasks.get(id);
    if (task) {
      if (task.status === "downloading") {
        task.stopRequested = "cancel";
        task.controller?.abort();
        await this.cleanupDisk(id, task.filePath);
        this.tasks.delete(id);
      } else {
        this.tasks.delete(id);
        await this.cleanupDisk(id, task.filePath);
      }
      return true;
    }
    const row = await db.download.findUnique({ where: { id } }).catch(() => null);
    if (!row) return false;
    await this.cleanupDisk(id, row.filePath);
    return true;
  }

  private async cleanupDisk(id: string, filePath: string): Promise<void> {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // فایل ممکن است از قبل وجود نداشته باشد
    }
    await db.download.delete({ where: { id } }).catch(() => undefined);
  }

  private pump(): void {
    let slots =
      MAX_CONCURRENT -
      [...this.tasks.values()].filter((t) => t.status === "downloading").length;
    for (const task of this.tasks.values()) {
      if (slots <= 0) break;
      if (task.status === "queued") {
        slots -= 1;
        void this.run(task);
      }
    }
  }

  private async run(task: Task): Promise<void> {
    task.controller = new AbortController();
    task.status = "downloading";
    task.error = null;
    await this.persist(task);
    try {
      if (task.url.toLowerCase().startsWith("sample://")) {
        await this.runLocal(task);
      } else {
        await this.runNetwork(task);
      }
      if (task.stopRequested === "cancel") return;
      if (task.totalBytes != null && task.receivedBytes < task.totalBytes) {
        task.status = "paused";
        await this.persist(task);
      } else {
        task.status = "completed";
        task.totalBytes = task.totalBytes ?? task.receivedBytes;
        task.speedEma = 0;
        await this.persist(task);
      }
    } catch (err) {
      if (task.stopRequested === "cancel") return;
      if (task.stopRequested === "pause") {
        task.status = "paused";
        await this.persist(task);
      } else {
        task.status = "error";
        task.error = faErrorMessage(err);
        task.speedEma = 0;
        await this.persist(task);
      }
    } finally {
      const stop = task.stopRequested;
      task.controller = null;
      task.stopRequested = null;
      if (stop === "cancel") {
        this.tasks.delete(task.id);
        await this.cleanupDisk(task.id, task.filePath).catch(() => undefined);
      } else {
        this.pump();
      }
    }
  }

  private async runNetwork(task: Task): Promise<void> {
    const controller = task.controller!;
    const headers: Record<string, string> = {
      "User-Agent": "DanloodBan/1.0",
      Accept: "*/*",
    };
    let append = false;
    if (task.receivedBytes > 0 && fs.existsSync(task.filePath)) {
      headers.Range = `bytes=${task.receivedBytes}-`;
      append = true;
    }
    const res = await fetch(task.url, {
      headers,
      signal: controller.signal,
      redirect: "follow",
    });
    let flags: "a" | "w" = "w";
    if (res.status === 206 && append) {
      flags = "a";
    } else if (res.status === 200) {
      if (append) {
        task.receivedBytes = 0;
        append = false;
      }
    } else {
      res.body?.cancel().catch(() => undefined);
      throw new Error(`HTTP ${res.status}`);
    }
    let total: number | null = null;
    const contentRange = res.headers.get("content-range");
    if (contentRange) {
      const match = /\/(\d+)\s*$/.exec(contentRange);
      if (match) total = Number(match[1]);
    } else if (res.headers.get("content-length")) {
      total = Number(res.headers.get("content-length")) + task.receivedBytes;
    }
    if (total != null && Number.isFinite(total) && total > 0) {
      task.totalBytes = total;
    }
    const contentType = res.headers.get("content-type");
    if (contentType && !contentType.includes("octet-stream")) {
      task.contentType = contentType.split(";")[0];
    }
    if (!res.body) throw new Error("پاسخ سرور بدون بدنه بود");
    await this.consume(task, res.body, flags, controller);
  }

  private async runLocal(task: Task): Promise<void> {
    const name = decodeURIComponent(task.url.slice("sample://".length)).replace(
      /[\\/]/g,
      ""
    );
    const sourcePath = path.join(SAMPLES_ROOT, name);
    if (!fs.existsSync(sourcePath)) {
      throw new Error("فایل نمونه روی سرور یافت نشد");
    }
    const total = fs.statSync(sourcePath).size;
    task.totalBytes = total;
    task.contentType = "video/mp4";
    let flags: "a" | "w" = "w";
    let start = 0;
    if (task.receivedBytes > 0 && task.receivedBytes < total && fs.existsSync(task.filePath)) {
      start = task.receivedBytes;
      flags = "a";
    } else {
      task.receivedBytes = 0;
    }
    const nodeStream = fs.createReadStream(sourcePath, {
      start,
      signal: task.controller!.signal,
    });
    await this.consume(task, nodeStream as unknown as AsyncIterable<Uint8Array>, flags, task.controller!);
  }

  private async consume(
    task: Task,
    source: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>,
    flags: "a" | "w",
    controller: AbortController
  ): Promise<void> {
    const out = fs.createWriteStream(task.filePath, { flags });
    let lastPersist = Date.now();
    task.samples = [{ t: Date.now(), b: task.receivedBytes }];

    const writeChunk = (chunk: Uint8Array) =>
      new Promise<void>((resolve, reject) => {
        if (out.write(chunk)) resolve();
        else {
          out.once("drain", resolve);
          out.once("error", reject);
        }
      });

    const handleChunk = async (chunk: Uint8Array) => {
      if (controller.signal.aborted) {
        // در برخی ران‌تایم‌ها سیگنال استریم‌ها نادیده گرفته می‌شود؛ این بررسی تضمین می‌کند توقف/حذف فوری اعمال شود
        throw new DOMException("The operation was aborted", "AbortError");
      }
      await writeChunk(chunk);
      task.receivedBytes += chunk.byteLength;
      this.recordSample(task);
      const now = Date.now();
      if (now - lastPersist > 1000) {
        lastPersist = now;
        await this.persist(task);
      }
      await this.throttle(task, chunk.byteLength, controller);
    };

    try {
      const webSource = source as ReadableStream<Uint8Array>;
      if (typeof webSource.getReader === "function") {
        const reader = webSource.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) await handleChunk(value);
          }
        } finally {
          reader.releaseLock();
        }
      } else {
        for await (const chunk of source as AsyncIterable<Uint8Array>) {
          if (chunk) await handleChunk(chunk);
        }
      }
      await new Promise<void>((resolve, reject) => {
        out.on("error", reject);
        out.end(() => resolve());
      });
    } catch (err) {
      out.destroy();
      throw err;
    }
  }

  private async throttle(
    task: Task,
    bytes: number,
    controller: AbortController
  ): Promise<void> {
    const limit = task.speedLimitKbps;
    if (!limit || limit <= 0) return;
    const interval = (bytes / (limit * 1024)) * 1000;
    const now = performance.now();
    if (task.nextTime === undefined || task.nextTime < now - 2000) {
      task.nextTime = now;
    }
    task.nextTime += interval;
    const delay = task.nextTime - performance.now();
    if (delay > 0) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(done, Math.min(delay, 1500));
        controller.signal.addEventListener("abort", done, { once: true });
        function done() {
          clearTimeout(timer);
          resolve();
        }
      });
    }
  }

  private recordSample(task: Task): void {
    const now = Date.now();
    task.samples.push({ t: now, b: task.receivedBytes });
    if (task.samples.length > 200) task.samples.shift();
    const cutoff = now - 2500;
    let first = task.samples[0];
    for (const sample of task.samples) {
      if (sample.t >= cutoff) {
        first = sample;
        break;
      }
    }
    const last = task.samples[task.samples.length - 1];
    const dt = last.t - first.t;
    if (dt > 200) {
      const instant = ((last.b - first.b) / dt) * 1000;
      task.speedEma = task.speedEma ? task.speedEma * 0.6 + instant * 0.4 : instant;
    }
  }

  private persist(task: Task, extra: Record<string, unknown> = {}): Promise<unknown> {
    return db.download
      .update({
        where: { id: task.id },
        data: {
          status: task.status,
          receivedBytes: BigInt(Math.max(0, Math.round(task.receivedBytes))),
          totalBytes:
            task.totalBytes == null ? null : BigInt(Math.round(task.totalBytes)),
          contentType: task.contentType,
          error: task.error,
          ...extra,
        },
      })
      .catch(() => undefined);
  }

  private view(task: Task): DownloadDTO {
    const speed =
      task.status === "downloading" ? Math.max(0, Math.round(task.speedEma)) : 0;
    const etaSeconds =
      task.status === "downloading" &&
      task.totalBytes != null &&
      task.speedEma > 1 &&
      task.totalBytes > task.receivedBytes
        ? Math.max(0, Math.round((task.totalBytes - task.receivedBytes) / task.speedEma))
        : null;
    return {
      id: task.id,
      url: task.url,
      filename: task.filename,
      status: task.status,
      receivedBytes: task.receivedBytes,
      totalBytes: task.totalBytes,
      speed,
      etaSeconds,
      error: task.error,
      contentType: task.contentType,
      createdAt: task.createdAt.toISOString(),
    };
  }
}

export const downloadManager = new DownloadManager();

// نگاشت وضعیت دانلودها بین ری‌استارت ماژول (HMR) حفظ می‌شود
void managerStore;
