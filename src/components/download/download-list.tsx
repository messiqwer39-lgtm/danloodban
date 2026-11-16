"use client";

import {
  FileVideo,
  MonitorPlay,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DownloadDTO, DownloadStatus } from "@/lib/types";
import { faFormatBytes, faFormatEta, faFormatSpeed, faNum } from "@/lib/format";

const STATUS_META: Record<
  DownloadStatus,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
    className?: string;
  }
> = {
  queued: { label: "در صف", variant: "secondary" },
  downloading: { label: "در حال دانلود", variant: "default" },
  paused: {
    label: "متوقف شده",
    variant: "outline",
    className: "border-amber-500/40 text-amber-500",
  },
  completed: { label: "تکمیل شد", variant: "default" },
  error: { label: "خطا", variant: "destructive" },
};

interface DownloadListProps {
  downloads: DownloadDTO[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRemove: (id: string) => void;
}

export function DownloadList({
  downloads,
  selectedId,
  onSelect,
  onPause,
  onResume,
  onRemove,
}: DownloadListProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>صف دانلود</span>
          <Badge variant="secondary">{faNum(downloads.length)}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {downloads.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-10 text-center">
            <FileVideo className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
            <p className="text-sm font-medium">هنوز دانلودی وجود ندارد</p>
            <p className="text-xs text-muted-foreground">
              لینکی را اضافه کنید یا از نمونه‌های آماده استفاده کنید
            </p>
          </div>
        ) : (
          <TooltipProvider delayDuration={200}>
            <div className="nice-scrollbar flex max-h-[480px] flex-col gap-3 overflow-y-auto pe-1">
              {downloads.map((item) => (
                <DownloadCard
                  key={item.id}
                  download={item}
                  selected={item.id === selectedId}
                  onSelect={onSelect}
                  onPause={onPause}
                  onResume={onResume}
                  onRemove={onRemove}
                />
              ))}
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}

interface DownloadCardProps {
  download: DownloadDTO;
  selected: boolean;
  onSelect: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRemove: (id: string) => void;
}

function DownloadCard({
  download: d,
  selected,
  onSelect,
  onPause,
  onResume,
  onRemove,
}: DownloadCardProps) {
  const pct = d.totalBytes
    ? Math.min(100, Math.round((d.receivedBytes / d.totalBytes) * 100))
    : 0;
  const meta = STATUS_META[d.status];

  return (
    <div
      onClick={() => onSelect(d.id)}
      className={`cursor-pointer rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 ${
        selected ? "border-primary/60 bg-primary/5 ring-1 ring-primary/60" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <FileVideo className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {d.filename}
        </span>
        <Badge variant={meta.variant} className={meta.className}>
          {meta.label}
        </Badge>
      </div>
      <div
        dir="ltr"
        className="mt-1 truncate text-right text-[11px] text-muted-foreground"
        title={d.url}
      >
        {d.url}
      </div>

      <div dir="ltr" className="mt-3">
        <Progress value={pct} className="h-2" aria-label={`پیشرفت دانلود ${faNum(pct)} درصد`} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="shrink-0">
          {faFormatBytes(d.receivedBytes)} از{" "}
          {d.totalBytes ? faFormatBytes(d.totalBytes) : "حجم نامشخص"} ({faNum(pct)}٪)
        </span>
        <span className="min-w-0 truncate">
          {d.status === "downloading" && (
            <>
              {faFormatSpeed(d.speed)} · زمان باقی‌مانده: {faFormatEta(d.etaSeconds)}
            </>
          )}
          {d.status === "queued" && "در انتظار شروع"}
          {d.status === "paused" && "متوقف شده"}
          {d.status === "error" && (
            <span className="text-destructive">{d.error || "خطای نامشخص"}</span>
          )}
          {d.status === "completed" && "آماده پخش"}
        </span>
      </div>

      <div
        className="mt-3 flex items-center gap-1 border-t pt-2"
        onClick={(event) => event.stopPropagation()}
      >
        {d.status === "downloading" && (
          <IconAction label="توقف موقت" onClick={() => onPause(d.id)}>
            <Pause className="h-4 w-4" aria-hidden="true" />
          </IconAction>
        )}
        {(d.status === "paused" || d.status === "queued" || d.status === "error") && (
          <IconAction label="ادامه دانلود" onClick={() => onResume(d.id)}>
            <Play className="h-4 w-4" aria-hidden="true" />
          </IconAction>
        )}
        {d.receivedBytes > 0 && d.status !== "queued" && (
          <IconAction
            label="پخش آنلاین"
            onClick={() => onSelect(d.id)}
            highlight={d.status === "completed"}
          >
            <MonitorPlay className="h-4 w-4" aria-hidden="true" />
          </IconAction>
        )}
        <div className="ms-auto">
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    aria-label="حذف دانلود"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent>حذف</TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>حذف دانلود</AlertDialogTitle>
                <AlertDialogDescription>
                  «{d.filename}» به همراه فایل دانلودشده از دیسک حذف می‌شود. مطمئن
                  هستید؟
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>انصراف</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={() => onRemove(d.id)}
                >
                  حذف
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  highlight = false,
  children,
}: {
  label: string;
  onClick: () => void;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={highlight ? "secondary" : "ghost"}
          size="icon"
          className={
            highlight
              ? "h-8 w-8 text-primary hover:bg-primary/10"
              : "h-8 w-8 text-muted-foreground hover:text-foreground"
          }
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
