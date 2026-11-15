import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveLocal, inicioDiaUtc, minutosDaSemana, semanaLocal, somarDias } from "../js/estudo-datas.js";

test("a semana de Recife começa na segunda e termina no domingo", () => {
  assert.deepEqual(semanaLocal("2026-11-15T12:00:00Z"), [
    "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12",
    "2026-11-13", "2026-11-14", "2026-11-15"
  ]);
  assert.deepEqual(semanaLocal("2027-01-01T12:00:00Z"), [
    "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31",
    "2027-01-01", "2027-01-02", "2027-01-03"
  ]);
});

test("sessões perto da meia-noite entram no dia civil correto", () => {
  const sessions = [
    { finalizada_em: "2026-11-10T02:59:59Z", minutos_validos: 25 }, // segunda, 23:59 em Recife
    { finalizada_em: "2026-11-10T03:00:00Z", minutos_validos: 30 }, // terça, 00:00
    { finalizada_em: "2026-11-10T15:00:00Z", minutos_validos: 20 },
    { finalizada_em: "2026-11-16T02:59:59Z", minutos_validos: 10 }, // domingo, 23:59
    { finalizada_em: "2026-11-16T03:00:00Z", minutos_validos: 90 }  // próxima semana
  ];
  assert.deepEqual(minutosDaSemana(sessions, "2026-11-15T12:00:00Z").minutes,
    [25, 50, 0, 0, 0, 0, 10]);
  assert.equal(chaveLocal("2026-11-10T02:59:59Z"), "2026-11-09");
});

test("limites de data em Recife incluem o dia inteiro, inclusive ano bissexto", () => {
  assert.equal(inicioDiaUtc("2026-11-15"), "2026-11-15T03:00:00.000Z");
  assert.equal(inicioDiaUtc(somarDias("2026-11-15", 1)), "2026-11-16T03:00:00.000Z");
  assert.equal(somarDias("2028-02-28", 1), "2028-02-29");
  assert.equal(somarDias("2028-02-29", 1), "2028-03-01");
});
