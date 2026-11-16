# دانلودبان (DanloodBan)

مدیر دانلود هوشمند فیلم و سریال با **پیش‌نمایش آنلاین حین دانلود** — تجربه‌ای شبیه IDM، مخصوص فیلم و سریال.

## امکانات

- افزودن لینک مستقیم ویدیو و شروع دانلود با یک کلیک (یا چسباندن از کلیپ‌بورد)
- دانلود با نوار پیشرفت زنده، سرعت لحظه‌ای و زمان تخمینی باقی‌مانده
- **پیش‌نمایش آنلاین از بخش دانلودشده**: همان لحظه که دانلود شروع می‌شود می‌توانید بخش‌های آماده را تماشا کنید
- پخش‌کننده کامل: play/pause، سکو، ۱۰ ثانیه جلو/عقب، صدا، سرعت پخش (۰.۵x تا ۲x)، تصویردرتصویر، تمام‌صفحه، میان‌برهای کیبورد
- گارد هوشمند سکو: جلوگیری از پرش به بخش‌های هنوز دانلودنشده با پیام فارسی
- محدودیت سرعت دانلود (تا ۲ مگابایت بر ثانیه) برای دمو و کنترل پهنای باند
- توقف/ادامه دانلود (Resume با HTTP Range)، صف دانلود با حداکثر ۳ دانلود هم‌زمان
- پشتیبانی کامل RTL و اعداد فارسی، پوسته تاریک/روشن
- استریم استاندارد HTTP با پشتیبانی کامل Range برای پخش روان

## معماری

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui
- موتور دانلود: `src/lib/download-manager.ts` (صف، throttle، resume، persist در SQLite با Prisma)
- استریم: `src/app/api/downloads/[id]/stream/route.ts` (HTTP 206 + طول نهایی فایل برای نگاشت صحیح زمان/بایت)
- اپ ویندوز: `electron/main.js` — سرور Next standalone را داخل خود اپ اجرا و در BrowserWindow نمایش می‌دهد

## اجرای نسخه وب

```bash
bun install
bun run db:push
bun run dev
```

## ساخت EXE ویندوز

روی پوش تگ `v*` به‌طور خودکار GitHub Actions (ویندوز واقعی) بیلد می‌گیرد:

```bash
git tag v1.0.1
git push origin v1.0.1
```

خروجی در بخش **Releases** مخزن قرار می‌گیرد:
- `DanloodBan-Setup-1.0.1.exe` (نصب‌کننده NSIS)
- `DanloodBan-Portable-1.0.1.exe` (نسخه قابل حمل)

بیلد دستی: از تب Actions → انتخاب workflow «Build Windows EXE» → Run workflow.

بیلد محلی (روی ویندوز):

```bash
bun install
bunx prisma generate
set DATABASE_URL=file:./db/build.db
bun run build
cd electron && npm install && npx electron-builder --win nsis portable
```

## ساختار پوشه‌ها

```
src/lib/download-manager.ts   موتور دانلود (صف، سرعت، توقف/ادامه)
src/app/api/downloads/**      APIهای مدیریت دانلود و استریم
src/components/download/**    رابط کاربری (لیست، پخش‌کننده، نوار افزودن)
electron/main.js              نقطه ورود اپ دسکتاپ ویندوز
.github/workflows/build-exe.yml  بیلد خودکار EXE روی ویندوز
storage/samples/              ویدیوهای نمونه (با ffmpeg ساخته می‌شوند)
```

## نکته‌ها

- لینک‌های نمونه با اسکیمه `sample://` به فایل‌های محلی `storage/samples` اشاره دارند (برای دمو آفلاین). برای دانلود واقعی، لینک مستقیم `https://` بچسبانید.
- در نسخه دسکتاپ، دیتابیس و دانلودها در پوشه userData ویندوز ذخیره می‌شوند.
