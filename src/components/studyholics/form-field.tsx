import { useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | undefined;
  icon?: LucideIcon;
  appearance?: "login" | "signup";
};

export function FormField({ label, error, icon: Icon, appearance = "signup", type = "text", ...props }: FormFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const password = type === "password";
  return <div className={`study-field study-field-${appearance}`}>
    <label className="sr-only" htmlFor={id}>{label}</label>
    <div className={`study-input-wrap ${error ? "has-error" : ""}`}>
      {Icon && <Icon className="field-leading-icon" aria-hidden="true" />}
      <input {...props} id={id} type={password && visible ? "text" : type} placeholder={label} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
      {password && <Button type="button" variant="study-icon" size="icon" className="password-toggle" aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff /> : <Eye />}</Button>}
    </div>
    {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
  </div>;
}