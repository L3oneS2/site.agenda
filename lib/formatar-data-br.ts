/** Exibe `YYYY-MM-DD` como DD/MM/YYYY (sem `Date`, evita fuso). */
export const formatarDataBR = (data: string) => {
  const iso = data.slice(0, 10);
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) return data;
  return `${dia}/${mes}/${ano}`;
};
