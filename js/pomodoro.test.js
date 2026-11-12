import { PomodoroTimer } from './pomodoro.js';

describe('RF04 - Testes de Unidade Automatizados (PomodoroTimer)', () => {
  let timer;

  beforeEach(() => {
    // Instância limpa para cada caso de teste
    timer = new PomodoroTimer();
  });

  afterEach(() => {
    // Garante o encerramento dos timers de intervalo após os testes
    timer.pausar();
  });

  // CT08 - Configurar Pomodoro
  test('CT08: deve atualizar as configurações de foco e pausa quando o temporizador estiver parado', () => {
    timer.configurar({ foco: 30, pausaCurta: 10 });

    expect(timer.config.foco).toBe(30);
    expect(timer.config.pausaCurta).toBe(10);
    expect(timer.tempoRestante).toBe(30 * 60);
  });

  // CT09 - Pausar e retomar temporizador
  test('CT09: deve pausar a contagem alterando a propriedade rodando para false', () => {
    timer.iniciar();
    expect(timer.rodando).toBe(true);

    timer.pausar();
    expect(timer.rodando).toBe(false);
  });

  // CT10 - Resetar temporizador
  test('CT10: deve resetar o temporizador voltando ao estado inicial e zerando contadores', () => {
    timer.iniciar();
    timer.ciclosCompletos = 2;
    timer.msFoco = 120000;

    timer.resetar();

    expect(timer.rodando).toBe(false);
    expect(timer.modo).toBe('foco');
    expect(timer.ciclosCompletos).toBe(0);
    expect(timer.msFoco).toBe(0);
  });

  // CT21 - Impedir reconfiguração em execução
  test('CT21: não deve alterar a configuração se o temporizador estiver rodando', () => {
    timer.iniciar();
    timer.configurar({ foco: 50 });

    // O valor original (25) deve ser mantido
    expect(timer.config.foco).toBe(25);
  });
});