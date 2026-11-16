"use client";

import { useState } from "react";
import { ClipboardPaste, Download, Film } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SAMPLES } from "@/lib/samples";

const LIMIT_OPTIONS = [
  { value: "0", label: "بدون محدودیت" },
  { value: "128", label: "۱۲۸ کیلوبایت بر ثانیه" },
  { value: "256", label: "۲۵۶ کیلوبایت بر ثانیه" },
  { value: "512", label: "۵۱۲ کیلوبایت بر ثانیه" },
  { value: "1024", label: "۱ مگابایت بر ثانیه" },
  { value: "2048", label: "۲ مگابایت بر ثانیه" },
];

interface AddDownloadBarProps {
  onAdd: (url: string, speedLimitKbps: number) => Promise<void> | void;
}

export function AddDownloadBar({ onAdd }: AddDownloadBarProps) {
  const [url, setUrl] = useState("");
  const [limit, setLimit] = useState("0");
  const [busy, setBusy] = useState(false);

  const submit = async (rawUrl?: string, rawLimit?: number) => {
    const target = (rawUrl ?? url).trim();
    if (!/^(https?:\/\/|sample:\/\/)/i.test(target)) {
      toast.error("لطفاً یک لینک معتبر وارد کنید");
      return;
    }
    setBusy(true);
    try {
      await onAdd(target, rawLimit ?? Number(limit));
      if (!rawUrl) setUrl("");
    } finally {
      setBusy(false);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setUrl(text.trim());
        toast.success("لینک از کلیپ‌بورد چسبانده شد");
      } else {
        toast.error("کلیپ‌بورد خالی است");
      }
    } catch {
      toast.error("دسترسی به کلیپ‌بورد ممکن نشد");
    }
  };

  return (
    <Card>
      <CardContent className="px-4 sm:px-6">
        <p className="mb-1 text-sm font-semibold">لینک جدید</p>
        <p className="mb-3 text-xs text-muted-foreground">
          لینک مستقیم ویدیو را بچسبانید؛ حین دانلود می‌توانید بخش‌های آماده را
          آنلاین تماشا کنید.
        </p>
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="flex flex-1 items-center gap-2">
            <Input
              dir="ltr"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="لینک دانلود فیلم یا سریال را اینجا بچسبانید..."
              aria-label="لینک دانلود"
              className="h-10 flex-1 font-mono text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              aria-label="چسباندن از کلیپ‌بورد"
              onClick={() => void pasteFromClipboard()}
            >
              <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <Select value={limit} onValueChange={setLimit}>
            <SelectTrigger
              className="h-10 w-full sm:w-[190px]"
              aria-label="محدودیت سرعت دانلود"
            >
              <SelectValue placeholder="محدودیت سرعت" />
            </SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" className="h-10 gap-2" disabled={busy}>
            <Download className="h-4 w-4" aria-hidden="true" />
            شروع دانلود
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            نمونه‌های آماده برای تست:
          </span>
          {SAMPLES.map((sample) => (
            <Button
              key={sample.url}
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full text-xs"
              disabled={busy}
              onClick={() => void submit(sample.url, sample.suggestedLimitKbps ?? 0)}
            >
              <Film className="h-3.5 w-3.5" aria-hidden="true" />
              {sample.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
