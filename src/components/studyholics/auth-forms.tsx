import { useState, type FormEvent } from "react";
import { LockKeyhole, Mail, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { validateLogin, validateSignup, type LoginValues, type SignupValues, type FormErrors } from "@/lib/auth-validation";
import { FormField } from "./form-field";

export function LoginForm() {
  const [values, setValues] = useState<LoginValues>({ username: "", password: "" });
  const [errors, setErrors] = useState<FormErrors<LoginValues>>({});
  const [valid, setValid] = useState(false);
  function update(key: keyof LoginValues, value: string) {
    setValues(previous => ({ ...previous, [key]: value }));
    setErrors(previous => ({ ...previous, [key]: undefined }));
    setValid(false);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const next = validateLogin(values);
    setErrors(next);
    setValid(Object.keys(next).length === 0);
  }
  return <form className="login-form" onSubmit={submit} noValidate>
    <h2>Login</h2>
    <div className="login-fields">
      <FormField label="Nome de usuário" appearance="login" autoComplete="username" value={values.username} error={errors.username} onChange={event => update("username", event.target.value)} />
      <FormField label="Senha" appearance="login" type="password" autoComplete="current-password" value={values.password} error={errors.password} onChange={event => update("password", event.target.value)} />
      <Button variant="study" size="study" type="submit">Entrar</Button>
    </div>
    {valid && <p className="form-status" role="status">Dados validados. O acesso à conta estará disponível na próxima etapa.</p>}
  </form>;
}

export function SignupForm() {
  const [values, setValues] = useState<SignupValues>({ name: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<FormErrors<SignupValues>>({});
  const [valid, setValid] = useState(false);
  function update(key: keyof SignupValues, value: string) {
    setValues(previous => ({ ...previous, [key]: value }));
    setErrors(previous => ({ ...previous, [key]: undefined }));
    setValid(false);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const next = validateSignup(values);
    setErrors(next);
    setValid(Object.keys(next).length === 0);
  }
  return <form className="signup-form" onSubmit={submit} noValidate>
    <div className="signup-fields">
      <FormField label="Nome Completo" icon={UserRound} autoComplete="name" value={values.name} error={errors.name} onChange={event => update("name", event.target.value)} />
      <FormField label="E-mail" icon={Mail} type="email" autoComplete="email" value={values.email} error={errors.email} onChange={event => update("email", event.target.value)} />
      <FormField label="Senha" icon={LockKeyhole} type="password" autoComplete="new-password" value={values.password} error={errors.password} onChange={event => update("password", event.target.value)} />
      <FormField label="Confirmar senha" icon={LockKeyhole} type="password" autoComplete="new-password" value={values.confirmPassword} error={errors.confirmPassword} onChange={event => update("confirmPassword", event.target.value)} />
    </div>
    <Button variant="study" size="study" type="submit">Próximo</Button>
    {valid && <p className="form-status" role="status">Dados validados. Nenhuma conta foi criada nesta etapa.</p>}
  </form>;
}