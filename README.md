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

- `index.html`, `style.css`, `app.js`: site e interações do navegador.
- `public/`: imagens, favicon e `robots.txt`, copiados sem alteração para o build.
- `package.json` e `package-lock.json`: scripts e dependências de desenvolvimento.


## Próximos Passos:

- [ ] Conectar com o banco de dados e estruturar o back-end
- [ ] Criar um perfil de teste para validar funções de cadastro
- [ ] Criar a funcionalidade do Pomodoro
- [ ] Criar a funcionalidade de Gerenciamento de Perfil

