import { describe, it, expect } from "vitest";
import { parseCsv, CSV_LIMITS } from "./csv";

const enc = (s: string) => new TextEncoder().encode(s);

describe("parseCsv (strict, fail-closed)", () => {
  it("parses quoted fields with embedded delimiter and escaped quote", () => {
    const r = parseCsv(enc('Назва;К-сть\n"Бетон; М300";"12,5"\n"Каркас ""А""";3\n'));
    expect(r.ok).toBe(true);
    expect(r.delimiter).toBe(";");
    expect(r.rows[1]?.cells.A?.raw).toBe("Бетон; М300");
    expect(r.rows[1]?.cells.B?.raw).toBe("12,5");
    expect(r.rows[2]?.cells.A?.raw).toBe('Каркас "А"');
  });

  it("strips BOM; keeps 1-based rowNo aligned to the source file", () => {
    const r = parseCsv(enc("﻿a,b\nc,d\n"));
    expect(r.ok).toBe(true);
    expect(r.rows[0]?.rowNo).toBe(1);
    expect(r.rows[0]?.cells.A?.raw).toBe("a");
    expect(r.rows[1]?.rowNo).toBe(2);
  });

  it("auto-detects tab and comma delimiters", () => {
    expect(parseCsv(enc("a\tb\nc\td\n")).delimiter).toBe("\t");
    expect(parseCsv(enc("a,b\nc,d\n")).delimiter).toBe(",");
  });

  it("fails closed on NUL bytes", () => {
    const bytes = new Uint8Array([...enc("a,b\n"), 0, ...enc("c,d\n")]);
    const r = parseCsv(bytes);
    expect(r.ok).toBe(false);
    expect(r.errors[0]?.code).toBe("CSV_CONTROL_CHARS");
    expect(r.rows).toHaveLength(0);
  });

  it("fails closed on invalid UTF-8", () => {
    const r = parseCsv(new Uint8Array([0xff, 0xfe, 0x41]));
    expect(r.ok).toBe(false);
    expect(r.errors[0]?.code).toBe("CSV_ENCODING_INVALID");
  });

  it("fails closed on unbalanced quote at EOF", () => {
    const r = parseCsv(enc('a,"unclosed\n'));
    expect(r.ok).toBe(false);
    expect(r.errors[0]?.code).toBe("CSV_UNBALANCED_QUOTE");
  });

  it("enforces column and byte limits with named codes", () => {
    const manyCols = Array.from({ length: CSV_LIMITS.maxCols + 10 }, (_, i) => `c${i}`).join(",");
    expect(parseCsv(enc(manyCols + "\n")).errors[0]?.code).toBe("CSV_TOO_MANY_COLS");
    const r = parseCsv(enc("x".repeat(64)), undefined, { ...CSV_LIMITS, maxBytes: 32 });
    expect(r.errors[0]?.code).toBe("CSV_TOO_LARGE");
  });

  it("enforces the row limit", () => {
    const r = parseCsv(enc("a\n".repeat(50)), undefined, { ...CSV_LIMITS, maxRows: 10 });
    expect(r.ok).toBe(false);
    expect(r.errors[0]?.code).toBe("CSV_TOO_MANY_ROWS");
  });

  it("values stay untrusted strings — no numeric coercion", () => {
    const r = parseCsv(enc("q\n007\n1e9\n"));
    expect(r.rows[1]?.cells.A?.raw).toBe("007");
    expect(r.rows[2]?.cells.A?.raw).toBe("1e9");
  });

  it("fuzz: 200 seeded byte mutations never throw", () => {
    let seed = 42;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const base = enc("Назва;Од;К-сть;Ціна\nРобота;м2;10,5;199,99\n");
    for (let i = 0; i < 200; i++) {
      const b = new Uint8Array(base);
      b[Math.floor(rnd() * b.length)] = Math.floor(rnd() * 256);
      expect(() => parseCsv(b)).not.toThrow();
    }
  });
});
