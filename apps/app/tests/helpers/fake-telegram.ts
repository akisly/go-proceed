type FakeResponse = {
  status?: number;
  description?: string;
  fileSize?: number;
  filePath?: string;
  messageId?: number;
  bytes?: Uint8Array;
};

export type FakeTelegramFetch = typeof fetch & { calls: Array<{ url: string; init?: RequestInit }> };

export function fakeTelegramFetch(options: FakeResponse = {}): FakeTelegramFetch {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init === undefined) calls.push({ url });
    else calls.push({ url, init });
    const status = options.status ?? 200;
    if (url.includes("/file/bot")) {
      const body = options.bytes === undefined ? new ArrayBuffer(3) : options.bytes.buffer as ArrayBuffer;
      return new Response(body, { status });
    }
    if (status !== 200) {
      return Response.json({ ok: false, error_code: status, description: options.description ?? "failed" }, { status });
    }
    if (url.endsWith("/getFile")) {
      return Response.json({ ok: true, result: {
        file_id: "file-id", file_unique_id: "unique-id", file_size: options.fileSize ?? 3,
        file_path: options.filePath ?? "documents/file.bin",
      } });
    }
    if (url.endsWith("/sendMessage")) {
      return Response.json({ ok: true, result: { message_id: options.messageId ?? 1 } });
    }
    return Response.json({ ok: true, result: true });
  }) as FakeTelegramFetch;
  fetcher.calls = calls;
  return fetcher;
}

export function timeoutAfterAcceptingFetch(): typeof fetch {
  return (async () => {
    throw new Error("socket closed after request dispatch");
  }) as typeof fetch;
}
