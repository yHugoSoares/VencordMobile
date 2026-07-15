/*
 * Vemobile — Mobile mod bundle build script
 *
 * Builds a mobile-compatible IIFE bundle that includes Vencord's core
 * with a mobile-specific native stub and mobile-only plugins.
 */

import esbuild from "esbuild";
import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const VENCORD_SRC = "/tmp/vencord-analysis/src";
const MOBILE_SRC = resolve(ROOT, "src-mobile");

const watch = process.argv.includes("--watch");
const IS_DEV = watch || process.argv.includes("--dev");

const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")).version;
const BUILD_TIMESTAMP = Date.now();

function stringifyValues(obj) {
    for (const key in obj) obj[key] = JSON.stringify(obj[key]);
    return obj;
}

/** Resolve @api, @webpack, @utils, @components, @shared, @debug, @main aliases */
function aliasPlugin() {
    const aliases = {
        "@api": join(VENCORD_SRC, "api"),
        "@webpack": join(VENCORD_SRC, "webpack"),
        "@utils": join(VENCORD_SRC, "utils"),
        "@components": join(VENCORD_SRC, "components"),
        "@shared": join(VENCORD_SRC, "shared"),
        "@debug": join(VENCORD_SRC, "debug"),
        "@main": join(VENCORD_SRC, "main"),
        "@plugins": join(VENCORD_SRC, "plugins"),
    };

    return {
        name: "vemobile-alias",
        setup(build) {
            // Resolve @alias paths
            build.onResolve({ filter: /^@(api|webpack|utils|components|shared|debug|main|plugins)(\/.+)?$/ }, args => {
                const [, ns, sub] = args.path.match(/^@(api|webpack|utils|components|shared|debug|main|plugins)(\/.+)?$/);
                const base = aliases[`@${ns}`];
                const subPath = sub || "/index";
                const resolved = join(base, subPath);
                // Try .ts, .tsx, /index.ts, /index.tsx
                const candidates = [
                    resolved + ".ts",
                    resolved + ".tsx",
                    join(resolved, "index.ts"),
                    join(resolved, "index.tsx"),
                ];
                for (const c of candidates) {
                    if (existsSync(c)) return { path: c };
                }
                return { path: resolved };
            });

            // Resolve ~plugins (fallback — loaded from mobile entry)
            build.onResolve({ filter: /^~plugins$/ }, () => ({
                path: join(MOBILE_SRC, "plugins-index.ts"),
            }));

            // Resolve ~git-hash
            build.onResolve({ filter: /^~git-hash$/ }, args => ({
                namespace: "git-hash", path: args.path,
            }));

            // Resolve ~git-remote
            build.onResolve({ filter: /^~git-remote$/ }, args => ({
                namespace: "git-remote", path: args.path,
            }));

            // Also resolve from mobile src-mobile for @mobile aliases
            build.onResolve({ filter: /^@mobile\/.+$/ }, args => {
                const subPath = args.path.replace("@mobile/", "");
                return { path: join(MOBILE_SRC, subPath) };
            });
        },
        gh: null, // placeholder
    };
}

function gitHashPlugin() {
    return {
        name: "git-hash",
        setup(build) {
            build.onLoad({ filter: /.*/, namespace: "git-hash" }, () => ({
                contents: `export default "vemobile-dev"`,
            }));
        },
    };
}

function gitRemotePlugin() {
    return {
        name: "git-remote",
        setup(build) {
            build.onLoad({ filter: /.*/, namespace: "git-remote" }, () => ({
                contents: `export default "https://github.com/vencordmobile/vemobile"`,
            }));
        },
    };
}

/** Handle CSS ?managed imports and file:// URIs */
function stylePlugin() {
    return {
        name: "vemobile-style",
        setup(build) {
            // CSS imports with ?managed suffix
            build.onResolve({ filter: /\?managed$/ }, args => ({
                path: args.path,
                namespace: "managed-css",
                pluginData: { resolveDir: args.resolveDir },
            }));
            build.onLoad({ filter: /.*/, namespace: "managed-css" }, args => {
                const cssPath = args.path.replace(/\?managed$/, "");
                const fullPath = join(args.pluginData.resolveDir, cssPath);
                if (!existsSync(fullPath)) return null;
                const css = readFileSync(fullPath, "utf-8");
                const escaped = JSON.stringify(css);
                return {
                    contents: `
                        const styleId = "${cssPath.replace(/[^a-zA-Z0-9]/g, "_")}";
                        window.VencordStyles = window.VencordStyles || new Map();
                        window.VencordStyles.set(styleId, ${escaped});
                        export default styleId;
                    `,
                    loader: "js",
                };
            });

            // file:// URIs
            build.onResolve({ filter: /^file:\/\// }, args => ({
                path: args.path,
                namespace: "file-url",
            }));
            build.onLoad({ filter: /.*/, namespace: "file-url" }, args => {
                const relPath = args.path.replace("file://", "");
                const fullPath = join(ROOT, "assets", relPath);
                if (existsSync(fullPath)) {
                    const content = readFileSync(fullPath, "utf-8");
                    return { contents: `export default ${JSON.stringify(content)}`, loader: "js" };
                }
                return { contents: "export default ''", loader: "js" };
            });
        },
    };
}

/** Ban Node.js builtins and Electron imports in browser code */
function banNodePlugin() {
    return {
        name: "ban-node",
        setup(build) {
            build.onResolve({ filter: /^(electron|fs|path|os|child_process|net|tls|http|https|stream|crypto|util|events|buffer|url|querystring|assert|dns|dgram|domain|cluster|console|constants|module|process|punycode|readline|repl|string_decoder|sys|timers|tty|v8|vm|zlib|worker_threads|perf_hooks|async_hooks|inspector|trace_events|wasi)(\/.*)?$/ }, () => ({
                external: true,
            }));
        },
    };
}

/** Glob plugins from both Vencord and mobile sources */
function globPluginNames() {
    const names = [];
    const vencordPluginsDir = join(VENCORD_SRC, "plugins");
    const mobilePluginsDir = join(MOBILE_SRC, "plugins");

    for (const dir of [vencordPluginsDir, mobilePluginsDir]) {
        if (!existsSync(dir)) continue;
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
            // Get plugin name from folder or file
            const baseName = entry.name.replace(/\.(ts|tsx)$/, "");
            const parts = baseName.split(".");
            // Skip .web.ts and .desktop.ts etc — include only .mobile.ts or no-suffix plugins
            const ext = parts.length > 1 ? parts.pop() : null;
            if (ext && ext !== "mobile") continue; // skip .web, .desktop, .vesktop
    
            const name = parts.join(".");
            if (!names.includes(name)) names.push(name);
        }
    }
    return names;
}

async function generatePluginsIndex() {
    const names = globPluginNames();
    let code = 'import definePlugin from "@utils/types";\n';
    const imports = [];
    const plugins = [];

    for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const id = `p${i}`;
        // Try mobile plugin first, then Vencord plugin
        const mobilePath = join(MOBILE_SRC, "plugins", name);
        const vencordPath = join(VENCORD_SRC, "plugins", name);
        const from = existsSync(mobilePath + ".ts") || existsSync(mobilePath + ".tsx") || existsSync(mobilePath)
            ? `@mobile/plugins/${name}`
            : `@plugins/${name}`;

        imports.push(`import ${id} from "${from}";`);
        plugins.push(`[${id}.name]:${id}`);
    }

    code += imports.join("\n") + "\n";
    code += `export default {${plugins.join(",")}};\n`;
    code += `export const PluginMeta = {};\n`;

    const outPath = join(MOBILE_SRC, "plugins-index.ts");
    const { writeFileSync } = await import("fs");
    writeFileSync(outPath, code);
    console.log(`Generated plugins index with ${names.length} plugins`);
}

// --- Main Build Config ---
const defines = stringifyValues({
    IS_MOBILE: true,
    IS_WEB: false,
    IS_DISCORD_DESKTOP: false,
    IS_VESKTOP: false,
    IS_STANDALONE: true,
    IS_DEV,
    IS_REPORTER: false,
    IS_UPDATER_DISABLED: false,
    IS_EXTENSION: false,
    IS_USERSCRIPT: false,
    VERSION,
    BUILD_TIMESTAMP,
});

const config = {
    entryPoints: [join(MOBILE_SRC, "vemobile.ts")],
    outfile: join(ROOT, "dist", "vemobile.js"),
    bundle: true,
    format: "iife",
    globalName: "Vencord",
    platform: "browser",
    target: "es2020",
    minify: !watch,
    sourcemap: watch ? "inline" : "external",
    define: defines,
    plugins: [
        aliasPlugin(),
        gitHashPlugin(),
        gitRemotePlugin(),
        stylePlugin(),
        banNodePlugin(),
    ],
    external: ["/assets/*"],
    banner: {
        js: `// Vemobile v${VERSION} — mobile Discord mod bundle`,
    },
    logLevel: "info",
};

async function main() {
    await generatePluginsIndex();

    if (watch) {
        const ctx = await esbuild.context(config);
        await ctx.watch();
        console.log("Watching for changes...");
    } else {
        const result = await esbuild.build(config);
        if (result.errors.length > 0) {
            console.error("Build failed:", result.errors);
            process.exit(1);
        }
        if (result.warnings.length > 0) {
            console.warn("Build warnings:", result.warnings);
        }
        console.log("Build complete:", join(ROOT, "dist", "vemobile.js"));
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
