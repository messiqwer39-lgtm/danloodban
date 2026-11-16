"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Gauge,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import type { DownloadDTO } from "@/lib/types";
import { faNum, faTime } from "@/lib/format";

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const faRate = (r: number) => {
  const formatted = new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: 2,
  }).format(r);
  return `${formatted}x`;
};

export function VideoPlayer({ download }: { download: DownloadDTO }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSafeTimeRef = useRef(0);
  const lastNudgeBytesRef = useRef(download.receivedBytes);
  const pendingSeekRef = useRef<number | null>(null);
  const wasPlayingRef = useRef(false);

  const [reloadKey, setReloadKey] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dragPct, setDragPct] = useState<number | null>(null);

  const isLive = download.status === "downloading";
  const downloadedPct = download.totalBytes
    ? Math.min(100, (download.receivedBytes / download.totalBytes) * 100)
    : 0;

  const estAvailableSec = useMemo(() => {
    if (download.status === "completed") return Infinity;
    if (download.totalBytes && duration) {
      return duration * (download.receivedBytes / download.totalBytes);
    }
    return Infinity;
  }, [download.status, download.receivedBytes, download.totalBytes, duration]);

  const resync = useCallback((restore: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    wasPlayingRef.current = restore ? !video.paused : false;
    pendingSeekRef.current = restore ? video.currentTime : null;
    setReloadKey((k) => k + 1);
  }, []);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    const pending = pendingSeekRef.current;
    pendingSeekRef.current = null;
    if (pending != null) {
      try {
        video.currentTime = pending;
      } catch {
        // جابه‌جایی ممکن است هنوز مجاز نباشد
      }
    }
    if (wasPlayingRef.current) {
      void video.play().catch(() => undefined);
    }
  };

  const onTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const t = video.currentTime;
    const safe = Math.min(t, estAvailableSec);
    lastSafeTimeRef.current = Number.isFinite(safe) ? safe : t;
    setCurrentTime(t);
  };

  const onSeeking = () => {
    const video = videoRef.current;
    if (!video) return;
    if (
      download.status !== "completed" &&
      Number.isFinite(estAvailableSec) &&
      video.currentTime > estAvailableSec + 0.5
    ) {
      video.currentTime = lastSafeTimeRef.current;
      toast.warning("این بخش هنوز دانلود نشده است");
    }
  };

  const onStall = () => {
    if (download.status !== "downloading") return;
    if (download.receivedBytes - lastNudgeBytesRef.current > 100_000) {
      lastNudgeBytesRef.current = download.receivedBytes;
      const video = videoRef.current;
      wasPlayingRef.current = video ? !video.paused : true;
      pendingSeekRef.current = video ? video.currentTime : null;
      setReloadKey((k) => k + 1);
    }
  };

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => {
        toast.info("در حال آماده‌سازی بخش دانلودشده... چند لحظه صبر کنید");
      });
    } else {
      video.pause();
    }
  }, []);

  const applySeek = useCallback(
    (pct: number) => {
      const video = videoRef.current;
      if (!video || !duration) return;
      const target = (pct / 100) * duration;
      if (
        download.status !== "completed" &&
        Number.isFinite(estAvailableSec) &&
        target > estAvailableSec + 0.5
      ) {
        toast.warning("این بخش هنوز دانلود نشده است");
        return;
      }
      video.currentTime = Math.max(0, Math.min(target, duration - 0.05));
    },
    [duration, download.status, estAvailableSec]
  );

  const skip = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video || !duration) return;
      const target = video.currentTime + delta;
      if (
        download.status !== "completed" &&
        Number.isFinite(estAvailableSec) &&
        target > estAvailableSec - 0.2
      ) {
        toast.warning("این بخش هنوز دانلود نشده است");
        video.currentTime = Math.max(
          0,
          Math.min(lastSafeTimeRef.current, estAvailableSec - 0.2)
        );
        return;
      }
      video.currentTime = Math.max(0, Math.min(target, duration - 0.05));
    },
    [duration, download.status, estAvailableSec]
  );

  const toggleFullscreen = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void element.requestFullscreen().catch(() => {
        toast.error("حالت تمام‌صفحه ممکن نشد");
      });
    }
  }, []);

  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      } else {
        toast.error("مرورگر شما از تصویر در تصویر پشتیبانی نمی‌کند");
      }
    } catch {
      toast.error("تصویر در تصویر ممکن نشد");
    }
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }
    switch (event.key) {
      case " ":
      case "k":
        event.preventDefault();
        togglePlay();
        break;
      case "ArrowLeft":
        event.preventDefault();
        skip(-5);
        break;
      case "ArrowRight":
        event.preventDefault();
        skip(5);
        break;
      case "m": {
        const video = videoRef.current;
        if (video) video.muted = !video.muted;
        break;
      }
      case "f":
        toggleFullscreen();
        break;
      default:
        break;
    }
  };

  const sliderPct = dragPct ?? (duration ? (currentTime / duration) * 100 : 0);

  return (
    <div ref={containerRef} onKeyDown={handleKeyDown} tabIndex={0} className="outline-none">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-medium">
          {download.filename}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {download.totalBytes
            ? `دانلود شده: ${faNum(downloadedPct)}٪`
            : "در حال تشخیص حجم..."}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-xl border bg-black">
        <video
          key={reloadKey}
          ref={videoRef}
          src={`/api/downloads/${download.id}/stream`}
          preload="metadata"
          playsInline
          className="aspect-video w-full"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={onTimeUpdate}
          onDurationChange={() => {
            const video = videoRef.current;
            if (video) setDuration(Number.isFinite(video.duration) ? video.duration : 0);
          }}
          onSeeking={onSeeking}
          onWaiting={onStall}
          onStalled={onStall}
          onPlay={() => {
            setPlaying(true);
            wasPlayingRef.current = true;
          }}
          onPause={() => {
            setPlaying(false);
            wasPlayingRef.current = false;
          }}
          onEnded={() => setPlaying(false)}
          onVolumeChange={() => {
            const video = videoRef.current;
            if (!video) return;
            setVolume(video.volume);
            setMuted(video.muted);
          }}
          onRateChange={() => {
            const video = videoRef.current;
            if (video) setRate(video.playbackRate);
          }}
        />

        {!playing && (
          <button
            type="button"
            aria-label="پخش"
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg transition-transform hover:scale-105">
              <Play className="h-8 w-8" aria-hidden="true" />
            </span>
          </button>
        )}

        {isLive && (
          <div
            dir="ltr"
            className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            پخش زنده از بخش دانلودشده
          </div>
        )}
      </div>

      <div dir="ltr" className="flex flex-col gap-2 rounded-xl border border-t-0 bg-card p-3">
        <div dir="ltr" className="relative flex h-6 w-full items-center">
          <div className="pointer-events-none absolute inset-x-0 h-1.5 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-400/40 transition-[width] duration-500"
              style={{ width: `${downloadedPct}%` }}
            />
          </div>
          <Slider
            className="absolute inset-x-0 [&_[data-slot=slider-track]]:bg-transparent [&_[data-slot=slider-range]]:bg-primary/70"
            value={[Math.max(0, Math.min(100, sliderPct))]}
            max={100}
            step={0.1}
            aria-label="نوار زمان پخش"
            onValueChange={(values) => setDragPct(values[0])}
            onValueCommit={(values) => {
              setDragPct(null);
              applySeek(values[0]);
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 hover:bg-primary/10 hover:text-primary"
            aria-label={playing ? "توقف پخش" : "پخش"}
            onClick={togglePlay}
          >
            {playing ? (
              <Pause className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Play className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground"
            aria-label="۱۰ ثانیه عقب"
            onClick={() => skip(-10)}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground"
            aria-label="۱۰ ثانیه جلو"
            onClick={() => skip(10)}
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
          </Button>

          <span dir="ltr" className="font-mono text-xs tabular-nums text-muted-foreground">
            {faTime(currentTime)} / {duration ? faTime(duration) : "--:--"}
          </span>

          <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground"
            aria-label={muted ? "صدا فعال" : "بی‌صدا"}
            onClick={() => {
              const video = videoRef.current;
              if (video) video.muted = !video.muted;
            }}
          >
            {muted ? (
              <VolumeX className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
          <Slider
            dir="ltr"
            className="w-20"
            value={[muted ? 0 : Math.round(volume * 100)]}
            max={100}
            step={1}
            aria-label="میزان صدا"
            onValueChange={(values) => {
              const video = videoRef.current;
              if (!video) return;
              video.volume = values[0] / 100;
              if (values[0] > 0) video.muted = false;
            }}
          />

          <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 px-2 text-muted-foreground"
                aria-label="سرعت پخش"
              >
                <Gauge className="h-4 w-4" aria-hidden="true" />
                <span dir="ltr" className="font-mono text-xs">{faRate(rate)}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent dir="ltr" align="start">
              {RATES.map((value) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => {
                    const video = videoRef.current;
                    if (video) video.playbackRate = value;
                  }}
                  className={value === rate ? "text-primary" : ""}
                >
                  {faRate(value)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground"
            aria-label="تصویر در تصویر"
            onClick={() => void togglePip()}
          >
            <PictureInPicture2 className="h-4 w-4" aria-hidden="true" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 ms-auto text-muted-foreground"
            aria-label={isFullscreen ? "خروج از تمام‌صفحه" : "تمام‌صفحه"}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground"
            aria-label="همگام‌سازی مجدد پخش"
            onClick={() => resync(true)}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Space: پخش/توقف — فلش چپ و راست: جابه‌جایی ۵ ثانیه — M: بی‌صدا — F:
        تمام‌صفحه
      </p>
    </div>
  );
}
