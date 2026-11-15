import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatarMinutos, rotuloSemestre, textoXp, validarFoto, validarPerfil, MAX_FOTO,
} from "./perfil-util.js";

const ok = { nome: "Sofia", sobrenome: "Duarte", idCurso: "1", semestre: "5", campus: "UFRPE - Dois Irmãos" };

test("formatarMinutos", () => {
  assert.equal(formatarMinutos(810), "13h 30min");
  assert.equal(formatarMinutos(45), "45min");
  assert.equal(formatarMinutos(0), "0min");
  assert.equal(formatarMinutos(null), "0min");
  assert.equal(formatarMinutos(-5), "0min");
});

test("rotuloSemestre e textoXp", () => {
  assert.equal(rotuloSemestre(5), "5º Semestre");
  assert.equal(rotuloSemestre(null), "Não informado");
  assert.equal(textoXp(350, { pontos_minimos: 700 }), "350 / 700 pts");
  assert.equal(textoXp(7000, null), "7000 pts · nível máximo");
});

test("validarFoto: tipo e tamanho", () => {
  assert.equal(validarFoto(null), "");
  assert.equal(validarFoto({ type: "image/png", size: 1000 }), "");
  assert.match(validarFoto({ type: "application/pdf", size: 1000 }), /JPG, PNG ou WebP/);
  assert.match(validarFoto({ type: "image/jpeg", size: MAX_FOTO + 1 }), /2 MB/);
  assert.equal(validarFoto({ type: "image/webp", size: MAX_FOTO }), "");
});

test("validarPerfil: dados corretos viram os nomes e tipos das colunas", () => {
  const r = validarPerfil(ok);
  assert.equal(r.ok, true);
  assert.deepEqual(r.valores, {
    primeiro_nome: "Sofia", sobrenome: "Duarte", id_curso: 1, semestre: 5, campus: "UFRPE - Dois Irmãos",
  });
});

test("validarPerfil: limpa espaços e campus vazio vira null", () => {
  const r = validarPerfil({ ...ok, nome: "  Ana   Maria ", campus: "  " });
  assert.equal(r.valores.primeiro_nome, "Ana Maria");
  assert.equal(r.valores.campus, null);
});

test("validarPerfil: campos obrigatórios", () => {
  const r = validarPerfil({ nome: "  ", sobrenome: "", idCurso: "", semestre: "", campus: "" });
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.erros), ["nome", "sobrenome", "curso", "semestre"]);
});

test("validarPerfil: limites das colunas e semestre 1-10", () => {
  assert.ok(validarPerfil({ ...ok, nome: "a".repeat(61) }).erros.nome);
  assert.ok(validarPerfil({ ...ok, sobrenome: "a".repeat(101) }).erros.sobrenome);
  assert.ok(validarPerfil({ ...ok, campus: "a".repeat(81) }).erros.campus);
  assert.ok(validarPerfil({ ...ok, semestre: "11" }).erros.semestre);
  assert.ok(validarPerfil({ ...ok, semestre: "0" }).erros.semestre);
  assert.ok(validarPerfil({ ...ok, semestre: "2.5" }).erros.semestre);
  assert.equal(validarPerfil({ ...ok, nome: "a".repeat(60) }).ok, true);
});