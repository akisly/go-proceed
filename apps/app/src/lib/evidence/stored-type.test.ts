import { describe, it, expect } from "vitest";
import { storedTypeIs } from "./stored-type";

describe("storedTypeIs: the stored content type is exactly the recorded one (DEV-032)", () => {
  it("accepts the type in any ASCII case, with HTTP whitespace and plain parameters", () => {
    for (const s of ["image/jpeg", "IMAGE/JPEG", " image/jpeg\t", "IMAGE/JPEG ; a=b", "image/jpeg;charset=binary; x=1"]) {
      expect(storedTypeIs(s, "image/jpeg")).toBe(true);
    }
    expect(storedTypeIs("image/svg+xml", "image/svg+xml")).toBe(true);
  });

  it("refuses a list, a quote, a trailing or empty parameter, and another type", () => {
    for (const s of ["image/jpeg;x=1, TEXT/HTML", 'image/jpeg; a="b", text/html', "image/jpeg;", "image/jpeg; a",
      "image/jpegx", "text/html", "", "image/jpeg,"]) {
      expect(storedTypeIs(s, "image/jpeg")).toBe(false);
    }
    expect(storedTypeIs(null, "image/jpeg")).toBe(false);
  });

  it("refuses characters a browser does not strip as HTTP whitespace (S3-01)", () => {
    for (const s of [" image/jpeg", "image/jpeg ", "image/jpeg\u000b", "\fimage/jpeg", "image/jpeg\u0000"]) {
      expect(storedTypeIs(s, "image/jpeg")).toBe(false);
    }
  });

  it("folds ASCII case only: a non-ASCII look-alike is not its ASCII letter", () => {
    expect(storedTypeIs("İMAGE/JPEG", "image/jpeg")).toBe(false); // U+0130
    expect(storedTypeIs("image/jpeg; ſ=1", "image/jpeg")).toBe(false); // U+017F
  });

  it("treats the expected type as text, not a pattern", () => {
    expect(storedTypeIs("imageXjpeg", "image.jpeg")).toBe(false);
    expect(storedTypeIs("image/svgxml", "image/svg+xml")).toBe(false);
  });
});
