// esbuild / vite `define` で注入されるビルド時定数。

/** plugin/manifest.json の version (整数 build 番号) を文字列化したもの */
declare const __PLUGIN_VERSION__: string;
/** packages/plugin/package.json の version (semver) */
declare const __PLUGIN_SEMVER__: string;
