export const DISCIPLINAS_BCC = [   // Bacharelado
  "Programação 1", 
  "Programação 2", 
  "Circuitos Digitais", 
  "Matemática Discreta",
  "Matemática Discreta 2", 
  "Algoritmos e Estruturas de Dados", 
  "Estatística Exploratória", 
  "Algebra Linear", 
  "Calculo 1", 
  "Calculo 2", 
  "Arquitetura e Organização de Computadores", 
  "Sistemas Operacionais", 
  "Redes de Computadores",
  "Banco de Dados", 
  "Engenharia de Software", 
  "Interação Homem-máquina",
  "Laboratorio de Programação 1 e 2", 
  "Metodologia Científica Aplicada a Ciencia da Computação", 
  "Trabalho de Conclusão de Curso", 
  "Inteligencia Artificial", 
  "Teoria da Computação",
  "Projeto e análise de Algoritmos",
  "Compiladores",
  "Física aplicada à computação",
  "Redes Neurais",
  "Computação e Empreendedorismo",
  "Testes de Software",
  "Qualidade de Software",
  "Paradigmas da Programação"
];
export const DISCIPLINAS_LCC = [   // Licenciatura
  "Programação 1", 
  "Programação 2", 
  "Circuitos Digitais", 
  "Matemática Discreta",
  "Matemática Discreta 2",
  "Algoritmos e Estruturas de Dados", 
  "Estatística Exploratória", 
  "Algebra Linear", 
  "Calculo 1", 
  "Calculo 2",  
  "Arquitetura e Organização de Computadores", 
  "Sistemas Operacionais", 
  "Redes de Computadores",
  "Banco de Dados", 
  "Engenharia de Software", 
  "Interação Homem-máquina",
  "Fundamentos Sócio-Históricos e Filosóficos da Educação", 
  "Psicologia 1", 
  "Psicologia 2", 
  "Didática", 
  "Lesgislação Brasileira - Organização e políticas", 
  "Educação à distancia", 
  "Libras", 
  "Metodologia do Ensino de Computação",
  "Práticas de Ensino de Computação 1 e 2",  
  "Laboratorio de Programação 1 e 2", 
  "Estágio Supervisionado I",
  "Estágio Supervisionado II", 
  "Estágio Supervisionado III", 
  "Estágio Supervisionado IV", 
  "Metodologia Científica Aplicada a Ciencia da Computação", 
  "Trabalho de Conclusão de Curso", 
  "Projeto de Desenvolvimento de SW Educacional", 
  "Inteligencia Artificial", 
  "Teoria da Computação", 
  "Tecnologias na Educação"
];
export const DISCIPLINAS_POS = [
  "Metodologia da Pesquisa Científica", 
  "Seminários I", 
  "Seminários II", 
  "Estágio de Docência",
  "Dissertação de Mestrado", 
  "Tese de Doutorado",
  "Fundamentos do Ensino de Computação", 
  "Metodologia de Pesquisa em Ensino de Computação",
  "Teorias da Aprendizagem Aplicadas à Computação", 
  "Produto Educacional"
]; // PPGIA + ProfComp

const chave = n => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export function listaUnica(...grupos) {
  const vistas = new Map();
  for (const n of grupos.flat()) {
    const limpo = String(n).replace(/\s+/g, " ").trim();
    if (limpo && !vistas.has(chave(limpo))) vistas.set(chave(limpo), limpo);
  }
  return [...vistas.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
export const DISCIPLINAS = listaUnica(DISCIPLINAS_BCC, DISCIPLINAS_LCC, DISCIPLINAS_POS);

export const OUTRA_DISCIPLINA = "__outra__";
export const MAX_DISCIPLINA = 100;
export const MAX_TOPICO = 200;