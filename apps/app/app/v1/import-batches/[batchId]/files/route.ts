import { createHash, randomUUID } from "node:crypto";
import { requireUser } from "../../../../../src/lib/auth";
import { idempotencyKeyFrom } from "../../../../../src/lib/request-context";
import { HttpProblem, toProblemResponse, ok, requestIdFrom, problem } from "../../../../../src/lib/http";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import type { AddImportFileResponse } from "@goproceed/contracts";
import { guardXlsxContainer } from "@goproceed/domain";
import { withTenantTx, withIdempotency, recordAudit } from "@goproceed/database";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

// Multipart command — the ONE route not built on commandRoute (no JSON body).
// The file's sha256 doubles as the idempotency request hash and content_hash.
export async function POST(
  req: Request, routeCtx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  let requestId = crypto.randomUUID();
  try {
    requestId = requestIdFrom(req);
    const { userId } = await requireUser(requestId, req);
    const idempotencyKey = idempotencyKeyFrom(req);
    if (!idempotencyKey) {
      throw new HttpProblem(422, problem("VALIDATION_FAILED", "Заголовок Idempotency-Key обовʼязковий.", {
        requestId, retryable: false, userAction: "correct_fields",
        fieldErrors: [{ path: "Idempotency-Key", message: "required" }],
      }));
    }
    const batchId = (await routeCtx.params).batchId;
    if (!batchId) {
      throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Пакет імпорту не знайдено.",
        { requestId, retryable: false, userAction: "return_to_list" }));
    }
    let form: FormData;
    try { form = await req.formData(); }
    catch {
      throw new HttpProblem(422, problem("VALIDATION_FAILED", "Очікується multipart/form-data з полем file.",
        { requestId, retryable: false, userAction: "correct_fields" }));
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new HttpProblem(422, problem("VALIDATION_FAILED", "Поле file обовʼязкове.", {
        requestId, retryable: false, userAction: "correct_fields",
        fieldErrors: [{ path: "file", message: "required" }],
      }));
    }
    if (file.size === 0 || file.size > MAX_FILE_BYTES) {
      throw new HttpProblem(422, problem("IMPORT_FILE_UNSUPPORTED",
        "Файл порожній або перевищує 20 МБ.",
        { requestId, retryable: false, userAction: "use_template_or_supported_format" }));
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentHash = createHash("sha256").update(bytes).digest("hex");

    const ctx = { actorUserId: userId, organizationId: null, requestId };
    const out = await withTenantTx(ctx, async (tx) => {
      // Plain select first: FOR UPDATE engages the UPDATE RLS policy and would
      // turn a capability denial into a 404 for view-only members.
      const b0 = await tx.query(
        `select workspace_id, project_id from public.import_batches where id = $1`, [batchId]);
      if (b0.rows.length === 0) {
        throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Пакет імпорту не знайдено.",
          { requestId, retryable: false, userAction: "return_to_list" }));
      }
      const workspaceId: string = b0.rows[0].workspace_id;
      const projectId: string = b0.rows[0].project_id;
      return withIdempotency<AddImportFileResponse>(tx, {
        organizationId: workspaceId, actorScope: `user:${userId}`,
        operationId: "import_files.add", key: idempotencyKey,
        // The batch is part of the request identity: the same bytes uploaded to
        // a DIFFERENT batch is a different command, not a replay.
        requestHash: createHash("sha256").update(`${batchId}|${contentHash}`).digest("hex"),
        authorize: async () => {
          const m = await requireActiveMembership(tx, requestId, userId, workspaceId);
          await requireProjectCapability(tx, requestId,
            { workspaceId, projectId, memberId: m.memberId, capability: "imports.manage" });
        },
      }, async () => {
        // Only an authorized caller reaches the container guard, which inflates
        // every entry (DEV-087, gp-security S1): before this, any signed-in user
        // could make the server inflate up to 100 MB per request, batch or none.
        // It runs before the batch is locked, so the lock never waits on it.
        let detectedFormat: "xlsx" | "csv";
        // Format sniffing by magic bytes — never by filename/claimed type.
        const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
        const isCfb = bytes.length >= 2 && bytes[0] === 0xd0 && bytes[1] === 0xcf;
        if (isZip) {
          const g = guardXlsxContainer(bytes);
          if (!g.ok) {
            throw new HttpProblem(422, problem("IMPORT_FILE_UNSUPPORTED",
              "Файл не пройшов перевірку безпеки.", {
                requestId, retryable: false, userAction: "use_template_or_supported_format",
                fieldErrors: g.errors.map((code) => ({ path: "file", message: code })),
              }));
          }
          detectedFormat = "xlsx";
        } else if (isCfb) {
          throw new HttpProblem(422, problem("IMPORT_FILE_UNSUPPORTED",
            "Застарілий або зашифрований формат Excel не підтримується. Збережіть файл як .xlsx.",
            { requestId, retryable: false, userAction: "use_template_or_supported_format" }));
        } else {
          try {
            new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, 4096));
            detectedFormat = "csv";
          } catch {
            throw new HttpProblem(422, problem("IMPORT_FILE_UNSUPPORTED",
              "Підтримуються лише файли XLSX та CSV.",
              { requestId, retryable: false, userAction: "use_template_or_supported_format" }));
          }
        }
        const b = await tx.query(
          `select status from public.import_batches where workspace_id = $1 and id = $2 for update`,
          [workspaceId, batchId]);
        // Files are frozen after 'created': later states must see a stable set.
        if (b.rows[0].status !== "created") {
          throw new HttpProblem(409, problem("IMPORT_JOB_CONFLICT",
            "Файли можна додавати лише до першої перевірки пакета.",
            { requestId, retryable: true, userAction: "refresh_import_job" }));
        }
        const fileId = randomUUID();
        const storageKey = `pg://import-sources/${workspaceId}/${batchId}/${fileId}`;
        try {
          await tx.query(
            `insert into public.import_files
               (id, workspace_id, import_batch_id, filename, byte_size, content_hash,
                detected_format, storage_key, source_bytes, uploaded_by)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [fileId, workspaceId, batchId, file.name, file.size, contentHash,
             detectedFormat, storageKey, Buffer.from(bytes), userId]);
        } catch (e) {
          if (e instanceof Error && /import_files_workspace_id_import_batch_id_content_hash_key/.test(e.message)) {
            throw new HttpProblem(409, problem("IMPORT_JOB_CONFLICT",
              "Цей файл уже додано до пакета.",
              { requestId, retryable: false, userAction: "refresh_import_job" }));
          }
          throw e;
        }
        const bump = await tx.query(
          `update public.import_batches set version = version + 1, updated_at = now()
            where workspace_id = $1 and id = $2 returning version`,
          [workspaceId, batchId]);
        await recordAudit(tx, ctx, {
          action: "import_file.added", object_type: "import_file", object_id: fileId,
          details: { contentHash, detectedFormat, byteSize: file.size },
        }, { organizationId: workspaceId });
        return {
          status: 201,
          body: {
            fileId, filename: file.name, byteSize: file.size, contentHash, detectedFormat,
            batchVersion: Number(bump.rows[0].version),
          },
        };
      });
    });
    return ok(out.status, out.body, requestId, {
      "Idempotency-Replay-Until": out.expiresAt.toISOString(),
    });
  } catch (err) {
    return toProblemResponse(err, requestId);
  }
}
