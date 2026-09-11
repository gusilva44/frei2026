/* Converte as linhas do banco (snake_case) para o formato consumido pelo front-end
 * (camelCase), no mesmo padrão que web/src/server/apiFeira.ts já usava. */
export function visitanteParaCliente(linha) {
  return {
    id: linha.id,
    nome: linha.nome,
    email: linha.email,
    cpf: linha.cpf,
    telefone: linha.telefone,
    vinculo: linha.vinculo,
    comoSoube: linha.como_soube,
    genero: linha.genero,
    cursoInteresse: linha.curso_interesse,
    participaComoColaborador: Boolean(linha.participa_como_colaborador),
    dataChegada: linha.data_chegada,
    codigoQr: linha.codigo_qr,
    qrCodeSvg: linha.qr_code_svg,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

export function presencaParaCliente(linha) {
  return {
    id: linha.id,
    visitanteId: linha.visitante_id,
    setorId: linha.setor_id,
    codigoQr: linha.codigo_qr,
    registradoEm: linha.registrado_em,
  };
}

export function setorParaCliente(linha) {
  return {
    id: linha.id,
    nome: linha.nome,
    local: linha.local,
    andar: linha.andar,
    cor: linha.cor,
  };
}

export function administradorParaCliente(linha) {
  return {
    id: linha.id,
    nome: linha.nome,
    email: linha.email,
    papel: linha.papel,
  };
}
