export const FUSO_ESTUDOS = "America/Recife";

const calendar = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_ESTUDOS, year: "numeric", month: "2-digit", day: "2-digit"
});
const clock = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_ESTUDOS, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
});

function parts(formatter, instant) {
  return Object.fromEntries(formatter.formatToParts(new Date(instant))
    .filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]));
}

export function chaveLocal(instant) {
  const { year, month, day } = parts(calendar, instant);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function somarDias(key, amount) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}

export function semanaLocal(instant = new Date()) {
  const today = chaveLocal(instant);
  const [year, month, day] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const monday = somarDias(today, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => somarDias(monday, index));
}

// Converte meia-noite civil de Recife para UTC, inclusive se o offset do fuso mudar.
export function inicioDiaUtc(key) {
  const [year, month, day] = key.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  let instant = target;
  for (let attempt = 0; attempt < 3; attempt++) {
    const local = parts(clock, instant);
    const localAsUtc = Date.UTC(local.year, local.month - 1, local.day,
      local.hour, local.minute, local.second);
    instant += target - localAsUtc;
  }
  return new Date(instant).toISOString();
}

export function minutosDaSemana(sessions, instant = new Date()) {
  const days = semanaLocal(instant);
  const totals = Object.fromEntries(days.map(day => [day, 0]));
  for (const session of sessions) {
    if (!session.finalizada_em) continue;
    const day = chaveLocal(session.finalizada_em);
    if (Object.hasOwn(totals, day)) totals[day] += Math.max(0, Number(session.minutos_validos) || 0);
  }
  return { days, minutes: days.map(day => totals[day]) };
}
