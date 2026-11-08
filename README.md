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

## Grupos de estudo e publicação no Vercel

1. Aplique no SQL Editor do Supabase, nesta ordem, a migração de gamificação (`supabase/migrations/202610270001_gamificacao.sql`, se ainda não estiver aplicada) e `supabase/migrations/202611080001_grupos.sql`. A migração de grupos aproveita `grupo_estudo` e `participacao` já existentes, adiciona permissões e cria as tabelas de mensagens, disciplinas e senhas.
2. No Vercel, configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com os valores públicos do projeto Supabase. O cliente ainda aceita os nomes antigos `NEXT_PUBLIC_` para desenvolvimento local. Nunca use a chave `service_role` no navegador.
3. Configure o projeto com **Build Command** `npm run build` e **Output Directory** `dist`. Publique após mesclar na `main`.

A senha de acesso de cada grupo é guardada no banco e só retornada aos organizadores pela função `grupo_detalhes`. A classificação semanal soma os minutos validados das sessões `gam_sessao`, apenas nas disciplinas do grupo e após a entrada do membro. Os dados da seção de grupos são atualizados a cada 15 segundos enquanto a aba está visível.

## Estrutura

- `index.html`, `style.css`, `app.js`: site e interações do navegador.
- `public/`: imagens, favicon e `robots.txt`, copiados sem alteração para o build.
- `package.json` e `package-lock.json`: scripts e dependências de desenvolvimento.


## Próximos Passos:

- [ ] Conectar com o banco de dados e estruturar o back-end
- [ ] Criar um perfil de teste para validar funções de cadastro
- [ ] Criar a funcionalidade do Pomodoro
- [ ] Criar a funcionalidade de Gerenciamento de Perfil

