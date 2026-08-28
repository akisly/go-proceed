import { describe, expect, it } from "vitest";
import {
  activateProjectRequest,
  configureProjectFieldChannelRequest,
  createProjectRequest,
  projectCapability,
  projectStatus,
} from "./index";

describe("project field channel", () => {
  it("accepts only Telegram and explicit activation version", () => {
    expect(createProjectRequest.parse({ name: "ЖК Річковий" })).toEqual({ name: "ЖК Річковий" });
    expect(configureProjectFieldChannelRequest.parse({ channel: "telegram", expectedVersion: 1 }))
      .toEqual({ channel: "telegram", expectedVersion: 1 });
    expect(activateProjectRequest.parse({ expectedVersion: 1 })).toEqual({ expectedVersion: 1 });
    expect(projectStatus.options).toEqual(["draft", "active", "archived"]);
    expect(projectCapability.options).toContain("communication.reply");
  });
});
