import * as presencasRepository from "../repositories/presencas.repository.js";
import * as setoresRepository from "../repositories/setores.repository.js";
import * as visitantesRepository from "../repositories/visitantes.repository.js";
import { visitanteParaCliente } from "../utils/mappers.js";

/* Agregações equivalentes às calculadas no front-end (web/src/components/Dashboard/Dashboard.jsx),
 * agora centralizadas no servidor para não expor a lista completa de visitantes só para
 * montar KPIs. */

async function carregarBase() {
  const [linhasVisitantes, linhasPresencas, setores] = await Promise.all([
    visitantesRepository.listarTodos(),
    presencasRepository.listarTodas(),
    setoresRepository.listarTodos(),
  ]);

  const visitantes = linhasVisitantes.map(visitanteParaCliente);
  const visitantesPorId = new Map(visitantes.map((visitante) => [visitante.id, visitante]));
  const presencas = linhasPresencas
    .map((linha) => ({ ...linha, visitante: visitantesPorId.get(linha.visitante_id) }))
    .filter((presenca) => presenca.visitante);

  return { visitantes, presencas, setores };
}

function porcentagem(parte, total) {
  if (!total) return 0;
  return Math.round((parte / total) * 100);
}

export async function resumo() {
  const { visitantes, presencas, setores } = await carregarBase();

  const visitantesPresentes = new Set(presencas.map((item) => item.visitante_id)).size;
  const alunosAtuais = visitantes.filter((v) => v.vinculo === "Aluno atual");
  const colaboradores = alunosAtuais.filter((v) => v.participaComoColaborador).length;

  const contagemPorSetor = new Map();
  for (const presenca of presencas) {
    contagemPorSetor.set(presenca.setor_id, (contagemPorSetor.get(presenca.setor_id) ?? 0) + 1);
  }
  const setorLider = setores
    .map((setor) => ({ ...setor, total: contagemPorSetor.get(setor.id) ?? 0 }))
    .sort((a, b) => b.total - a.total)[0];

  return {
    inscritos: visitantes.length,
    presencasRegistradas: presencas.length,
    comparecimentoPercentual: porcentagem(visitantesPresentes, visitantes.length),
    visitantesPresentes,
    setoresMonitorados: setores.length,
    setoresPorVisitante: visitantesPresentes
      ? Number((presencas.length / visitantesPresentes).toFixed(1))
      : 0,
    colaboradores,
    colaboradoresPercentualDeAlunosAtuais: porcentagem(colaboradores, alunosAtuais.length),
    setorLider: setorLider?.total
      ? { id: setorLider.id, nome: setorLider.nome, total: setorLider.total }
      : null,
  };
}

export async function porSetor() {
  const { presencas, setores } = await carregarBase();

  return setores.map((setor) => {
    const doSetor = presencas.filter((presenca) => presenca.setor_id === setor.id);
    return {
      id: setor.id,
      nome: setor.nome,
      local: setor.local,
      andar: setor.andar,
      total: doSetor.length,
      masculino: doSetor.filter((item) => item.visitante.genero === "Masculino").length,
      feminino: doSetor.filter((item) => item.visitante.genero === "Feminino").length,
      outro: doSetor.filter((item) => !["Masculino", "Feminino"].includes(item.visitante.genero))
        .length,
      alunosAtuais: doSetor.filter((item) => item.visitante.vinculo === "Aluno atual").length,
      exAlunos: doSetor.filter((item) => item.visitante.vinculo === "Ex-aluno").length,
    };
  });
}

function ranking(visitantes, campo, limite = 6) {
  const mapa = new Map();
  for (const visitante of visitantes) {
    const chave = visitante[campo] || "Não informado";
    mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
  }
  return [...mapa.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite)
    .map(([chave, total]) => ({
      chave,
      total,
    }));
}

export async function rankings() {
  const { visitantes } = await carregarBase();

  return {
    cursosMaisProcurados: ranking(visitantes, "cursoInteresse"),
    canaisDeDivulgacao: ranking(visitantes, "comoSoube"),
  };
}
