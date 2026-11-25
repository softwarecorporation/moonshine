import { expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { vercelRuntime } from "@tschk/moonshine-adapter-conformance";

const fixtures = resolve(
  import.meta.dir,
  "../../adapter-conformance/src/fixtures/app",
);
const cli = resolve(import.meta.dir, "../../cli/bin/moonshine.ts");

test.each(["node", "vercel-edge"] as const)(
  "custom 404 pages stay in %s for unmatched and page-level fallbacks",
  async (runtime) => {
    const scratch = resolve(import.meta.dir, "../.cache/not-found-runtime");
    await mkdir(scratch, { recursive: true });
    const work = await mkdtemp(join(scratch, "app-"));
    const project = join(work, "project");
    let app: Awaited<ReturnType<typeof vercelRuntime.start>> | undefined;
    try {
      await cp(fixtures, project, { recursive: true });
      await mkdir(join(project, "src/routes"), { recursive: true });
      await mkdir(join(project, "node_modules/@tschk"), { recursive: true });
      await symlink(
        resolve(import.meta.dir, ".."),
        join(project, "node_modules/@tschk/moonshine-deploy-vercel"),
      );
      await Bun.write(
        join(project, "pages/gone.tsx"),
        `export { default } from "./edge";
export const loader = () => { throw new Response(null, { status: 404 }); };
`,
      );
      await Bun.write(
        join(project, "pages/api404.ts"),
        `export const GET = () => new Response(null, { status: 404 });\n`,
      );
      await Bun.write(
        join(project, "pages/parameter.ts"),
        `export const loader = ({ params }: { params: Record<string, string> }) => Response.json({
  id: params.id,
  runtime: typeof process !== "undefined" && process.versions?.node ? "node" : "vercel-edge",
});\n`,
      );
      const other = runtime === "node" ? "vercel-edge" : "node";
      const config = {
        runtime,
        routes: [
          {
            id: "notFound",
            path: "/404",
            file: "pages/edge.tsx",
            mode: "ssr",
            runtime,
          },
          {
            id: "gone",
            path: "/gone",
            file: "pages/gone.tsx",
            mode: "ssr",
            runtime,
          },
          {
            id: "api404",
            path: "/api404",
            file: "pages/api404.ts",
            mode: "api",
            runtime: other,
          },
          ...["/api/:id", "/optional/:id?", "/rest/*id"].map((path, index) => ({
            id: `parameter${index}`,
            path,
            file: "pages/parameter.ts",
            mode: "api",
            runtime: other,
          })),
        ],
      };
      const build = async () => {
        const child = Bun.spawn(
          [process.execPath, cli, "build", "--adapter", "vercel", project],
          { stdout: "pipe", stderr: "pipe" },
        );
        const [code, stderr] = await Promise.all([
          child.exited,
          new Response(child.stderr).text(),
        ]);
        return { code, stderr };
      };
      await Bun.write(
        join(project, "moonshine.config.ts"),
        `export default ${JSON.stringify({
          ...config,
          routes: [
            ...config.routes,
            {
              id: "crossRuntime",
              path: "/opposite",
              file: "pages/gone.tsx",
              mode: "ssr",
              runtime: other,
            },
          ],
        })};\n`,
      );
      const invalid = await build();
      expect(invalid.code).not.toBe(0);
      expect(invalid.stderr).toContain(
        "cross-runtime 404 fallbacks are not supported",
      );
      await Bun.write(
        join(project, "moonshine.config.ts"),
        `export default ${JSON.stringify(config)};\n`,
      );
      const { code, stderr } = await build();
      if (code !== 0)
        throw new Error(`moonshine build exited ${code}: ${stderr}`);
      const deploy = join(work, "deploy");
      await mkdir(join(deploy, ".vercel"), { recursive: true });
      await cp(
        join(project, ".vercel/output"),
        join(deploy, ".vercel/output"),
        { recursive: true },
      );
      await rm(project, { recursive: true, force: true });
      app = await vercelRuntime.start(deploy);
      const marker = runtime === "node" ? "node function" : "edge function";
      for (const [path, status] of [
        ["/404", 200],
        ["/missing", 404],
        ["/gone", 404],
      ] as const) {
        const response = await fetch(new URL(path, app.url));
        expect(response.status).toBe(status);
        expect(await response.text()).toContain(`<p>${marker}</p>`);
      }
      const head = await fetch(new URL("/missing", app.url), {
        method: "HEAD",
      });
      expect(head.status).toBe(404);
      expect(await head.text()).toBe("");
      const api = await fetch(new URL("/api404", app.url));
      expect(api.status).toBe(404);
      expect(await api.text()).toBe("");
      for (const prefix of ["/api/", "/optional/", "/rest/"]) {
        for (const value of [
          "%ZZ",
          "%",
          "%2",
          "%80",
          "%C0%AF",
          "%C2",
          "%E0%80%80",
          "%ED%A0%80",
          "%EF%BF",
          "%F0%80%80%80",
          "%F4%90%80%80",
          "%F5%80%80%80",
        ]) {
          const response = await fetch(new URL(prefix + value, app.url));
          expect(response.status, prefix + value).toBe(404);
          expect(await response.text(), prefix + value).toContain(
            `<p>${marker}</p>`,
          );
        }
        for (const value of [
          "plain",
          "%25ZZ",
          "%20",
          "%7F",
          "%C2%80",
          "%DF%BF",
          "%E0%A0%80",
          "%ED%9F%BF",
          "%EF%BF%BF",
          "%F0%90%80%80",
          "%F4%8F%BF%BF",
          ...(prefix === "/rest/" ? [] : ["%00", "%2f"]),
        ]) {
          const response = await fetch(new URL(prefix + value, app.url));
          expect(response.status, prefix + value).toBe(200);
          expect(await response.json()).toEqual({
            id: decodeURIComponent(value),
            runtime: other,
          });
        }
      }
    } finally {
      await app?.stop();
      await rm(work, { recursive: true, force: true });
    }
  },
  120_000,
);
