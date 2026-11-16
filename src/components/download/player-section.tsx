"use client";

import { MonitorPlay } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoPlayer } from "@/components/download/video-player";
import type { DownloadDTO } from "@/lib/types";

export function PlayerSection({ download }: { download: DownloadDTO | null }) {
  const playable = !!download && download.receivedBytes > 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MonitorPlay className="h-5 w-5 text-primary" aria-hidden="true" />
          پیش‌نمایش آنلاین از بخش دانلودشده
        </CardTitle>
        {download?.status === "downloading" && (
          <Badge
            variant="outline"
            className="gap-1.5 border-emerald-500/40 text-emerald-500"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            زنده
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {!playable ? (
          <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center">
            <MonitorPlay
              className="h-12 w-12 text-muted-foreground/50"
              aria-hidden="true"
            />
            <p className="text-sm font-medium">
              برای تماشای آنلاین، یک دانلود را انتخاب کنید
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">
              همان لحظه که دانلود شروع شود، می‌توانید بخش‌های دانلودشده را
              همین‌جا ببینید.
            </p>
          </div>
        ) : (
          <VideoPlayer download={download} key={download.id} />
        )}
      </CardContent>
    </Card>
  );
}
