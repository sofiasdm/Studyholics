# Studyholics

Site para acompanhamento de estudos.

Feito com HTML, CSS e JavaScript, usando Vite para desenvolvimento local e geração dos arquivos de publicação.

## Dependências para rodar localmente:

Requer Node.js 20.19 ou superior e npm.

- Windows
```sh
winget install OpenJS.NodeJS.LTS 
npm install
npm run dev
```
- Linux
```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
npm install --lts
npm run dev
```

### Verificar a instalação:

```sh
node -v
npm -v
```

## Build de produção

```sh
npm run build
npm run preview
npm run dev
```

O Vite gera o site pronto para hospedagem estática na pasta `dist/`.

## Estrutura

- `index.html`: telas de login, cadastro em três etapas e confirmação de acesso. Os caminhos `/#login` e `/#cadastro` abrem cada fluxo diretamente.
- `css/` e `js/`: estilos e interações do navegador. `js/app.js` conecta cadastro e login ao cliente Supabase.
- `js/supabaseClient.js`: cliente único usado pela autenticação e pelos acessos existentes ao banco.
- `assets/`: imagens, favicon e `robots.txt` usados pelo site.
- `package.json` e `package-lock.json`: scripts e dependências de desenvolvimento.

## Configuração do Supabase

Defina `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no ambiente local (`.env.local`) e nas variáveis de ambiente do Vercel. O site mantém a navegação disponível sem essas variáveis e informa quando login ou cadastro não podem ser realizados. Use somente a chave publicável no navegador; as políticas RLS e o trigger do banco continuam responsáveis por proteger e criar os dados.

Antes de publicar o cadastro, aplique o SQL em `supabase/migrations/202610260001_email_disponivel.sql` no projeto Supabase. Em Authentication → Email Templates → Confirm signup, use `{{ .Token }}` no modelo de e-mail para que o Supabase envie o código numérico aceito pela tela de confirmação. A confirmação do e-mail precisa estar habilitada em Authentication → Providers → Email.


## Próximos Passos:

- [ ] Criar a funcionalidade do Pomodoro
- [ ] Criar a funcionalidade de Gerenciamento de Perfil

