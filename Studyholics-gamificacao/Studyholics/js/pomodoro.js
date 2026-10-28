export class PomodoroTimer {
    constructor(onTick, onAlarme, onMudarSessao) {
        // Configurações padrão (serão sobrescritas pelo input do usuário)
        this.config = {
            foco: 25,
            pausaCurta: 5,
            pausaLonga: 10,
            intervalosPausaLonga: 4
        };

        this.tempoRestante = this.config.foco * 60;
        this.intervalo = null;
        this.modo = 'foco'; // 'foco', 'pausaCurta' ou 'pausaLonga'
        this.ciclosCompletos = 0; // Quantos pomodoros foram concluídos

        this.onTick = onTick;
        this.onAlarme = onAlarme;
        this.onMudarSessao = onMudarSessao; 
    }

    // Recebe os valores dos inputs antes de começar
    configurar(novasConfigs) {
        this.config = { ...this.config, ...novasConfigs };
        this.tempoRestante = this.config.foco * 60;
        if (this.onTick) this.onTick(this.formatarTempo());
    }

    iniciar() {
        if (this.intervalo) return;
        this.intervalo = setInterval(() => {
            this.tempoRestante--;
            if (this.onTick) this.onTick(this.formatarTempo());

            if (this.tempoRestante <= 0) {
                this.alternarModo();
            }
        }, 1000);
    }

    pausar() {
        clearInterval(this.intervalo);
        this.intervalo = null;
    }

    alternarModo() {
        this.pausar();
        
        if (this.modo === 'foco') {
            this.ciclosCompletos++;
            // Atualiza o texto "Sessão: X" na tela
            if (this.onMudarSessao) this.onMudarSessao(this.ciclosCompletos + 1);

            // Verifica se é hora da pausa longa baseado no intervalo configurado
            if (this.ciclosCompletos % this.config.intervalosPausaLonga === 0) {
                this.modo = 'pausaLonga';
                this.tempoRestante = this.config.pausaLonga * 60;
                if (this.onAlarme) this.onAlarme('Pausa longa! Descanse.');
            } else {
                this.modo = 'pausaCurta';
                this.tempoRestante = this.config.pausaCurta * 60;
                if (this.onAlarme) this.onAlarme('Pausa curta! Respire um pouco.');
            }
        } else {
            this.modo = 'foco';
            this.tempoRestante = this.config.foco * 60;
            if (this.onAlarme) this.onAlarme('De volta ao foco!');
        }
        
        if (this.onTick) this.onTick(this.formatarTempo());
        this.iniciar(); 
    }

    formatarTempo() {
        const min = Math.floor(this.tempoRestante / 60).toString().padStart(2, '0');
        const seg = (this.tempoRestante % 60).toString().padStart(2, '0');
        return `${min}:${seg}`;
    }
}