# RF10 — Acompanhamento do progresso

Execute no terminal do VS Code, na raiz do projeto:

```sh
node tests/rf10-progresso.test.js
```

Requer Node.js 20.19 ou superior. Os quatro testes usam `node:test`, sem dependências adicionais. A página real (`pages/pagina-inicial.html` e `js/pagina-inicial.js`) é carregada com DOM, relógio e respostas do Supabase simulados em memória. Nenhuma conta ou dado real é alterado.

| Teste | Critérios de entrada | Saída e resultado esperado | Resultado obtido em 11/11/2026 |
| --- | --- | --- | --- |
| 1. Reabertura do painel (CT11, na camada de apresentação) | Duas sessões finalizadas de 30 e 45 min, 85 pontos; abrir o painel em dois contextos com as mesmas respostas | `horas-total = 1h 15min`, `pontos-total = 85 pts` e duas sessões na lista em ambas as aberturas | **Passou.** Os valores foram iguais nas duas aberturas simuladas. |
| 2. Repetição da leitura de pontos (CT13, na camada de apresentação) | Perfil com 190 pontos acumulados e saldo 40; renderizar duas vezes a mesma resposta | O cartão permanece em `190 pts`, sem somar novamente e sem confundir saldo com pontos acumulados | **Passou.** O valor exibido continuou `190 pts`. |
| 3. Contagem de sessões (CT17) | Duas sessões finalizadas | Dashboard contém o indicador `sessoes-total` com valor `2` | **Falhou.** O indicador não existe na página. |
| 4. Atualização após nova atividade | Na quarta-feira, 60 min na segunda e 30 min na quarta; depois nova sessão de 30 min e perfil com 130 pontos | Inicialmente gráfico/meta em `1h 30min`; após evento, sem recarregar: `horas-total = 2h 0min`, `pontos-total = 130 pts`, meta `2h 0min` e barra de quarta `1h 0min` | **Falhou.** O gráfico inicial estava correto, mas as horas continuaram em `1h 30min` após a nova sessão. |

Resultado da execução: **4 testes, 2 passaram e 2 falharam**. O comando termina com código `1` porque os testes 3 e 4 registram comportamentos exigidos pelo RF10 ainda ausentes.

## Alcance e sugestões

- Os testes 1 e 2 verificam a apresentação de respostas persistidas e repetidas. Como o Supabase é simulado, **não comprovam persistência real nem a idempotência da pontuação no banco**. O arquivo existente `supabase/tests/gamificacao.sql` inclui verificações transacionais de pontos duplicados (CT13) e isolamento entre usuários (CT14), mas exige um Supabase/PostgreSQL preparado e não foi executado nesta rodada.
- Para completar o RF10, adicionar ao painel um contador de sessões concluídas com critério explícito de conclusão. O projeto já usa `finalizada_em` para listar sessões; em `js/perfil.js`, a contagem atual usa `elegivel`. É preciso decidir qual regra representa “concluída” antes de consolidar as telas.
- Atualizar cartões e gráfico após concluir uma sessão, por exemplo por evento do Supabase Realtime ou por uma rotina de atualização ao voltar para a página. Evitar contar novamente uma sessão já processada.
- A consulta atual de sessões usa `limit(1000)` em `js/pagina-inicial.js`; portanto, `horas-total` pode deixar de ser um total vitalício para contas com mais de mil sessões. Um agregado no backend resolveria o limite.
- Executar também os testes SQL existentes em um ambiente de testes isolado para validar CT13 e CT14 de ponta a ponta. A suíte Node desta pasta permanece totalmente local e somente leitura.
