"use client";

import { type FormEvent, useState } from "react";
import { Check, Clipboard, Mail, Send } from "lucide-react";
import { landingContent } from "../content/landing-content";
import {
  buildPilotMailto,
  buildPilotMessage,
  type PilotMailFields,
} from "../content/pilot-mail";

const controlClass =
  "mt-2 min-h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-data text-ink outline-none transition-[border-color,box-shadow] duration-fast placeholder:text-ink-subtle focus:border-focus focus:shadow-focus";

function readField(data: FormData, name: keyof PilotMailFields): string {
  return String(data.get(name) ?? "").trim();
}

export function PilotEnquiryForm() {
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const fields: PilotMailFields = {
      name: readField(data, "name"),
      company: readField(data, "company"),
      contact: readField(data, "contact"),
      role: readField(data, "role"),
      context: readField(data, "context"),
    };

    const nextMessage = buildPilotMessage(fields);
    setMessage(nextMessage);
    setCopied(false);
    setStatus("Поштовий клієнт відкрито. Перевірте лист і натисніть «Надіслати».");
    window.location.assign(buildPilotMailto(fields));
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setStatus("Текст листа скопійовано. Вставте його у зручний канал зв’язку.");
    } catch {
      setCopied(false);
      setStatus("Не вдалося скопіювати автоматично. Виділіть текст листа нижче вручну.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface p-5 text-ink md:p-8" aria-label="Заявка на пілот GoProceed">
      <div className="flex items-center gap-3 border-b border-line pb-5">
        <Mail aria-hidden="true" className="size-5 text-ink-muted" strokeWidth={1.75} />
        <h3 className="text-h3 font-semibold">{landingContent.pilot.formTitle}</h3>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className="text-meta font-semibold text-ink">
          Ім’я
          <input
            name="name"
            type="text"
            autoComplete="name"
            required
            className={controlClass}
            placeholder="Як до вас звертатися"
          />
        </label>
        <label className="text-meta font-semibold text-ink">
          Компанія
          <input
            name="company"
            type="text"
            autoComplete="organization"
            className={controlClass}
            placeholder="Необов’язково"
          />
        </label>
        <label className="text-meta font-semibold text-ink">
          Контакт для відповіді
          <input
            name="contact"
            type="text"
            autoComplete="email"
            required
            className={controlClass}
            placeholder="Email, телефон або нік"
          />
        </label>
        <label className="text-meta font-semibold text-ink">
          Ваша роль
          <select name="role" defaultValue="" className={controlClass}>
            <option value="">Необов’язково</option>
            {landingContent.pilot.roles.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-5 block text-meta font-semibold text-ink">
        Який процес хочете перевірити
        <textarea
          name="context"
          rows={4}
          className={`${controlClass} min-h-28 py-3`}
          placeholder="Наприклад: один пакет прихованих електромонтажних робіт"
        />
      </label>

      <p className="mt-5 text-meta leading-relaxed text-ink-muted">
        {landingContent.pilot.formNote}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-action-signal px-5 text-data font-semibold text-action-signal-fg transition-colors duration-fast hover:bg-action-signal-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <Send aria-hidden="true" className="size-4" strokeWidth={1.75} />
          Підготувати лист
        </button>
        {message && (
          <button
            type="button"
            onClick={copyMessage}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-line-strong px-4 text-data font-semibold text-ink transition-colors duration-fast hover:bg-action-ghost-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {copied ? <Check aria-hidden="true" className="size-4" /> : <Clipboard aria-hidden="true" className="size-4" />}
            {copied ? "Скопійовано" : "Скопіювати текст"}
          </button>
        )}
      </div>

      <p aria-live="polite" className="mt-4 min-h-6 text-meta font-medium text-ink-muted">
        {status}
      </p>

      {message && (
        <details className="mt-4 border-t border-line pt-4">
          <summary className="min-h-11 cursor-pointer text-meta font-semibold text-ink">Показати текст листа</summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap bg-subtle p-4 font-sans text-meta leading-relaxed text-ink">{message}</pre>
        </details>
      )}
    </form>
  );
}
