// kintone.plugin.app.setProxyConfig の data 引数が
// ネストされたオブジェクトを受け付けるか実機検証するスニペット。
//
// 使い方:
//   1. Cowork Agent for kintone のプラグイン設定画面を開く
//   2. ブラウザ DevTools のコンソールに本ファイル全文を貼り付けて実行
//   3. 出力を観察:
//      - setProxyConfig がエラーで弾く?
//      - 通った場合、getProxyConfig はネスト構造で返してくる?
//      - 実際の outbound request body はどうなる? (Worker /debug/echo がエコー)
//
// 注意: setProxyConfig は **設定画面でのみ実行可能** なので、必ずプラグインの
//       設定画面 (URL に `/plugin/config/` が含まれる画面) で実行すること。

(async () => {
  const TARGET_URL = 'https://cowork-agent-kintone-mcp.sugimomoto.workers.dev/debug/echo';
  const METHOD = 'POST';
  const PLUGIN_ID = kintone.$PLUGIN_ID;

  // ----- ① setProxyConfig: ネスト構造の data を保存できるか -----
  console.group('① setProxyConfig: ネストオブジェクト');
  const nestedData = {
    auth: {
      refresh: {
        token_endpoint_auth: {
          type: 'client_secret_basic',
          client_secret: 'SUPER_SECRET_VALUE_FOR_TEST',
        },
      },
    },
    flat_key: 'flat_value',
  };

  try {
    await new Promise((resolve, reject) => {
      kintone.plugin.app.setProxyConfig(
        TARGET_URL,
        METHOD,
        { 'X-Test-Header': 'set-by-setProxyConfig' },
        nestedData,
        () => {
          console.log('✓ setProxyConfig は成功 (ネストを許容しているように見える)');
          resolve();
        },
      );
    });
  } catch (e) {
    console.error('✗ setProxyConfig が失敗:', e);
    console.groupEnd();
    return;
  }
  console.groupEnd();

  // ----- ② getProxyConfig: 保存された値を読み戻して構造を確認 -----
  console.group('② getProxyConfig: 保存値の確認');
  await new Promise((resolve) => {
    kintone.plugin.app.getProxyConfig(TARGET_URL, METHOD, (config) => {
      console.log('getProxyConfig が返した内容:');
      console.log(JSON.stringify(config, null, 2));
      console.log(
        '→ data.auth.refresh.token_endpoint_auth.client_secret =',
        config?.data?.auth?.refresh?.token_endpoint_auth?.client_secret,
      );
      console.log(
        config?.data?.auth?.refresh?.token_endpoint_auth?.client_secret === 'SUPER_SECRET_VALUE_FOR_TEST'
          ? '✓ ネスト保存できている'
          : '✗ ネストが壊れている / 保存されていない',
      );
      resolve();
    });
  });
  console.groupEnd();

  // ----- ③ 実際に proxy を実行して outbound body を確認 -----
  console.group('③ kintone.plugin.app.proxy: outbound body 検証');
  const runtimeBody = {
    auth: {
      mcp_server_url: 'https://example.com/mcp',
      access_token: 'RUNTIME_ACCESS_TOKEN',
      refresh: {
        refresh_token: 'RUNTIME_REFRESH_TOKEN',
        token_endpoint: 'https://example.com/token',
        client_id: 'RUNTIME_CLIENT_ID',
        // token_endpoint_auth は setProxyConfig 由来でマージされてほしい
      },
    },
  };

  await new Promise((resolve) => {
    kintone.plugin.app.proxy(
      PLUGIN_ID,
      TARGET_URL,
      METHOD,
      { 'X-Runtime-Header': 'set-by-proxy-call' },
      runtimeBody,
      (responseBody, status, responseHeaders) => {
        console.log('--- HTTP status ---', status);
        let echoed;
        try {
          echoed = JSON.parse(responseBody);
        } catch {
          console.log('(Worker レスポンスを JSON parse できず)');
          console.log(responseBody);
          resolve();
          return;
        }

        console.log('--- Worker /debug/echo が受け取った method/url ---');
        console.log(echoed.method, echoed.url);

        console.log('--- Worker が受信したヘッダ (一部) ---');
        const interesting = Object.fromEntries(
          Object.entries(echoed.headers).filter(([k]) =>
            /^x-(test-header|runtime-header|cybozu)/i.test(k),
          ),
        );
        console.log(JSON.stringify(interesting, null, 2));

        console.log('--- Worker が受信した body (完全な outbound JSON) ---');
        console.log(echoed.body);

        try {
          const parsedBody = JSON.parse(echoed.body);
          const merged = parsedBody?.auth?.refresh?.token_endpoint_auth;
          console.log('--- マージ判定 ---');
          console.log(
            'auth.refresh.token_endpoint_auth =',
            JSON.stringify(merged, null, 2),
          );
          if (merged && merged.client_secret === 'SUPER_SECRET_VALUE_FOR_TEST') {
            console.log('✓ ネストされた client_secret が outbound body にマージされている');
          } else {
            console.log('✗ ネスト client_secret が outbound body に出ていない');
          }
          if (parsedBody?.flat_key === 'flat_value') {
            console.log('✓ flat_key も注入されている (フラット注入は確実に効く)');
          }
        } catch {
          console.log('(body を JSON parse できず判定不可)');
        }
        resolve();
      },
      (errorBody) => {
        console.error('proxy 失敗:', errorBody);
        resolve();
      },
    );
  });
  console.groupEnd();

  // ----- ④ クリーンアップ: テスト用に登録した proxy 設定を残したくないので削除 -----
  // 注: kintone には deleteProxyConfig 系がない。空ヘッダ + 空 body で上書きしておく。
  console.group('④ cleanup: setProxyConfig を空に上書き');
  await new Promise((resolve) => {
    kintone.plugin.app.setProxyConfig(TARGET_URL, METHOD, {}, {}, () => {
      console.log('✓ ヘッダ・data を空オブジェクトで上書き完了');
      resolve();
    });
  });
  console.groupEnd();

  console.log('--- 検証完了 ---');
})();
