// kintone /k/v1/file.json への直接 upload (browser fetch)。
//
// プラグインは kintone と同一オリジン (<tenant>.cybozu.com) で動くので、
// セッション cookie がそのまま使える。kintone.api / kintone.proxy を経由せず
// 標準 fetch で multipart POST する。
//
// 用途: ユーザーが Composer に添付したファイルを Agent 経由ではなく直接
// kintone に保存し、取得した fileKey をユーザーメッセージに差し込んで Agent に
// 渡すことで、Agent から FILE フィールドへの添付を可能にする (Issue #27)。

export interface KintoneFileUploadResult {
  fileKey: string;
}

const ENDPOINT = '/k/v1/file.json';

export async function uploadFileToKintone(file: File): Promise<KintoneFileUploadResult> {
  const formData = new FormData();
  // kintone 公式サンプル準拠: CSRF token を form body に積む。
  // X-Requested-With ヘッダのみで動くケースもあるが、公式推奨は両方。
  // kintone.getRequestToken() は kintone customization JS のグローバル関数 (window.kintone)。
  // 取れない環境 (テスト等) では値無しで送る (テストは fetch を mock しているので素通り)。
  const reqToken =
    typeof kintone !== 'undefined' && typeof kintone.getRequestToken === 'function'
      ? kintone.getRequestToken()
      : null;
  if (reqToken) formData.append('__REQUEST_TOKEN__', reqToken);
  formData.append('file', file);

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      // kintone CSRF 対策ヘッダ。kintone.api 内部でも同じ値が使われている。
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`kintone file upload ${response.status}: ${text}`);
  }
  return (await response.json()) as KintoneFileUploadResult;
}
