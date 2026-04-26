// Worker のバージョン情報。
//
// プラグインのビルド時 esbuild の `--define` で `__BUILD_VERSION__` と
// `__BUILD_TIME__` が注入される。それ以外 (wrangler dev など) では `dev` を返す。

declare const __BUILD_VERSION__: string;
declare const __BUILD_TIME__: string;

export const BUILD_VERSION: string =
  typeof __BUILD_VERSION__ === 'string' ? __BUILD_VERSION__ : 'dev';

export const BUILD_TIME: string =
  typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : 'dev';
