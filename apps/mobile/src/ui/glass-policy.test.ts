import { describe, expect, it } from "vitest";
import { glassMaterial } from "./glass-policy";

const capable = { platform: "ios", androidApi: 0, reduceTransparency: false,
  liquidAvailable: true, glassEnabled: true, hasBlurTarget: false, overCamera: false };
describe("mobile glass safety", () => {
  it("requires both iOS availability checks", () => {
    expect(glassMaterial(capable)).toBe("liquid");
    expect(glassMaterial({ ...capable, glassEnabled: false })).toBe("blur");
    expect(glassMaterial({ ...capable, liquidAvailable: false })).toBe("blur");
  });
  it("always respects reduced transparency", () => {
    expect(glassMaterial({ ...capable, reduceTransparency: true })).toBe("solid");
  });
  it("keeps chrome over the live camera solid on iOS too", () => {
    expect(glassMaterial({ ...capable, overCamera: true })).toBe("solid");
  });
  it("requires an explicit Android target and API 31", () => {
    const android = { ...capable, platform: "android", androidApi: 31, hasBlurTarget: true };
    expect(glassMaterial(android)).toBe("blur");
    expect(glassMaterial({ ...android, androidApi: 30 })).toBe("solid");
    expect(glassMaterial({ ...android, hasBlurTarget: false })).toBe("solid");
    expect(glassMaterial({ ...android, overCamera: true })).toBe("solid");
  });
});
