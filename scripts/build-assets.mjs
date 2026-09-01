import { cp, mkdir, rm } from "node:fs/promises";

const outputDirectory = new URL("../dist/", import.meta.url);
const webDirectory = new URL("../web/", import.meta.url);
const dataDirectory = new URL("../data/", import.meta.url);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  cp(new URL("index.html", webDirectory), new URL("index.html", outputDirectory)),
  cp(new URL("app.js", webDirectory), new URL("app.js", outputDirectory)),
  cp(new URL("robots.txt", webDirectory), new URL("robots.txt", outputDirectory)),
  cp(new URL("sitemap.xml", webDirectory), new URL("sitemap.xml", outputDirectory)),
  cp(dataDirectory, new URL("data/", outputDirectory), { recursive: true })
]);
