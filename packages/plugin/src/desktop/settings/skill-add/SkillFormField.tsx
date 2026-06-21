export interface SkillFormFieldProps {
  label: string;
  children: React.ReactNode;
}

export function FormField({ label, children }: SkillFormFieldProps): JSX.Element {
  return (
    <label className="flex flex-col gap-[4px]">
      <span className="text-[10.5px] font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}
