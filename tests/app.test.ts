import { describe, expect, it } from "vitest";
import { app } from "../src/app";

const sourceIndex = {
  schema_version: "1.0",
  sources: [
    {
      id: "middle-a",
      name: "中学校 Aブロック",
      level: "middle_school",
      block: "A",
      schools: ["二中"],
      source_url: "https://example.test/source",
      months: ["2026-09"]
    }
  ]
};

const lunchDocument = {
  schema_version: "1.0",
  year: 2026,
  month: 9,
  level: "middle_school",
  block: "A",
  days: [
    {
      date: "2026-09-01",
      weekday: "火",
      status: "scheduled",
      menu: ["ごはん"],
      beverages: ["牛乳"]
    }
  ]
};

const assets = {
  async fetch(input: RequestInfo | URL): Promise<Response> {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/index.html") return new Response("<!doctype html><title>給食</title>", { headers: { "Content-Type": "text/html" } });
    if (url.pathname === "/data/index.json") return Response.json(sourceIndex);
    if (url.pathname === "/data/middle-a/2026-09.json") return Response.json(lunchDocument);
    return new Response("Not Found", { status: 404 });
  }
} as Fetcher;

describe("Hono application", () => {
  const expectJsonContentType = (response: Response) => {
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
  };

  it("serves the web page through the assets binding", async () => {
    const response = await app.request("https://example.test/", {}, { ASSETS: assets });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("給食");
  });

  it("returns the source index", async () => {
    const response = await app.request("https://example.test/api/sources", {}, { ASSETS: assets });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(sourceIndex);
    expectJsonContentType(response);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("returns a monthly lunch document through both API forms", async () => {
    const queryResponse = await app.request(
      "https://example.test/api/lunches?source=middle-a&month=2026-09",
      {},
      { ASSETS: assets }
    );
    const pathResponse = await app.request(
      "https://example.test/api/lunches/middle-a/2026/9",
      {},
      { ASSETS: assets }
    );
    expect(queryResponse.status).toBe(200);
    expect(await queryResponse.json()).toEqual(lunchDocument);
    expectJsonContentType(queryResponse);
    expect(pathResponse.status).toBe(200);
    expectJsonContentType(pathResponse);
  });

  it("rejects invalid parameters and returns JSON 404 errors", async () => {
    const invalid = await app.request(
      "https://example.test/api/lunches?source=../secret&month=2026-09",
      {},
      { ASSETS: assets }
    );
    const missing = await app.request(
      "https://example.test/api/lunches/middle-a/2026/10",
      {},
      { ASSETS: assets }
    );
    expect(invalid.status).toBe(400);
    expectJsonContentType(invalid);
    expect(missing.status).toBe(404);
    expectJsonContentType(missing);
    const missingBody = (await missing.json()) as { error: { code: string } };
    expect(missingBody.error.code).toBe("not_found");
  });

  it("returns the API description with an explicit UTF-8 JSON content type", async () => {
    const response = await app.request("https://example.test/api", {}, { ASSETS: assets });
    expect(response.status).toBe(200);
    expectJsonContentType(response);
  });
});
