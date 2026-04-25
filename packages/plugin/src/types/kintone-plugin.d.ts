// kintone JavaScript API のグローバル型定義 (本プラグインで使用する範囲のみ)
//
// 公式: https://cybozu.dev/ja/kintone/docs/js-api/
// 完全な型は @kintone/dts-gen 等で生成可能だが、本プラグインで実利用するものに限定する。

declare global {
  interface KintoneLoginUser {
    /** ユーザー ID (数値文字列、内部識別) */
    id: string;
    /** ログイン名 (ユーザーコード)。本プラグインの主要識別子 */
    code: string;
    /** 表示名 */
    name: string;
    /** メールアドレス (空の場合あり) */
    email: string;
    /** プロフィール URL */
    url: string;
    /** 社員番号 */
    employeeNumber: string;
    /** 電話番号 */
    phone: string;
    /** 携帯電話番号 */
    mobilePhone: string;
    /** 内線番号 */
    extensionNumber: string;
    /** タイムゾーン (例: "Asia/Tokyo") */
    timezone: string;
    /** 言語 ("ja" | "en" | "zh" | "auto" 等) */
    language: string;
    /** ゲストユーザーか */
    isGuest: boolean;
    /** 種別 ("user" 等) */
    type: string;
  }

  interface KintoneApp {
    getId(): number | null;
  }

  interface KintoneEvents {
    on(eventName: string | string[], handler: (event: unknown) => unknown): void;
  }

  interface KintonePluginAppProxy {
    (
      pluginId: string,
      url: string,
      method: string,
      headers: Record<string, string>,
      data: unknown,
    ): Promise<[string, number, Record<string, string>]>;
  }

  interface KintonePluginApp {
    getConfig(pluginId: string): Record<string, string>;
    setConfig(config: Record<string, string>, callback?: () => void): void;
    proxy: KintonePluginAppProxy;
    /**
     * プラグイン runtime 用のプロキシ設定を登録する。
     * URL は前方一致、メソッドごとに個別登録が必要。
     * 固定ヘッダ (例: API Key) はリクエスト時に kintone が自動付与する。
     */
    setProxyConfig(
      url: string,
      method: string,
      headers: Record<string, string>,
      data: Record<string, unknown>,
    ): void;
  }

  interface KintonePlugin {
    app: KintonePluginApp;
  }

  interface KintoneGlobal {
    getLoginUser(): KintoneLoginUser;
    app: KintoneApp;
    events: KintoneEvents;
    plugin: KintonePlugin;
    api(path: string, method: string, params: unknown): Promise<unknown>;
  }

  // eslint-disable-next-line no-var
  var kintone: KintoneGlobal | undefined;
}

export {};
