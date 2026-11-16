"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Clapperboard,
  FolderDown,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddDownloadBar } from "@/components/download/add-download-bar";
import { StatsRow } from "@/components/download/stats-row";
import { DownloadList } from "@/components/download/download-list";
import { PlayerSection } from "@/components/download/player-section";
import type { DownloadDTO } from "@/lib/types";
import { faFormatSpeed } from "@/lib/format";

export default function Home() {
  const [downloads, setDownloads] = useState<DownloadDTO[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/downloads", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { downloads?: DownloadDTO[] };
        if (alive && Array.isArray(data.downloads)) {
          setDownloads(data.downloads);
        }
      } catch {
        // بک‌اند هنوز آماده نیست؛ بی‌صدا رد می‌شویم
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 800);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const add = useCallback(async (url: string, speedLimitKbps: number) => {
    try {
      const res = await fetch("/api/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, speedLimitKbps }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        download?: DownloadDTO;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error || "شروع دانلود ممکن نشد");
        return;
      }
      toast.success("دانلود شروع شد");
      if (data.download?.id) setSelectedId(data.download.id);
    } catch {
      toast.error("ارتباط با سرور برقرار نشد");
    }
  }, []);

  const patch = useCallback(async (id: string, action: "pause" | "resume") => {
    try {
      const res = await fetch(`/api/downloads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || "عملیات ناموفق بود");
        return;
      }
      toast.success(action === "pause" ? "دانلود متوقف شد" : "دانلود ادامه یافت");
    } catch {
      toast.error("ارتباط با سرور برقرار نشد");
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/downloads/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("حذف دانلود ناموفق بود");
        return;
      }
      toast.success("دانلود حذف شد");
      setSelectedId((current) => (current === id ? null : current));
    } catch {
      toast.error("ارتباط با سرور برقرار نشد");
    }
  }, []);

  const totalSpeed = downloads.reduce(
    (sum, d) => sum + (d.status === "downloading" ? d.speed : 0),
    0
  );
  const selected = downloads.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Clapperboard className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">دانلودبان</h1>
              <p className="text-xs text-muted-foreground">
                مدیر دانلود هوشمند فیلم و سریال
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {totalSpeed > 0 && (
              <Badge
                variant="outline"
                className="gap-1.5 border-primary/40 text-primary"
              >
                <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                {faFormatSpeed(totalSpeed)}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="تغییر پوسته روشن و تاریک"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              <Sun
                className="hidden h-5 w-5 dark:block"
                aria-hidden="true"
              />
              <Moon
                className="h-5 w-5 dark:hidden"
                aria-hidden="true"
              />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6">
        <AddDownloadBar onAdd={add} />
        <StatsRow downloads={downloads} />
        <section
          aria-label="مدیریت دانلود و پخش"
          className="grid items-start gap-6 lg:grid-cols-5"
        >
          <div className="order-2 lg:order-1 lg:col-span-2">
            <DownloadList
              downloads={downloads}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onPause={(id) => void patch(id, "pause")}
              onResume={(id) => void patch(id, "resume")}
              onRemove={(id) => void remove(id)}
            />
          </div>
          <div className="order-1 lg:order-2 lg:col-span-3">
            <PlayerSection download={selected} />
          </div>
        </section>
      </main>

      <footer className="mt-auto border-t py-4">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 text-sm text-muted-foreground sm:flex-row">
          <span>دانلودبان © ۱۴۰۴ — تجربه‌ای شبیه IDM، مخصوص فیلم و سریال</span>
          <a
            href="/downloads/danloodban-source.zip"
            download
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:text-foreground"
          >
            <FolderDown className="h-4 w-4" aria-hidden="true" />
            دانلود سورس‌کد پروژه (ZIP)
          </a>
        </div>
      </footer>
    </div>
  );
}
