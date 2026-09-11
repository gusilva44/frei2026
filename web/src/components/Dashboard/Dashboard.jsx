import { useMemo, useState } from "react";
import { useVisitantes } from "../../utils/VisitantesContext";
import { generos, vinculos } from "../../data/setores";
import { baixarXls } from "../../utils/exportarXls";
import "./dashboard.css";

function porcentagem(parte, total) {
  if (!total) return 0;
  return Math.round((parte / total) * 100);
}

const coresGenero = {
  Masculino: "var(--azul)",
  Feminino: "var(--amarelo)",
  Outro: "var(--azul-claro)",
};

/* Grafico de rosca desenhado com SVG puro */
function Rosca({ valor, total, cor, rotulo }) {
  const raio = 42;
  const perimetro = 2 * Math.PI * raio;
  const pct = porcentagem(valor, total);
  const preenchido = (pct / 100) * perimetro;

  return (
    <div className="dashboard-rosca">
      <svg viewBox="0 0 100 100" className="dashboard-rosca-svg" role="img" aria-label={rotulo}>
        <circle cx="50" cy="50" r={raio} className="dashboard-rosca-trilha" />
        <circle
          cx="50"
          cy="50"
          r={raio}
          className="dashboard-rosca-valor"
          stroke={cor}
          strokeDasharray={`${preenchido} ${perimetro}`}
        />
        <text x="50" y="54" className="dashboard-rosca-texto">
          {pct}%
        </text>
      </svg>
      <span className="dashboard-rosca-rotulo">{rotulo}</span>
      <span className="dashboard-rosca-valor-texto">{valor} pessoa(s)</span>
    </div>
  );
}

function Kpi({ rotulo, valor, detalhe, destaque }) {
  return (
    <div className={destaque ? "dashboard-cartao dashboard-cartao-amarelo" : "dashboard-cartao"}>
      <span className="dashboard-cartao-rotulo">{rotulo}</span>
      <strong className="dashboard-cartao-numero">{valor}</strong>
      {detalhe && <span className="dashboard-cartao-detalhe">{detalhe}</span>}
    </div>
  );
}

function Dashboard() {
  const { visitantes = [], presencas = [], setores = [] } = useVisitantes();
  const [filtroVinculo, setFiltroVinculo] = useState("Todos");
  const [filtroGenero, setFiltroGenero] = useState("Todos");
  const [porGenero, setPorGenero] = useState(false);
  const [filtroColaborador, setFiltroColaborador] = useState("Todos");

  const visitantesPorId = useMemo(() => {
    const mapa = new Map();
    visitantes.forEach((visitante) => mapa.set(visitante.id, visitante));
    return mapa;
  }, [visitantes]);

  /* Aplica os filtros de vínculo e gênero a inscritos e presenças */
  const inscritosFiltrados = useMemo(
    () =>
      visitantes.filter((visitante) => {
        const correspondeVinculo = filtroVinculo === "Todos" || visitante.vinculo === filtroVinculo;

        const correspondeGenero = filtroGenero === "Todos" || visitante.genero === filtroGenero;

        const correspondeColaborador =
          filtroColaborador === "Todos" ||
          (filtroColaborador === "Sim" &&
            visitante.vinculo === "Aluno atual" &&
            visitante.participaComoColaborador === true) ||
          (filtroColaborador === "Não" &&
            !(visitante.vinculo === "Aluno atual" && visitante.participaComoColaborador === true));

        return correspondeVinculo && correspondeGenero && correspondeColaborador;
      }),
    [visitantes, filtroVinculo, filtroGenero, filtroColaborador],
  );

  const presencasFiltradas = useMemo(
    () =>
      presencas
        .map((presenca) => ({ ...presenca, visitante: visitantesPorId.get(presenca.visitanteId) }))
        .filter(
          (presenca) =>
            presenca.visitante &&
            (filtroVinculo === "Todos" || presenca.visitante.vinculo === filtroVinculo) &&
            (filtroGenero === "Todos" || presenca.visitante.genero === filtroGenero),
        ),
    [presencas, visitantesPorId, filtroVinculo, filtroGenero],
  );

  const totalInscritos = inscritosFiltrados.length;
  const totalPresencas = presencasFiltradas.length;
  const visitantesPresentes = new Set(presencasFiltradas.map((item) => item.visitanteId)).size;

  const linhasSetores = useMemo(
    () =>
      setores.map((setor) => {
        const doSetor = presencasFiltradas.filter((presenca) => presenca.setorId === setor.id);
        return {
          ...setor,
          total: doSetor.length,
          Masculino: doSetor.filter((item) => item.visitante.genero === "Masculino").length,
          Feminino: doSetor.filter((item) => item.visitante.genero === "Feminino").length,
          Outro: doSetor.filter(
            (item) => !["Masculino", "Feminino"].includes(item.visitante.genero),
          ).length,
          alunosAtuais: doSetor.filter((item) => item.visitante.vinculo === "Aluno atual").length,
          exAlunos: doSetor.filter((item) => item.visitante.vinculo === "Ex-aluno").length,
        };
      }),
    [presencasFiltradas],
  );

  const maiorSetor = Math.max(1, ...linhasSetores.map((linha) => linha.total));
  const setorLider = [...linhasSetores].sort((a, b) => b.total - a.total)[0];

  /* Agrega as salas por andar: quantidade de salas e de pessoas em cada andar */
  const linhasPorAndar = useMemo(() => {
    const mapa = new Map();
    linhasSetores.forEach((linha) => {
      const chave = linha.andar || "Sem andar";
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          andar: chave,
          salas: 0,
          pessoas: 0,
          Masculino: 0,
          Feminino: 0,
          Outro: 0,
        });
      }
      const entrada = mapa.get(chave);
      entrada.salas += 1;
      entrada.pessoas += linha.total;
      entrada.Masculino += linha.Masculino;
      entrada.Feminino += linha.Feminino;
      entrada.Outro += linha.Outro;
    });
    return [...mapa.values()];
  }, [linhasSetores]);

  const generosContagem = generos.map((genero) => ({
    genero,
    valor: inscritosFiltrados.filter((visitante) =>
      genero === "Outro"
        ? !["Masculino", "Feminino"].includes(visitante.genero)
        : visitante.genero === genero,
    ).length,
  }));

  const alunosAtuais = inscritosFiltrados.filter((v) => v.vinculo === "Aluno atual").length;
  const exAlunos = inscritosFiltrados.filter((v) => v.vinculo === "Ex-aluno").length;

  const colaboradores = inscritosFiltrados.filter(
    (v) => v.vinculo === "Aluno atual" && v.participaComoColaborador === true,
  ).length;

  const alunosNaoColaboradores = alunosAtuais - colaboradores;

  function ranking(campo, limite = 6) {
    const mapa = {};
    inscritosFiltrados.forEach((visitante) => {
      const chave = visitante[campo] || "Não informado";
      mapa[chave] = (mapa[chave] || 0) + 1;
    });
    return Object.entries(mapa)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limite);
  }

  const listaCursos = ranking("cursoInteresse");
  const listaCanais = ranking("comoSoube");
  const maiorCurso = listaCursos[0]?.[1] || 1;
  const maiorCanal = listaCanais[0]?.[1] || 1;

  function exportar() {
    const planilhas = [
      {
        titulo: "Resumo",
        cabecalho: true,
        linhas: [
          ["Indicador", "Valor"],
          ["Inscritos", totalInscritos],
          ["Presenças registradas", totalPresencas],
          ["Visitantes presentes", visitantesPresentes],
          ["Comparecimento (%)", porcentagem(visitantesPresentes, totalInscritos)],
          ["Salas monitoradas", linhasSetores.length],
          [
            "Salas por visitante",
            visitantesPresentes ? (totalPresencas / visitantesPresentes).toFixed(1) : 0,
          ],
          ["Colaboradores", colaboradores],
          ["Andares acompanhados", linhasPorAndar.length],
        ],
      },
      {
        titulo: "Salas por andar",
        cabecalho: true,
        linhas: [
          ["Andar", "Salas", "Pessoas", "Homens", "Mulheres", "Outros"],
          ...linhasPorAndar.map((andar) => [
            andar.andar,
            andar.salas,
            andar.pessoas,
            andar.Masculino,
            andar.Feminino,
            andar.Outro,
          ]),
        ],
      },
      {
        titulo: "Detalhamento por sala",
        cabecalho: true,
        linhas: [
          [
            "Andar",
            "Sala",
            "Local",
            "Total",
            "Homens",
            "Mulheres",
            "Outros",
            "Alunos atuais",
            "Ex-alunos",
            "% do público",
          ],
          ...linhasSetores.map((linha) => [
            linha.andar,
            linha.nome,
            linha.local || "",
            linha.total,
            linha.Masculino,
            linha.Feminino,
            linha.Outro,
            linha.alunosAtuais,
            linha.exAlunos,
            porcentagem(linha.total, totalPresencas),
          ]),
        ],
      },
      {
        titulo: "Cursos e canais",
        cabecalho: true,
        linhas: [
          ["Cursos mais procurados", "Inscrições", "Canal de divulgação", "Inscrições"],
          ...listaCursos.map(([curso, quantidade], indice) => [
            curso,
            quantidade,
            listaCanais[indice]?.[0] || "",
            listaCanais[indice]?.[1] || 0,
          ]),
        ],
      },
    ];
    baixarXls(`dashboard-feira-2026-${new Date().toISOString().slice(0, 10)}`, planilhas);
  }

  return (
    <div className="dashboard">
      <div className="dashboard-filtros">
        <div className="dashboard-filtro">
          <label htmlFor="filtro-vinculo">Vínculo com o Instituto</label>
          <select
            id="filtro-vinculo"
            value={filtroVinculo}
            onChange={(evento) => setFiltroVinculo(evento.target.value)}
          >
            <option value="Todos">Todos os visitantes</option>
            {vinculos.map((vinculo) => (
              <option key={vinculo} value={vinculo}>
                {vinculo}
              </option>
            ))}
          </select>
        </div>

        <div className="dashboard-filtro">
          <label htmlFor="filtro-genero">Gênero</label>
          <select
            id="filtro-genero"
            value={filtroGenero}
            onChange={(evento) => setFiltroGenero(evento.target.value)}
          >
            <option value="Todos">Todos os gêneros</option>
            {generos.map((genero) => (
              <option key={genero} value={genero}>
                {genero}
              </option>
            ))}
          </select>
        </div>

        <div className="dashboard-filtro">
          <label htmlFor="filtro-colaborador">Participação como colaborador</label>

          <select
            id="filtro-colaborador"
            value={filtroColaborador}
            onChange={(evento) => setFiltroColaborador(evento.target.value)}
          >
            <option value="Todos">Todos</option>
            <option value="Sim">Colaboradores</option>
            <option value="Não">Não colaboradores</option>
          </select>
        </div>

        <label className="dashboard-alternador">
          <input
            type="checkbox"
            checked={porGenero}
            onChange={(evento) => setPorGenero(evento.target.checked)}
          />
          Ver presença separada por gênero
        </label>

        <button className="botao-amarelo dashboard-exportar" onClick={exportar} type="button">
          Exportar XLS
        </button>
      </div>

      <div className="dashboard-cartoes">
        <Kpi
          rotulo="Inscritos"
          valor={totalInscritos}
          detalhe={`${visitantes.length} no total geral`}
        />
        <Kpi
          rotulo="Presenças registradas"
          valor={totalPresencas}
          detalhe={`${linhasSetores.length} salas monitoradas`}
          destaque
        />
        <Kpi
          rotulo="Comparecimento"
          valor={`${porcentagem(visitantesPresentes, totalInscritos)}%`}
          detalhe={`${visitantesPresentes} de ${totalInscritos} inscritos`}
        />
        <Kpi
          rotulo="Salas por visitante"
          valor={visitantesPresentes ? (totalPresencas / visitantesPresentes).toFixed(1) : "0,0"}
          detalhe={setorLider?.total ? `Sala líder: ${setorLider.nome}` : "Sem leituras ainda"}
          destaque
        />
        <Kpi
          rotulo="Colaboradores"
          valor={colaboradores}
          detalhe={
            alunosAtuais
              ? `${porcentagem(colaboradores, alunosAtuais)}% dos alunos atuais`
              : "Nenhum aluno atual"
          }
          destaque
        />
      </div>

      <div className="dashboard-bloco dashboard-bloco-largo">
        <div className="dashboard-bloco-topo">
          <h3 className="dashboard-bloco-titulo">Resumo por andar</h3>
          <span className="dashboard-bloco-legenda">
            Salas monitoradas e pessoas registradas em cada andar
          </span>
        </div>
        {linhasPorAndar.length === 0 ? (
          <p className="admin-vazio">Nenhum dado para exibir ainda.</p>
        ) : (
          <ul className="dashboard-andares">
            {linhasPorAndar.map((andar) => (
              <li key={andar.andar} className="dashboard-andar">
                <span className="dashboard-andar-nome">{andar.andar}</span>
                <span className="dashboard-andar-salas">{andar.salas} sala(s)</span>
                <span className="dashboard-andar-numero">{andar.pessoas}</span>
                <span className="dashboard-barra-trilha">
                  <span
                    className="dashboard-barra-preenchida"
                    style={{ width: `${porcentagem(andar.pessoas, totalPresencas)}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="dashboard-bloco dashboard-bloco-largo">
        <div className="dashboard-bloco-topo">
          <h3 className="dashboard-bloco-titulo">Presença por sala / atração</h3>
          <span className="dashboard-bloco-legenda">
            {porGenero ? "Distribuição por gênero" : "Total de pessoas por sala"}
          </span>
        </div>

        {totalPresencas === 0 ? (
          <p className="admin-vazio">
            Nenhuma presença registrada com esses filtros. Use o Leitor QR durante a feira.
          </p>
        ) : (
          <ul className="dashboard-barras">
            {linhasSetores.map((linha) => (
              <li key={linha.id} className="dashboard-barra-item">
                <span className="dashboard-barra-nome">{linha.nome}</span>
                <span className="dashboard-barra-trilha">
                  {porGenero ? (
                    <span className="dashboard-barra-empilhada">
                      {generos.map((genero) => (
                        <span
                          key={genero}
                          className="dashboard-barra-fatia"
                          title={`${genero}: ${linha[genero]}`}
                          style={{
                            width: `${porcentagem(linha[genero], maiorSetor)}%`,
                            backgroundColor: coresGenero[genero],
                          }}
                        />
                      ))}
                    </span>
                  ) : (
                    <span
                      className="dashboard-barra-preenchida"
                      style={{ width: `${porcentagem(linha.total, maiorSetor)}%` }}
                    />
                  )}
                </span>
                <span className="dashboard-barra-numero">{linha.total}</span>
              </li>
            ))}
          </ul>
        )}

        {porGenero && (
          <div className="dashboard-legenda-cores">
            {generos.map((genero) => (
              <span key={genero}>
                <i style={{ backgroundColor: coresGenero[genero] }} />
                {genero}
              </span>
            ))}
          </div>
        )}

        <div className="admin-tabela-area">
          <table className="admin-tabela dashboard-tabela">
            <thead>
              <tr>
                <th>Sala</th>
                <th>Total</th>
                <th>Homens</th>
                <th>Mulheres</th>
                <th>Outros</th>
                <th>Alunos atuais</th>
                <th>Ex-alunos</th>
                <th>% do público</th>
              </tr>
            </thead>
            <tbody>
              {linhasSetores.map((linha) => (
                <tr key={linha.id}>
                  <td>
                    <strong>{linha.nome}</strong>
                    <br />
                    <small>{linha.andar}</small>
                  </td>
                  <td>{linha.total}</td>
                  <td>{linha.Masculino}</td>
                  <td>{linha.Feminino}</td>
                  <td>{linha.Outro}</td>
                  <td>{linha.alunosAtuais}</td>
                  <td>{linha.exAlunos}</td>
                  <td>{porcentagem(linha.total, totalPresencas)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dashboard-grade">
        <div className="dashboard-bloco">
          <h3 className="dashboard-bloco-titulo">Perfil dos inscritos</h3>
          <div className="dashboard-roscas">
            {generosContagem.map((item) => (
              <Rosca
                key={item.genero}
                valor={item.valor}
                total={totalInscritos}
                cor={coresGenero[item.genero]}
                rotulo={item.genero}
              />
            ))}
            <Rosca
              valor={alunosAtuais + exAlunos}
              total={totalInscritos}
              cor="var(--amarelo-escuro)"
              rotulo="Vínculo com o Instituto"
            />
          </div>
          <div className="dashboard-mini-cartoes">
            <span>
              <strong>{alunosAtuais}</strong> alunos atuais
            </span>

            <span>
              <strong>{colaboradores}</strong> colaboradores
            </span>

            <span>
              <strong>{alunosNaoColaboradores}</strong> alunos não colaboradores
            </span>

            <span>
              <strong>{exAlunos}</strong> ex-alunos
            </span>

            <span>
              <strong>{totalInscritos - alunosAtuais - exAlunos}</strong> público externo
            </span>
          </div>
        </div>

        <div className="dashboard-bloco">
          <h3 className="dashboard-bloco-titulo">Cursos mais procurados</h3>
          {listaCursos.length === 0 ? (
            <p className="admin-vazio">Nenhum dado para exibir ainda.</p>
          ) : (
            <ul className="dashboard-barras">
              {listaCursos.map(([curso, quantidade]) => (
                <li key={curso} className="dashboard-barra-item">
                  <span className="dashboard-barra-nome">{curso}</span>
                  <span className="dashboard-barra-trilha">
                    <span
                      className="dashboard-barra-preenchida"
                      style={{ width: `${porcentagem(quantidade, maiorCurso)}%` }}
                    />
                  </span>
                  <span className="dashboard-barra-numero">{quantidade}</span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="dashboard-bloco-titulo dashboard-bloco-titulo-espacado">
            Como ficaram sabendo da feira
          </h3>
          {listaCanais.length === 0 ? (
            <p className="admin-vazio">Nenhum dado para exibir ainda.</p>
          ) : (
            <ul className="dashboard-barras">
              {listaCanais.map(([canal, quantidade]) => (
                <li key={canal} className="dashboard-barra-item">
                  <span className="dashboard-barra-nome">{canal}</span>
                  <span className="dashboard-barra-trilha">
                    <span
                      className="dashboard-barra-preenchida dashboard-barra-amarela"
                      style={{ width: `${porcentagem(quantidade, maiorCanal)}%` }}
                    />
                  </span>
                  <span className="dashboard-barra-numero">{quantidade}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
