import { OtpForm } from "./otp-form";

type LoginPageProps = {
  // Next 16's App Router hands page-level `searchParams` in as a Promise
  // (see e.g. the `params: Promise<...>` routes under app/v1) — awaited
  // below, not destructured directly.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const rawNext = params.next;
  // A repeated `?next=a&next=b` parses to a string[]; anything but a single
  // plain string is treated as absent. This value is still fully untrusted
  // attacker-controlled text either way — it is handed to `OtpForm` as-is,
  // and validated once, at the point it is actually used to navigate. See
  // `safeNext` in src/lib/safe-next.ts for why validation lives there (a
  // pure, unit-testable module) and not here.
  const next = typeof rawNext === "string" ? rawNext : undefined;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 font-semibold text-ink">GoProceed</h1>
        <p className="text-body text-ink-secondary">
          Вхід за одноразовим кодом, який ми надішлемо на вашу електронну пошту.
        </p>
      </div>
      <OtpForm next={next} />
    </main>
  );
}
