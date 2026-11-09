// js/perfil-funcoes.js
// Funções PURAS do perfil (sem Supabase e sem DOM), por isso testáveis em Node:
// validação do formulário, validação da foto e formatação de textos.

// Limites iguais aos das colunas da tabela ESTUDANTE (primeiro_nome 60, sobrenome 100, campus 80)
export const LIMITES = { nome: 60, sobrenome: 100, campus: 80 };

// Mesmos limites do bucket "avatars" no Supabase (tipos e 2 MB)
export const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];
export const MAX_FOTO = 2 * 1024 * 1024;

// Opções do campo Campus. Para incluir outro, basta acrescentar uma linha aqui.
// O primeiro (CAMPUS_ATIVO) é o único com cursos liberados; os outros mostram "Em breve".
export const CAMPI = [
  "UFRPE - Dois Irmãos (sede)",
  "UFRPE - Cabo de Santo Agostinho (UACSA)",
  "UFRPE - Serra Talhada (UAST)",
  "UFRPE - Belo Jardim (UABJ)",
];
export const CAMPUS_ATIVO = CAMPI[0];

// Minutos -> "13h 30min" ou "45min" do exemplo da imagem, para fins de teste 
export function formatarMinutos(min) {
  const total = Math.max(0, Math.floor(Number(min) || 0));
  const h = Math.floor(total / 60), m = total % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export const rotuloSemestre = n => (n ? `${n}º Semestre` : "Não informado");

// Texto da barra de nível: "350 / 700 pts" ou "1600 pts - nível máximo" para fins de este 
export function textoXp(pontos, proximo) {
  return proximo ? `${pontos} / ${proximo.pontos_minimos} pts` : `${pontos} pts · nível máximo`;
}

// Devolve "" se a foto servir, ou o texto do erro
export function validarFoto(arquivo) {
  if (!arquivo) return "";
  if (!TIPOS_FOTO.includes(arquivo.type)) return "Use uma foto JPG, PNG ou WebP.";
  if (arquivo.size > MAX_FOTO) return "A foto pode ter no máximo 2 MB.";
  return "";
}

// Tira espaços das pontas e junta espaços repetidos ("Ana   Maria " -> "Ana Maria")
const limpar = texto => String(texto ?? "").trim().replace(/\s+/g, " ");

// Valida o formulário de edição.
// Entrada: { nome, sobrenome, idCurso, semestre, campus } (tudo texto, como vem dos campos)
//          + opcionais: exigeCampus (padrão false), exigeCurso e exigePeriodo (padrão true).
//          Use exigeCurso/exigePeriodo = false quando o campo está desabilitado ("Em breve" / "Não se aplica").
// Saída:   { ok, erros: { campo: mensagem }, valores } — valores já nos nomes/tipos das colunas.
export function validarPerfil(entrada) {
  const erros = {};
  const nome = limpar(entrada.nome);
  const sobrenome = limpar(entrada.sobrenome);
  const campus = limpar(entrada.campus);
  const idCurso = Number(entrada.idCurso);
  const semestre = Number(entrada.semestre);
  const { exigeCampus = false, exigeCurso = true, exigePeriodo = true } = entrada;

  if (!nome) erros.nome = "Informe seu nome.";
  else if (nome.length > LIMITES.nome) erros.nome = `Use no máximo ${LIMITES.nome} caracteres.`;

  if (!sobrenome) erros.sobrenome = "Informe seu sobrenome.";
  else if (sobrenome.length > LIMITES.sobrenome) erros.sobrenome = `Use no máximo ${LIMITES.sobrenome} caracteres.`;

  if (exigeCampus && !campus) erros.campus = "Selecione seu campus.";

  if (exigeCurso && (!entrada.idCurso || !Number.isInteger(idCurso) || idCurso < 1)) erros.curso = "Selecione seu curso.";

  if (exigePeriodo && (!entrada.semestre || !Number.isInteger(semestre) || semestre < 1 || semestre > 10))
    erros.semestre = "Selecione seu período.";

  if (campus.length > LIMITES.campus) erros.campus = `Use no máximo ${LIMITES.campus} caracteres.`;

  return {
    ok: Object.keys(erros).length === 0,
    erros,
    valores: {
      primeiro_nome: nome,
      sobrenome,
      id_curso: entrada.idCurso ? idCurso : null,   // vazio = campo desabilitado ("Em breve" / "Não se aplica")
      semestre: entrada.semestre ? semestre : null,
      campus: campus || null, // vazio = "não informado"
    },
  };
}