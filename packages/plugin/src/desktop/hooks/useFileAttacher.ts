// ファイル添付ハンドラ。
//
// Composer の <input type="file" multiple> から渡された FileList を:
//   1. validateFile で拡張子 / サイズ / 件数チェック
//   2. 通れば status='reading' で chatStore.addAttachedFile
//   3. text 系は readAsText、binary 系は readAsBase64 で読み込み
//   4. 完了したら status='ready' に更新、失敗時は status='error'
//
// 並列処理 OK (各 File 独立に走る)。

import { useCallback, useRef } from 'react';

import { detectImageFormat } from '../../core/files/imageFormat';
import { readAsBase64, readAsText } from '../../core/files/read';
import { EXTENSION_TO_KIND } from '../../core/files/types';
import { extensionOf, validateFile } from '../../core/files/validate';
import { uploadFileToKintone } from '../../core/kintone/fileUploadKintone';
import { useChatStore } from '../../store/chatStore';

import type { AttachedFile } from '../../core/files/types';

export interface UseFileAttacherResult {
  attach: (files: FileList | File[]) => void;
}

let counter = 0;
function nextLocalId(): string {
  counter += 1;
  return `att-${Date.now()}-${counter}`;
}

export function useFileAttacher(): UseFileAttacherResult {
  const addAttachedFile = useChatStore((s) => s.addAttachedFile);
  const updateAttachedFile = useChatStore((s) => s.updateAttachedFile);
  // closures のための ref (state 直参照だと count が古い)
  const storeRef = useRef(useChatStore);

  const attach = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      for (const file of list) {
        // 件数チェックは「現時点 + 既に同 batch で追加済」を基準にする。
        // batch 内で同時に複数選んだ場合、validateFile を呼ぶ毎に最新の store を参照
        // する形で順次判定する。
        const currentCount = storeRef.current.getState().attachedFiles.length;
        const v = validateFile(file, currentCount);
        const ext = extensionOf(file.name);
        const meta = EXTENSION_TO_KIND[ext];

        const localId = nextLocalId();

        if (!v.ok) {
          // 失敗もチップ化して表示する (errorText でユーザーに理由を伝える)
          const errored: AttachedFile = {
            localId,
            filename: file.name,
            size: file.size,
            mimeType: meta?.mime ?? file.type ?? 'application/octet-stream',
            kind: meta?.kind ?? 'text',
            status: 'error',
            errorText: v.reason,
          };
          addAttachedFile(errored);
          continue;
        }

        // meta は validateFile の OK 経由なので必ず存在する
        const m = meta!;
        const initial: AttachedFile = {
          localId,
          filename: file.name,
          size: file.size,
          mimeType: m.mime,
          kind: m.kind,
          status: 'reading',
          kintoneUpload: 'uploading',
        };
        addAttachedFile(initial);

        // kintone への並行 upload (Issue #27)。
        // 失敗しても content block は影響を受けないので silent に best-effort。
        void (async () => {
          try {
            const { fileKey } = await uploadFileToKintone(file);
            updateAttachedFile(localId, {
              kintoneFileKey: fileKey,
              kintoneUpload: 'uploaded',
            });
          } catch {
            updateAttachedFile(localId, { kintoneUpload: 'failed' });
          }
        })();

        // 読み込みは fire-and-forget (Promise を return しない)。
        // テストは waitFor で status==='ready' を待つ。
        void (async () => {
          try {
            const content =
              m.kind === 'text' ? await readAsText(file) : await readAsBase64(file);

            // 画像はマジックバイト検出で実形式を確認。
            // 拡張子は .png / .jpg だが中身が AVIF / HEIC のケースを救済する。
            // (Anthropic は AVIF / HEIC 非対応のため、宣言した media_type と中身が
            //  一致しないと "Image format ... not supported" 400 で session が落ちる)
            if (m.kind === 'image') {
              const detected = detectImageFormat(content);
              if (detected.kind === 'unsupported') {
                updateAttachedFile(localId, {
                  status: 'error',
                  errorText: `${detected.label} 形式は未対応です。PNG / JPEG / GIF / WebP に変換してください`,
                });
                return;
              }
              if (detected.kind === 'supported' && detected.mime !== m.mime) {
                // 拡張子と中身が違う (= 拡張子が誤称されているだけ)。実形式に合わせて補正。
                updateAttachedFile(localId, {
                  status: 'ready',
                  content,
                  mimeType: detected.mime,
                });
                return;
              }
              // detected.kind === 'unknown' はそのまま (壊れた画像でも Anthropic が判定)
            }

            updateAttachedFile(localId, { status: 'ready', content });
          } catch (err) {
            updateAttachedFile(localId, {
              status: 'error',
              errorText: `読込失敗: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
        })();
      }
    },
    [addAttachedFile, updateAttachedFile],
  );

  return { attach };
}
