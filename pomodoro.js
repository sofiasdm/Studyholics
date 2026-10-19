// pomodoro.js

class PomodoroTimer {
    constructor(onTick, onAlarme) {
        this.tempoFoco = 25 * 60; // 25 minutos em segundos
        this.tempoPausa = 5 * 60; // 5 minutos em segundos
        this.tempoRestante = this.tempoFoco;
        this.intervalo = null;
        this.modo = 'foco'; // Pode ser 'foco' ou 'pausa'
        
        // Callbacks (funções que avisarão a futura tela HTML quando o tempo mudar)
        this.onTick = onTick; 
        this.onAlarme = onAlarme;
    }

    iniciar() {
        if (this.intervalo) return; // Evita criar múltiplos relógios sobrepostos

        this.intervalo = setInterval(() => {
            this.tempoRestante--;
            
            // Avisa a interface que o tempo caiu 1 segundo
            if (this.onTick) this.onTick(this.formatarTempo());

            // Quando o tempo zera, alterna entre Foco e Pausa
            if (this.tempoRestante <= 0) {
                this.alternarModo();
            }
        }, 1000);
    }

    pausar() {
        clearInterval(this.intervalo);
        this.intervalo = null;
    }

    zerar() {
        this.pausar();
        this.modo = 'foco';
        this.tempoRestante = this.tempoFoco;
        if (this.onTick) this.onTick(this.formatarTempo());
    }

    alternarModo() {
        this.pausar();
        if (this.modo === 'foco') {
            this.modo = 'pausa';
            this.tempoRestante = this.tempoPausa;
            if (this.onAlarme) this.onAlarme('Hora de descansar! 5 minutos de pausa.');
        } else {
            this.modo = 'foco';
            this.tempoRestante = this.tempoFoco;
            if (this.onAlarme) this.onAlarme('Fim da pausa! De volta aos estudos.');
        }
        
        // Inicia automaticamente o próximo ciclo
        if (this.onTick) this.onTick(this.formatarTempo());
        this.iniciar(); 
    }

    // Método utilitário para devolver o tempo formatado (ex: "24:59")
    formatarTempo() {
        const min = Math.floor(this.tempoRestante / 60).toString().padStart(2, '0');
        const seg = (this.tempoRestante % 60).toString().padStart(2, '0');
        return `${min}:${seg}`;
    }
}


// ---------------------------------------------------------
// TESTE DE MESA (apague ou comente quando for usar na tela real)
// ---------------------------------------------------------

// 1. Instanciamos a classe passando o que ela deve fazer a cada segundo e ao finalizar
const meuEstudo = new PomodoroTimer(
    (tempoFormatado) => console.log(`Tempo na tela: ${tempoFormatado}`),
    (mensagem) => console.warn(`ALARME: ${mensagem}`)
);

// 2. Damos o play
console.log("Iniciando cronômetro no background...");
meuEstudo.iniciar();

// (Opcional) Para ver a pausa acontecendo mais rápido em testes, 
// altere temporariamente os 25*60 lá em cima para apenas 5 (5 segundos).