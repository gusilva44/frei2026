/* Exporta dados do dashboard para Excel (.xls) sem dependências externas.
 * Gera um arquivo SpreadsheetML 2003 (formato XML que o Excel e o LibreOffice
 * abrem nativamente) e dispara o download no navegador. */

function escapar(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tipoDaCelula(valor) {
  return typeof valor === "number" ? "Number" : "String";
}

/*
 * baixarXls(nomeArquivo, planilhas)
 *   nomeArquivo: string (sem extensão)
 *   planilhas: [{ titulo, cabecalho, linhas: [[...], ...] }]
 *     - linhas[0] é usada como cabeçalho quando `cabecalho: true`
 */
export function baixarXls(nomeArquivo, planilhas) {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ',
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
    "<Styles>",
    '<Style ss:ID="Default" ss:Name="Normal"><Font ss:FontName="Calibri" ss:Size="11"/></Style>',
    '<Style ss:ID="Negrito"><Font ss:Bold="1"/></Style>',
    "</Styles>",
  ];

  planilhas.forEach((planilha) => {
    const nome = planilha.titulo.slice(0, 31) || "Planilha";
    xml.push(`<Worksheet ss:Name="${escapar(nome).slice(0, 31)}"><Table>`);

    planilha.linhas.forEach((linha, indice) => {
      const negrito = planilha.cabecalho && indice === 0;
      const celulas = linha
        .map(
          (valor) =>
            `<Cell${negrito ? ' ss:StyleID="Negrito"' : ""}><Data ss:Type="${tipoDaCelula(valor)}">${escapar(valor)}</Data></Cell>`,
        )
        .join("");
      xml.push(`<Row>${celulas}</Row>`);
    });

    xml.push("</Table></Worksheet>");
  });

  xml.push("</Workbook>");

  const blob = new Blob([`\ufeff${xml.join("")}`], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${nomeArquivo}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
