import { z } from "zod";

export type TelegramConfig = {
  botToken: string;
  botId: string;
  botUsername: string;
  webhookSecret: string;
  workerSecret: string;
  linkPepper: string;
  appPublicOrigin: string;
};

const telegramConfigSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(20),
  TELEGRAM_BOT_ID: z.string().regex(/^\d+$/),
  TELEGRAM_BOT_USERNAME: z.string().regex(/^[A-Za-z0-9_]{5,}$/),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(32),
  TELEGRAM_WORKER_SECRET: z.string().min(32),
  TELEGRAM_LINK_PEPPER: z.string().min(32),
  APP_PUBLIC_ORIGIN: z.string().url().startsWith("https://"),
}).strict();

export class TelegramConfigError extends Error {
  constructor() {
    super("Telegram configuration is invalid.");
    this.name = "TelegramConfigError";
  }
}

/**
 * Read and validate secrets only when a server operation explicitly needs the
 * Telegram adapter. Merely importing this module does not require secrets.
 */
export function loadTelegramConfig(
  env: Record<string, string | undefined> = process.env,
): TelegramConfig {
  const result = telegramConfigSchema.safeParse({
    TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_BOT_ID: env.TELEGRAM_BOT_ID,
    TELEGRAM_BOT_USERNAME: env.TELEGRAM_BOT_USERNAME,
    TELEGRAM_WEBHOOK_SECRET: env.TELEGRAM_WEBHOOK_SECRET,
    TELEGRAM_WORKER_SECRET: env.TELEGRAM_WORKER_SECRET,
    TELEGRAM_LINK_PEPPER: env.TELEGRAM_LINK_PEPPER,
    APP_PUBLIC_ORIGIN: env.APP_PUBLIC_ORIGIN,
  });
  if (!result.success) throw new TelegramConfigError();
  return {
    botToken: result.data.TELEGRAM_BOT_TOKEN,
    botId: result.data.TELEGRAM_BOT_ID,
    botUsername: result.data.TELEGRAM_BOT_USERNAME,
    webhookSecret: result.data.TELEGRAM_WEBHOOK_SECRET,
    workerSecret: result.data.TELEGRAM_WORKER_SECRET,
    linkPepper: result.data.TELEGRAM_LINK_PEPPER,
    appPublicOrigin: result.data.APP_PUBLIC_ORIGIN,
  };
}
