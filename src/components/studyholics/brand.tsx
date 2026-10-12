export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "study-brand study-brand-compact" : "study-brand"} aria-label="Studyholics">
      <img
        className="study-logo"
        src="/studyholics-mark.png"
        alt="Símbolo da Studyholics"
        width={501}
        height={491}
      />
      <div className="study-wordmark">Study<span>holics</span></div>
      {!compact && <p className="study-tagline">Estude. Evolua. Compartilhe</p>}
    </div>
  );
}
