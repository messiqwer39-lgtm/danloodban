export interface SampleItem {
  label: string;
  url: string;
  suggestedLimitKbps?: number;
}

// ویدیوهای نمونه محلی که با ffmpeg ساخته شده‌اند و توسط موتور دانلود
// به صورت شبیه‌سازی‌شدهٔ شبکه دانلود می‌شوند (اسکیمهٔ sample://)
export const SAMPLES: SampleItem[] = [
  {
    label: "فیلم نمونه ۱ — تست پیش‌نمایش زنده",
    url: "sample://sample-1.mp4",
    suggestedLimitKbps: 128,
  },
  {
    label: "فیلم نمونه ۲",
    url: "sample://sample-2.mp4",
  },
  {
    label: "فیلم نمونه ۳",
    url: "sample://sample-3.mp4",
  },
];
