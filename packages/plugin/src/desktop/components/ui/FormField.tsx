// ラベル付きフォームフィールドの共通ラッパ。
// settings 配下で重複していた同一実装を集約 (Phase 4 PR-AB)。

export interface FormFieldProps {
  label: string;
  children: React.ReactNode;
}

export function FormField({ label, children }: FormFieldProps): JSX.Element {
  return (
    <label className="flex flex-col gap-[4px]">
      <span className="text-[10.5px] font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}
