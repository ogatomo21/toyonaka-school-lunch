import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

type AppBindings = {
  Bindings: Env;
};

const SOURCE_ID_PATTERN = /^[a-z0-9-]+$/;
const MONTH_PATTERN = /^(?<year>\d{4})-(?<month>0[1-9]|1[0-2])$/;
const CACHE_CONTROL = "public, max-age=3600, stale-while-revalidate=86400";
const API_CONTENT_TYPE = "application/json; charset=utf-8";

export const app = new Hono<AppBindings>();

app.use("*", secureHeaders());
app.use("/api/*", cors({ origin: "*", allowMethods: ["GET", "HEAD", "OPTIONS"] }));

const apiError = (code: string, message: string) => ({ error: { code, message } });

const apiJson = (data: unknown, init?: ResponseInit): Response => {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", API_CONTENT_TYPE);
  return Response.json(data, { ...init, headers });
};

const assetRequest = (requestUrl: string, pathname: string): Request => {
  const url = new URL(requestUrl);
  url.pathname = pathname;
  url.search = "";
  return new Request(url, { method: "GET" });
};

const cachedApiResponse = (response: Response): Response => {
  const result = new Response(response.body, response);
  result.headers.set("Cache-Control", CACHE_CONTROL);
  result.headers.set("Content-Type", API_CONTENT_TYPE);
  return result;
};

const serveLunchDocument = async (
  requestUrl: string,
  assets: Fetcher,
  sourceId: string,
  month: string
): Promise<Response> => {
  if (!SOURCE_ID_PATTERN.test(sourceId) || !MONTH_PATTERN.test(month)) {
    return apiJson(apiError("invalid_parameter", "sourceまたはmonthの形式が不正です"), {
      status: 400
    });
  }

  const response = await assets.fetch(assetRequest(requestUrl, `/data/${sourceId}/${month}.json`));
  if (response.status === 404) {
    return apiJson(apiError("not_found", "指定した献立データはありません"), { status: 404 });
  }
  if (!response.ok) {
    console.error(JSON.stringify({ event: "asset_fetch_failed", sourceId, month, status: response.status }));
    return apiJson(apiError("internal_error", "献立データを取得できませんでした"), {
      status: 500
    });
  }
  return cachedApiResponse(response);
};

app.get("/", async (c) => {
  const response = await c.env.ASSETS.fetch(assetRequest(c.req.url, "/index.html"));
  return new Response(response.body, response);
});

app.get("/api", () =>
  apiJson({
    name: "豊中市学校給食API",
    version: "1.0.0",
    endpoints: {
      sources: "/api/sources",
      lunches: "/api/lunches/{source}/{year}/{month}",
      query: "/api/lunches?source=middle-a&month=2026-09"
    }
  })
);

app.get("/api/sources", async (c) => {
  const response = await c.env.ASSETS.fetch(assetRequest(c.req.url, "/data/index.json"));
  if (!response.ok) {
    console.error(JSON.stringify({ event: "source_index_fetch_failed", status: response.status }));
    return apiJson(apiError("internal_error", "取得元一覧を読み込めませんでした"), { status: 500 });
  }
  return cachedApiResponse(response);
});

app.get("/api/lunches", (c) => {
  const sourceId = c.req.query("source") ?? "";
  const month = c.req.query("month") ?? "";
  return serveLunchDocument(c.req.url, c.env.ASSETS, sourceId, month);
});

app.get("/api/lunches/:source/:year/:month", (c) => {
  const sourceId = c.req.param("source");
  const month = `${c.req.param("year")}-${c.req.param("month").padStart(2, "0")}`;
  return serveLunchDocument(c.req.url, c.env.ASSETS, sourceId, month);
});

app.notFound((c) => {
  if (new URL(c.req.url).pathname.startsWith("/api/")) {
    return apiJson(apiError("not_found", "APIエンドポイントが見つかりません"), { status: 404 });
  }
  return c.text("ページが見つかりません", 404);
});

app.onError((error, c) => {
  console.error(JSON.stringify({ event: "unhandled_error", message: error.message }));
  if (new URL(c.req.url).pathname.startsWith("/api/")) {
    return apiJson(apiError("internal_error", "サーバー内部でエラーが発生しました"), { status: 500 });
  }
  return c.text("サーバー内部でエラーが発生しました", 500);
});
