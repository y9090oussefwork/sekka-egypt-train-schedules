import fs from "node:fs";
import path from "node:path";

async function generate() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/"),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    }
  );

  let html = await response.text();

  // Convert all absolute asset paths to relative paths for GitHub Pages subpath hosting
  html = html
    .replaceAll('href="/assets/', 'href="./assets/')
    .replaceAll('src="/assets/', 'src="./assets/')
    .replaceAll('data-rsc-css-href="/assets/', 'data-rsc-css-href="./assets/')
    .replaceAll('import("/assets/', 'import("./assets/')
    .replaceAll('href="/favicon.svg"', 'href="./favicon.svg"')
    .replaceAll('href="/manifest.webmanifest"', 'href="./manifest.webmanifest"')
    .replaceAll('"css:/assets/', '"css:./assets/');

  const clientDir = path.resolve(process.cwd(), "dist/client");
  fs.writeFileSync(path.join(clientDir, "index.html"), html, "utf-8");
  fs.writeFileSync(path.join(clientDir, "404.html"), html, "utf-8");
  fs.writeFileSync(path.join(clientDir, ".nojekyll"), "# disable jekyll\n", "utf-8");

  // Copy hero-train.png to assets folder so relative CSS url("hero-train.png") and url("../hero-train.png") both work
  const heroSrc = path.join(clientDir, "hero-train.png");
  if (fs.existsSync(heroSrc)) {
    fs.copyFileSync(heroSrc, path.join(clientDir, "assets", "hero-train.png"));
  }

  console.log(`Successfully generated relative static HTML (${html.length} bytes) & .nojekyll`);
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
