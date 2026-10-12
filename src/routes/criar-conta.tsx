import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout, SignupHeader } from "@/components/studyholics/auth-layout";
import { SignupForm } from "@/components/studyholics/auth-forms";

export const Route = createFileRoute("/criar-conta")({
  head: () => ({ meta: [
    { title: "Criar conta — Studyholics" },
    { name: "description", content: "Comece sua jornada no Studyholics com seus dados básicos." },
    { property: "og:title", content: "Criar conta — Studyholics" },
    { property: "og:description", content: "Comece sua jornada no Studyholics com seus dados básicos." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: SignupPage,
});

function SignupPage() {
  return <AuthLayout signup>
    <div className="signup-content">
      <SignupHeader />
      <section className="signup-body" aria-labelledby="signup-title">
        <h1 id="signup-title">Criar conta</h1>
        <p className="auth-subtitle">Vamos começar com seus dados básicos.</p>
        <SignupForm />
      </section>
      <footer className="signup-footer"><span className="terms-label" title="O conteúdo dos termos ainda não foi fornecido.">Termos e condições</span></footer>
    </div>
  </AuthLayout>;
}