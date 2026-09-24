import Link from "next/link";
import { Button } from "@goproceed/ui/components";

/**
 * The app's 404 for any unmatched URL (the root `app/not-found.tsx`, per the
 * installed Next 16.3.1 guide, `03-file-conventions/not-found.md`: «the root
 * `app/not-found.js` … handle[s] any unmatched URLs for your whole
 * application»). Rendered inside the root layout, so it is `lang="uk"` and in
 * the system's face.
 *
 * WHY IT EXISTS NOW (DEV-035, 2026-09-23). The owner retired the field PWA
 * whose screens lived at `/` and `/a/{id}`. A foreman's old bookmark or a
 * pasted `/a/{id}` link now matches nothing; without this file Next answered
 * with its built-in English page. The field client is `apps/mobile` (its web
 * export, and the Telegram channel once it is enabled) — this page does not
 * name its address, because hostnames are still tokens (BL-004).
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <div className="flex max-w-md flex-col items-start gap-4">
        <h1 className="text-h2 font-semibold text-ink">Сторінку не знайдено</h1>
        <p className="text-body text-ink-muted">
          Такої адреси в кабінеті немає — можливо, посилання застаріло.
        </p>
        <Button asChild variant="brand">
          <Link href="/">До кабінету</Link>
        </Button>
      </div>
    </main>
  );
}
