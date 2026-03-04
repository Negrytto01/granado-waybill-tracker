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
  };
  return map[status] || 'status-agendado';
};

export const parseXML = (xmlString: string): {
  numero_nf: string;
  fornecedor: string;
  cnpj: string;
  itens: { descricao: string; quantidade: number }[];
} => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");
  
  const nNF = doc.querySelector("nNF")?.textContent || doc.querySelector("ide nNF")?.textContent || "";
  const xNome = doc.querySelector("emit xNome")?.textContent || "";
  const CNPJ = doc.querySelector("emit CNPJ")?.textContent || "";
  
  const itens: { descricao: string; quantidade: number }[] = [];
  const dets = doc.querySelectorAll("det");
  dets.forEach(det => {
    const desc = det.querySelector("prod xProd")?.textContent || "";
    const qtd = parseFloat(det.querySelector("prod qCom")?.textContent || "0");
    itens.push({ descricao: desc, quantidade: qtd });
  });

  return { numero_nf: nNF, fornecedor: xNome, cnpj: CNPJ, itens };
};

export const formatDate = (date: string | null) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR");
};

export const formatDateTime = (date: string | null) => {
  if (!date) return "-";
  return new Date(date).toLocaleString("pt-BR");
};

export const formatTime = (date: string | null) => {
  if (!date) return "-";
  return new Date(date).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
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
