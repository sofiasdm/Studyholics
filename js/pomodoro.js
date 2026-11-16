// js/pomodoro.js
// Cronômetro baseado em timestamps: o tempo restante é calculado pelo relógio real,
// então não atrasa quando a aba fica em segundo plano. O tempo de FOCO é acumulado
// em milissegundos (só enquanto está em modo foco e rodando).
export class PomodoroTimer {
  constructor(onTick, onAlarme, onMudarSessao, onConcluirTudo) {
    this.config = { foco: 25, pausaCurta: 5, pausaLonga: 10, intervalosPausaLonga: 4 };
    this.modo = "foco";          // 'foco', 'pausaCurta' ou 'pausaLonga'
    this.ciclosCompletos = 0;    // pomodoros de foco concluídos
    this.restanteMs = this.config.foco * 60000;
    this.msFoco = 0;             // total de foco acumulado
    this.fim = 0;                // timestamp em que a fase atual termina (só rodando)
    this.ultimo = 0;             // timestamp da última contabilização de foco
    this.intervalo = null;

    this.onTick = onTick;
    this.onAlarme = onAlarme;
    this.onMudarSessao = onMudarSessao;
    this.onConcluirTudo = onConcluirTudo;
  }

  get rodando() { return this.intervalo !== null; }

  // Segundos restantes da fase atual
  get tempoRestante() {
    const ms = this.rodando ? Math.max(0, this.fim - Date.now()) : this.restanteMs;
    return Math.ceil(ms / 1000);
  }

  // Minutos inteiros de foco acumulados até agora
  get minutosFocados() {
    this.acumular();
    return Math.floor(this.msFoco / 60000);
  }

  // Aceita só números inteiros >= 1; o que for inválido mantém o valor anterior.
  // Só vale com o cronômetro parado: reinicia na fase de foco.
  configurar(novas = {}) {
    if (this.rodando) return;
    for (const chave of Object.keys(this.config)) {
      const n = Math.floor(Number(novas[chave]));
      if (Number.isFinite(n) && n >= 1) this.config[chave] = n;
    }
    this.modo = "foco";
    this.restanteMs = this.config.foco * 60000;
    if (this.onTick) this.onTick(this.formatarTempo());
  }

  // Volta ao estado inicial (usado ao abandonar a sessão)
  resetar() {
    this.pausar();
    this.modo = "foco";
    this.ciclosCompletos = 0;
    this.msFoco = 0;
    this.restanteMs = this.config.foco * 60000;
    if (this.onTick) this.onTick(this.formatarTempo());
  }

  // Soma ao total de foco o tempo decorrido desde a última contabilização.
  // Nunca passa do fim da fase, então o foco não "vaza" para dentro da pausa.
  acumular() {
    if (!this.rodando) return;
    const agora = Date.now();
    if (this.modo === "foco") this.msFoco += Math.max(0, Math.min(agora, this.fim) - this.ultimo);
    this.ultimo = agora;
  }

  iniciar() {
    if (this.rodando) return;
    const agora = Date.now();
    this.fim = agora + this.restanteMs;
    this.ultimo = agora;
    this.intervalo = setInterval(() => this.tick(), 250);
  }

  pausar() {
    if (!this.rodando) return;
    this.acumular();
    this.restanteMs = Math.max(0, this.fim - Date.now());
    clearInterval(this.intervalo);
    this.intervalo = null;
  }

  tick() {
    this.acumular();
    if (Date.now() >= this.fim) this.alternarModo();
    else if (this.onTick) this.onTick(this.formatarTempo());
  }

  // [N1: guardar e retomar o estado]
  exportar() {
    this.acumular();
    return {
      config: { ...this.config }, modo: this.modo, ciclosCompletos: this.ciclosCompletos,
      restanteMs: this.rodando ? Math.max(0, this.fim - Date.now()) : this.restanteMs,
      msFoco: this.msFoco, rodando: this.rodando, fim: this.fim, ultimo: this.ultimo,
    };
  }

  restaurar(e = {}) {
    this.pausar();
    const naoNeg = (v, padrao = 0) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : padrao);
    for (const chave of Object.keys(this.config)) {
      const n = Math.floor(Number(e.config?.[chave]));
      if (Number.isFinite(n) && n >= 1) this.config[chave] = n;
    }
    this.modo = ["foco", "pausaCurta", "pausaLonga"].includes(e.modo) ? e.modo : "foco";
    this.ciclosCompletos = Math.floor(naoNeg(e.ciclosCompletos));
    this.msFoco = naoNeg(e.msFoco);
    this.restanteMs = naoNeg(e.restanteMs, this.config.foco * 60000);
    if (e.rodando && Number.isFinite(Number(e.fim)) && Number.isFinite(Number(e.ultimo))) {
      this.fim = Number(e.fim);
      this.ultimo = Number(e.ultimo);
      this.intervalo = setInterval(() => this.tick(), 250);
      const alarme = this.onAlarme;
      this.onAlarme = null;   // não toca alarme das fases que passaram com a página fechada
      // [N1-fix: desconta fase por fase, usando o fim de cada uma como início da seguinte]
      let guarda = 0;
      while (Date.now() >= this.fim && guarda++ < 1000) {
        const fimDaFase = this.fim;
        this.acumular();                          // soma o foco que cabe até o fim desta fase
        this.alternarModo();                      // passa para a fase seguinte
        this.fim = fimDaFase + this.restanteMs;   // ela começou quando a anterior terminou, não agora
        this.ultimo = fimDaFase;
      }
      this.onAlarme = alarme;
    }
    if (this.onTick) this.onTick(this.formatarTempo());
  }

  // Troca de fase com o cronômetro rodando (o intervalo continua)
  alternarModo(inicio = Date.now()) {
    let mensagem;
    if (this.modo === "foco") {
      this.ciclosCompletos++;

      //Verifica se atingiu o número finito de sessões configurado
      if (this.ciclosCompletos >= this.config.totalSessoes) {
        clearInterval(this.intervalo);
        this.intervalo = null;
        this.restanteMs = 0;
        if (this.onTick) this.onTick("00:00");
        if (this.onConcluirTudo) this.onConcluirTudo();
        return;
      }
      
      if (this.onMudarSessao) this.onMudarSessao(this.ciclosCompletos + 1);
      if (this.ciclosCompletos % this.config.intervalosPausaLonga === 0) {
        this.modo = "pausaLonga";
        this.restanteMs = this.config.pausaLonga * 60000;
        mensagem = "Pausa longa! Descanse.";
      } else {
        this.modo = "pausaCurta";
        this.restanteMs = this.config.pausaCurta * 60000;
        mensagem = "Pausa curta! Respire um pouco.";
      }
    } else {
      this.modo = "foco";
      this.restanteMs = this.config.foco * 60000;
      mensagem = "De volta ao foco!";
    }
    const agora = Date.now();
    this.fim = inicio + this.restanteMs;
    this.ultimo = inicio;
    if (this.onTick) this.onTick(this.formatarTempo());
    if (this.onAlarme) this.onAlarme(mensagem);
  }

  formatarTempo() {
    const t = this.tempoRestante;
    const min = Math.floor(t / 60).toString().padStart(2, "0");
    const seg = (t % 60).toString().padStart(2, "0");
    return `${min}:${seg}`;
  }
}