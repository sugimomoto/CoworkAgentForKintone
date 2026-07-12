// Cowork Agent for kintone — Memory トグルの per-user 永続化 (#15)
//
// 認証情報や会話データではない単なる UI 設定なので localStorage 保存は許容 (§3.2)。
// キーは (kintoneDomain × kintoneUserCode) 単位。既定 ON (opt-out)。

export function memoryEnabledStorageKey(kintoneDomain: string, kintoneUserCode: string): string {
  return `cowork-agent:memory-enabled:${kintoneDomain}:${kintoneUserCode}`;
}

/** 保存値を読む。未保存 / 参照不可なら既定 true (opt-out)。 */
export function readMemoryEnabled(kintoneDomain: string, kintoneUserCode: string): boolean {
  try {
    const raw = localStorage.getItem(memoryEnabledStorageKey(kintoneDomain, kintoneUserCode));
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    // localStorage 不可環境は既定 true
  }
  return true;
}

export function writeMemoryEnabled(
  kintoneDomain: string,
  kintoneUserCode: string,
  value: boolean,
): void {
  try {
    localStorage.setItem(memoryEnabledStorageKey(kintoneDomain, kintoneUserCode), String(value));
  } catch {
    // 保存不可でも state 側は更新される
  }
}
