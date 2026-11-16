// js/grupos-util.js
// RF11 – Criação de grupos de estudo.
//
// Lógica da criação SEM DOM e SEM importar o Supabase, por isso testável em Node.
// As regras de validação são as MESMAS da função grupo_criar do banco
// (supabase/migrations/202611080001_grupos.sql): o front barra o erro antes, o banco continua
// sendo a palavra final. As funções que falam com o servidor recebem o `rpc` como parâmetro
// (injeção de dependência): na página é o rpc() real de grupos.js; nos testes, um falso.

export const LIMITES_GRUPO = {
  nomeMin: 3, nomeMax: 100,
  descricaoMax: 500,
  senhaMin: 6, senhaMax: 80,
  disciplinaMax: 100,
};

// O Postgres conta caracteres (char_length); [...texto] conta igual, inclusive com emoji.
const tamanho = texto => [...texto].length;

// "Programação 1, Matemática Discreta,, Programação 1 " -> ["Programação 1", "Matemática Discreta"]
export function separarDisciplinas(texto) {
  return [...new Set(String(texto ?? "").split(",").map(s => s.trim()).filter(Boolean))];
}

// Entrada: { nome, descricao, senha, disciplinas } (tudo texto, como vem do formulário;
//           disciplinas é o texto separado por vírgulas).
// Saída:   { ok, erros: { campo: mensagem }, valores } — valores já com os nomes dos
//          parâmetros da função grupo_criar.
export function validarNovoGrupo(entrada) {
  const erros = {};
  const nome = String(entrada.nome ?? "").trim();
  const descricao = String(entrada.descricao ?? "").trim();
  const senha = String(entrada.senha ?? ""); // a senha NÃO é aparada: espaço também conta
  const disciplinas = separarDisciplinas(entrada.disciplinas);
  const L = LIMITES_GRUPO;

  if (tamanho(nome) < L.nomeMin || tamanho(nome) > L.nomeMax)
    erros.nome = `O nome deve ter de ${L.nomeMin} a ${L.nomeMax} caracteres.`;

  if (tamanho(descricao) > L.descricaoMax)
    erros.descricao = `A descrição deve ter até ${L.descricaoMax} caracteres.`;

  if (tamanho(senha) < L.senhaMin || tamanho(senha) > L.senhaMax)
    erros.senha = `A senha deve ter de ${L.senhaMin} a ${L.senhaMax} caracteres.`;

  if (!disciplinas.length) erros.disciplinas = "Informe ao menos uma disciplina.";
  else if (disciplinas.some(d => tamanho(d) > L.disciplinaMax)) erros.disciplinas = "Disciplina inválida.";

  return {
    ok: Object.keys(erros).length === 0,
    erros,
    valores: { p_nome: nome, p_descricao: descricao, p_senha: senha, p_disciplinas: disciplinas },
  };
}

// Valida e cria o grupo. Dados inválidos NÃO chegam ao servidor.
// Devolve { ok: true, id } ou { ok: false, erros }. Se o servidor recusar, o erro do rpc sobe.
export async function criarGrupo(rpc, entrada) {
  const validacao = validarNovoGrupo(entrada);
  if (!validacao.ok) return { ok: false, erros: validacao.erros };
  const id = await rpc("grupo_criar", validacao.valores);
  return { ok: true, id };
}
