import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "./brand";

export function AuthLayout({ children, signup = false }: { children: ReactNode; signup?: boolean }) {
  return <main className={signup ? "auth-page signup-page" : "auth-page login-page"}>{children}</main>;
}

export function BrandHeader() {
  return <header className="login-brand-header"><Brand /></header>;
}

export function SignupHeader() {
  return <header className="signup-header">
    <nav className="signup-navigation" aria-label="Navegação do cadastro">
      <Button asChild variant="study-icon" size="icon"><Link to="/" aria-label="Voltar para login"><ArrowLeft /></Link></Button>
      <ol className="signup-progress" aria-label="Etapa 1 de 4">
        {[1, 2, 3, 4].map(step => <li key={step} className={step === 1 ? "current" : ""} aria-current={step === 1 ? "step" : undefined}><span className="sr-only">Etapa {step}</span></li>)}
      </ol>
    </nav>
    <Brand compact />
  </header>;
}