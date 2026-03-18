export const getStatusClass = (status: string): string => {
  const map: Record<string, string> = {
    'AGENDADO': 'status-agendado',
    'CHEGOU': 'status-chegou',
    'ACOPLADO': 'status-em-descarga',
    'DESACOPLADO': 'status-em-descarga',
    'EM DESCARGA': 'status-em-descarga',
    'DESCARGA FINALIZADA': 'status-descarga-finalizada',
    'AGUARDANDO DESACOPLAGEM': 'status-descarga-finalizada',
    'AGUARDANDO ARMAZENAGEM': 'status-aguardando-armazenagem',
    'FINALIZADO': 'status-finalizado',
    'EM ARMAZENAGEM': 'status-em-descarga',
    'PAUSADO': 'status-descarga-finalizada',
    'NAO_VEIO': 'status-agendado',
  };
  return map[status] || 'status-agendado';
};

export const formatDate = (date: string | null) => {
  if (!date) return "-";
  const d = date.includes("T") ? new Date(date) : new Date(date + "T12:00:00");
  return d.toLocaleDateString("pt-BR");
};

export const formatDateTime = (date: string | null) => {
  if (!date) return "-";
  return new Date(date).toLocaleString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const formatTime = (date: string | null) => {
  if (!date) return "-";
  return new Date(date).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
};

export const formatNF = (nf: string): string => {
  const digits = nf.replace(/\D/g, '');
  if (digits.length === 0) return nf;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const calcDuration = (start: string | null, end: string | null): string => {
  if (!start) return "-";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const diff = Math.floor((e - s) / 60000);
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
};

export const calcEffectiveArmazenagemTime = (item: any): string => {
  if (!item.hora_inicio) return "-";
  const start = new Date(item.hora_inicio).getTime();
  const end = item.hora_fim ? new Date(item.hora_fim).getTime() : Date.now();
  const totalMs = end - start;
  const pausas = item.pausas || [];
  let pauseMs = 0;
  for (const p of pausas) {
    const pStart = new Date(p.pause_at).getTime();
    const pEnd = p.resume_at ? new Date(p.resume_at).getTime() : Date.now();
    pauseMs += pEnd - pStart;
  }
  const effectiveMs = Math.max(0, totalMs - pauseMs);
  const mins = Math.floor(effectiveMs / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
};
