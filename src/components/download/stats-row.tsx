"use client";

import { Archive, Film, Gauge, LoaderCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DownloadDTO } from "@/lib/types";
import { faFormatBytes, faFormatSpeed, faNum } from "@/lib/format";

export function StatsRow({ downloads }: { downloads: DownloadDTO[] }) {
  const active = downloads.filter(
    (d) => d.status === "downloading" || d.status === "queued"
  ).length;
  const totalReceived = downloads.reduce((sum, d) => sum + d.receivedBytes, 0);
  const speed = downloads.reduce(
    (sum, d) => sum + (d.status === "downloading" ? d.speed : 0),
    0
  );

  const items = [
    { label: "کل دانلودها", value: faNum(downloads.length), Icon: Film, tone: "bg-primary/10 text-primary" },
    { label: "در حال دانلود", value: faNum(active), Icon: LoaderCircle, tone: "bg-emerald-500/10 text-emerald-500" },
    { label: "حجم دریافت‌شده", value: faFormatBytes(totalReceived), Icon: Archive, tone: "bg-amber-500/10 text-amber-500" },
    { label: "سرعت لحظه‌ای", value: faFormatSpeed(speed), Icon: Gauge, tone: "bg-teal-500/10 text-teal-500" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(({ label, value, Icon, tone }) => (
        <Card key={label} className="py-3">
          <CardContent className="flex items-center gap-3 px-4">
            <div className={`rounded-lg p-2 ${tone}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs text-muted-foreground">{label}</div>
              <div className="truncate text-sm font-semibold">{value}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
