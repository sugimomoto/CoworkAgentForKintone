// Cowork Agent for kintone — カスタム skill 投入の入力型
//
// UI (SkillAddModal) と core (chatPanelSkillsSync) の双方が参照する純粋なデータ型。
// レイヤー逆転 (core → desktop) を避けるため core に置く。

/** Skill bundle 内の 1 ファイル (zip/.skill 展開後の各 entry) */
export interface SkillFileEntry {
  /** zip 内 path。`<name>/` prefix は呼出側で正規化されるので相対 path のままで可 */
  path: string;
  /** UTF-8 テキスト本文 */
  content: string;
}

/** カスタム skill 投入時の引数 */
export interface CustomSkillInput {
  /** SKILL.md frontmatter の name (識別子) */
  name: string;
  /** description (1 行説明) */
  description: string;
  /** SKILL.md 本文 (frontmatter 含む) — 必ず含まれる (zip でも展開済 SKILL.md を入れる) */
  skillMd: string;
  /**
   * V2 #30: zip/.skill 展開で得られた複数ファイル。
   * 省略時は SKILL.md 単体 (= skillMd フィールドのみ) として送信。
   * 含まれる場合は SKILL.md 自体も `files[]` の中に entry として入っている前提。
   */
  files?: SkillFileEntry[];
}
