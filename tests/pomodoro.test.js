import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { PomodoroTimer } from "../js/pomodoro.js";

const T0 = 1_700_000_000_000;

test("exportar/restaurar: cronômetro parado volta igual", () => {
  mock.timers.enable({ apis: ["Date", "setInterval"], now: T0 });
  try {
    const a = new PomodoroTimer();
    a.configurar({ foco: 25, pausaCurta: 5, pausaLonga: 10, intervalosPausaLonga: 4 });
    a.iniciar();
    mock.timers.tick(90_000);                       // 1 min 30 s de foco
    a.pausar();
    const estado = JSON.parse(JSON.stringify(a.exportar()));

    const b = new PomodoroTimer();
    b.restaurar(estado);
    assert.equal(b.rodando, false);
    assert.equal(b.modo, "foco");
    assert.equal(b.minutosFocados, 1);
    assert.equal(b.formatarTempo(), a.formatarTempo());
  } finally { mock.timers.reset(); }
});

test("restaurar com o cronômetro rodando recalcula as fases que passaram com a página fechada", () => {
  mock.timers.enable({ apis: ["Date", "setInterval"], now: T0 });
  try {
    const a = new PomodoroTimer();
    a.configurar({ foco: 1, pausaCurta: 1, pausaLonga: 2, intervalosPausaLonga: 4 });
    a.iniciar();
    const estado = JSON.parse(JSON.stringify(a.exportar()));
    a.pausar();

    mock.timers.tick(150_000);                      // 2 min 30 s depois: 1 min de foco + 1 min de pausa + 30 s de foco
    const alarmes = [];
    const b = new PomodoroTimer(null, m => alarmes.push(m));
    b.restaurar(estado);
    assert.equal(b.rodando, true);
    assert.equal(b.modo, "foco");
    assert.equal(b.ciclosCompletos, 1);
    assert.equal(b.minutosFocados, 1 + 0);          // 1 min completo + 30 s ainda não fecham outro minuto
    assert.equal(b.formatarTempo(), "00:30");
    assert.deepEqual(alarmes, []);                  // sem tocar alarme das fases antigas
    b.pausar();
    assert.equal(b.minutosFocados, 1);
  } finally { mock.timers.reset(); }
});

test("restaurar ignora lixo no estado", () => {
  const t = new PomodoroTimer();
  t.restaurar({ config: { foco: "abc" }, modo: "xyz", msFoco: -5, restanteMs: "x" });
  assert.equal(t.modo, "foco");
  assert.equal(t.config.foco, 25);
  assert.equal(t.msFoco, 0);
  assert.equal(t.rodando, false);
});
