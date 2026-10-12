// Interface-only rules. No passwords or form values are persisted or sent.
export type LoginValues = { username: string; password: string };
export type SignupValues = { name: string; email: string; password: string; confirmPassword: string };
export type FormErrors<T> = Partial<Record<keyof T, string>>;

export function validateLogin(values: LoginValues): FormErrors<LoginValues> {
  return {
    ...(!values.username.trim() ? { username: "Informe seu nome de usuário." } : {}),
    ...(!values.password ? { password: "Informe sua senha." } : {}),
  };
}

export function validateSignup(values: SignupValues): FormErrors<SignupValues> {
  const errors: FormErrors<SignupValues> = {};
  if (values.name.trim().length < 2) errors.name = "Informe seu nome completo.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Informe um e-mail válido.";
  if (values.password.length < 8) errors.password = "Use pelo menos 8 caracteres.";
  if (!values.confirmPassword) errors.confirmPassword = "Confirme sua senha.";
  else if (values.confirmPassword !== values.password) errors.confirmPassword = "As senhas precisam ser iguais.";
  return errors;
}