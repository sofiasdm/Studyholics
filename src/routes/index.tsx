import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AuthLayout, BrandHeader } from "@/components/studyholics/auth-layout";
import { LoginForm } from "@/components/studyholics/auth-forms";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Login — Studyholics" },
    { name: "description", content: "Bem-vindo de volta ao Studyholics. Estude, evolua e compartilhe." },
    { property: "og:title", content: "Login — Studyholics" },
    { property: "og:description", content: "Bem-vindo de volta ao Studyholics. Estude, evolua e compartilhe." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

function Index() {
  return <AuthLayout>
    <BrandHeader />
    <section className="login-content" aria-labelledby="login-title">
      <div className="login-content-inner">
        <h1 id="login-title">Bem-vindo <span>de volta!</span></h1>
        <p className="auth-subtitle">Faça login para continuar sua jornada.</p>
        <LoginForm />
        <footer className="login-footer">
          <p>Ainda não tem uma conta?</p>
          <Button asChild variant="study" size="study"><Link to="/criar-conta">Criar Conta</Link></Button>
        </footer>
      </div>
    </section>
  </AuthLayout>;
}
