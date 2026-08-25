"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, Camera, Check, RotateCcw, ShieldCheck, Wifi } from "lucide-react";
import { landingContent } from "../../content/landing-content";

export function FieldReviewVisual() {
  const handoffRef = useRef<HTMLDivElement>(null);
  const [handoffDrawn, setHandoffDrawn] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setHandoffDrawn(true);
      return;
    }

    const node = handoffRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setHandoffDrawn(true);
        observer.disconnect();
      },
      { threshold: 0.35 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <figure aria-label="Передача EV-0248 з майданчика до технічного нагляду" className="relative grid gap-5 wide:grid-cols-[0.72fr_0.38fr_0.9fr] wide:items-center wide:gap-0">
      <figcaption className="sr-only">Фото з телефону разом із вимогою передається у вузький зовнішній перегляд.</figcaption>

      <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-section border border-line-inverse bg-surface text-ink shadow-float">
        <div className="flex min-h-12 items-center justify-between border-b border-line px-5">
          <span className="index-label text-ink-muted">Польова робота · W-014</span>
          <span className="flex items-center gap-2 text-micro font-semibold text-status-ready-fg">
            <Wifi aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
            Online
          </span>
        </div>
        <div className="relative aspect-[4/3]">
          <Image
            src="/images/cable-tray-evidence.png"
            alt="Кабельний лоток у польовому сценарії"
            fill
            sizes="390px"
            className="object-cover"
          />
          <span className="absolute bottom-3 left-3 rounded-control bg-inverse px-3 py-2 text-meta font-semibold text-on-inverse">
            EV-0248 · 14:32
          </span>
        </div>
        <div className="p-5">
          <p className="index-label text-ink-muted">R-041 · потрібно 3 матеріали</p>
          <p className="mt-3 text-body font-semibold text-ink">Вузол кріплення крупним планом</p>
          <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
            <Camera aria-hidden="true" className="size-5 text-ink-muted" strokeWidth={1.75} />
            <span className="text-meta text-ink-muted">Оригінал завантажено</span>
            <span className="ml-auto text-meta font-semibold text-status-ready-fg">3 / 3</span>
          </div>
        </div>
      </div>

      <div ref={handoffRef} className="relative mx-auto flex w-full max-w-[300px] items-center justify-center py-4 wide:h-full wide:max-w-none wide:py-0" aria-hidden="true">
        <span
          data-handoff-line="true"
          className={`absolute left-0 right-0 top-1/2 h-px origin-left bg-line-inverse transition-transform duration-slow ease-out motion-reduce:scale-x-100 motion-reduce:transition-none ${
            handoffDrawn ? "scale-x-100" : "scale-x-0"
          }`}
        />
        <span className={`relative grid size-14 place-items-center rounded-pill border border-action-signal bg-inverse text-action-signal shadow-overlay transition-[opacity,transform] delay-150 duration-slow ease-out motion-reduce:scale-100 motion-reduce:opacity-100 motion-reduce:transition-none ${
          handoffDrawn ? "scale-100 opacity-100" : "scale-90 opacity-0"
        }`}>
          <ArrowRight className="size-5 rotate-90 wide:rotate-0" strokeWidth={1.75} />
        </span>
      </div>

      <div className="border border-line-strong bg-surface text-ink shadow-float">
        <header className="flex items-center gap-3 border-b border-line px-5 py-4 md:px-6">
          <ShieldCheck aria-hidden="true" className="size-5 text-ink-muted" strokeWidth={1.75} />
          <div>
            <p className="index-label text-ink-muted">Зовнішній розгляд</p>
            <p className="mt-1 text-meta font-semibold">{landingContent.fieldReview.reviewLabel}</p>
          </div>
          <span className="ml-auto rounded-pill border border-status-review-line bg-status-review px-3 py-1 text-micro font-semibold text-status-review-fg">
            На рішення
          </span>
        </header>
        <div className="grid md:grid-cols-[0.92fr_1.08fr]">
          <div className="relative min-h-[280px] border-b border-line md:border-b-0 md:border-r">
            <Image
              src="/images/cable-tray-evidence.png"
              alt="Доказ EV-0248 у перегляді технічного нагляду"
              fill
              sizes="(max-width: 768px) 100vw, 360px"
              className="object-cover"
            />
          </div>
          <div className="p-5 md:p-6">
            <p className="index-label text-ink-muted">R-041 · EV-0248</p>
            <p className="mt-4 text-h3 font-semibold leading-snug">Кабельний лоток до закриття стелі</p>
            <dl className="mt-6 space-y-3 text-meta">
              <div className="flex justify-between gap-4 border-t border-line pt-3"><dt className="text-ink-muted">Робота</dt><dd className="font-semibold">W-014</dd></div>
              <div className="flex justify-between gap-4 border-t border-line pt-3"><dt className="text-ink-muted">Місце</dt><dd className="font-semibold">ВРУ-1</dd></div>
              <div className="flex justify-between gap-4 border-t border-line pt-3"><dt className="text-ink-muted">Матеріали</dt><dd className="font-semibold">3 з 3</dd></div>
            </dl>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-line-strong text-meta font-semibold text-ink">
                <RotateCcw aria-hidden="true" className="size-4" strokeWidth={1.75} /> Повернути
              </span>
              <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-action-signal text-meta font-semibold text-action-signal-fg">
                <Check aria-hidden="true" className="size-4" strokeWidth={2} /> Прийняти
              </span>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
