# Studyholics

Site estático feito com HTML, CSS e JavaScript, usando Vite para desenvolvimento local e geração dos arquivos de publicação.

## Desenvolvimento

Requer Node.js 20.19 ou superior e npm.

```sh
npm install
npm run dev
```

Abra o endereço local exibido pelo Vite no terminal.

## Build de produção

```sh
npm run build
npm run preview
```

O Vite gera o site pronto para hospedagem estática na pasta `dist/`.

## Estrutura

- `index.html`, `style.css`, `app.js`: site e interações do navegador.
- `public/`: imagens, favicon e `robots.txt`, copiados sem alteração para o build.
- `package.json` e `package-lock.json`: scripts e dependências de desenvolvimento.

O cliente Supabase está disponível como dependência, mas as telas de login e cadastro atuais ainda são apenas interface: o formulário não cria contas, não autentica usuários e não envia dados ao Supabase.

## Publicação na Vercel

Importe o repositório GitHub na Vercel, mantenha a raiz do projeto como diretório raiz e use o preset Vite. Configure o comando de build como `npm run build` e a pasta de saída como `dist`. Depois, cada push para a branch conectada inicia uma nova publicação.

Se o site passar a chamar o Supabase, configure as variáveis necessárias em **Project Settings → Environment Variables** na Vercel e mantenha as chaves privadas fora do JavaScript público.
