const faFormatter = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });

export function faNum(n: number): string {
  if (!Number.isFinite(n)) return "-";
  return faFormatter.format(Math.round(n));
}

export function faFormatBytes(n: number, fracDigits = 1): string {
  if (!Number.isFinite(n) || n < 0) return "-";
  const units = ["بایت", "کیلوبایت", "مگابایت", "گیگابایت", "ترابایت"];
  let value = n;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const formatted = new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: unitIndex === 0 ? 0 : fracDigits,
    minimumFractionDigits: 0,
  }).format(value);
  return `${formatted} ${units[unitIndex]}`;
}

export function faFormatSpeed(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return "۰";
  return `${faFormatBytes(bytesPerSec)} بر ثانیه`;
}

export function faFormatEta(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `${faNum(seconds)} ثانیه`;
  if (seconds < 3600) return `${faNum(Math.round(seconds / 60))} دقیقه`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (minutes === 0) return `${faNum(hours)} ساعت`;
  return `${faNum(hours)} ساعت و ${faNum(minutes)} دقیقه`;
}

export function faTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "--:--";
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  const two = (v: number) => new Intl.NumberFormat("fa-IR", { minimumIntegerDigits: 2 }).format(v);
  if (h > 0) return `${two(h)}:${two(m)}:${two(s)}`;
  return `${two(m)}:${two(s)}`;
}
