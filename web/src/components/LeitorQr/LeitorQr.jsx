import { useEffect, useMemo, useRef, useState } from "react";
import { lerQrCode } from "../../lib/qrcode";
import { useVisitantes } from "../../utils/VisitantesContext";
import { nomeDoSetor } from "../../data/setores";
import { abrirJanelaImpressao, compartilharCredencial } from "../../utils/impressao";
import QRCodeVisitante from "../QRCode/QRCodeVisitante";
import "./leitor.css";

/*
 * Leitor de QR Code proprio (sem servicos externos).
 * A leitura é sempre vinculada a uma turma / setor de atração,
 * gerando os dados de presença analisados no dashboard. A lista de setores vem da API
 * (GET /setores), carregada pelo VisitantesContext.
 */
function LeitorQr() {
  const { presencas, registrarPresenca, setores } = useVisitantes();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fluxoRef = useRef(null);
  const cartaoRef = useRef(null);
  const ultimoCodigoRef = useRef("");

  const [setorAtivo, setSetorAtivo] = useState("");
  const [andarAtivo, setAndarAtivo] = useState("");
  const [cameraLigada, setCameraLigada] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [aviso, setAviso] = useState("");
  const [historico, setHistorico] = useState([]);
  const [ultimaLeitura, setUltimaLeitura] = useState(null);

  /* Andares únicos na ordem da API (Área Externa, Pátio, 1º/2º/3º Andar) */
  const andaresDoEvento = useMemo(() => {
    const vistos = [];
    setores.forEach((setor) => {
      if (!vistos.includes(setor.andar)) vistos.push(setor.andar);
    });
    return vistos;
  }, [setores]);

  /* Salas do andar selecionado */
  const salasDoAndar = useMemo(
    () => (andarAtivo ? setores.filter((setor) => setor.andar === andarAtivo) : []),
    [setores, andarAtivo],
  );

  const totalNoSetor = useMemo(
    () => presencas.filter((presenca) => presenca.setorId === setorAtivo).length,
    [presencas, setorAtivo],
  );

  /* Assim que os setores carregam, seleciona o primeiro andar e a primeira sala. */
  useEffect(() => {
    if (!andarAtivo && andaresDoEvento.length > 0) setAndarAtivo(andaresDoEvento[0]);
  }, [andarAtivo, andaresDoEvento]);

  /* Ao trocar de andar, mantém a sala atual se ela pertencer ao andar, senão escolhe a primeira. */
  useEffect(() => {
    if (salasDoAndar.length === 0) return;
    setSetorAtivo((atual) =>
      salasDoAndar.some((s) => s.id === atual) ? atual : salasDoAndar[0].id,
    );
  }, [salasDoAndar]);

  async function registrarLeitura(resultado) {
    if (resultado.texto === ultimoCodigoRef.current) return;
    ultimoCodigoRef.current = resultado.texto;
    setTimeout(() => {
      ultimoCodigoRef.current = "";
    }, 2500);

    let retorno;
    try {
      retorno = await registrarPresenca(resultado.texto, setorAtivo);
    } catch (erro) {
      setMensagem("");
      setAviso(`Erro ao registrar: ${erro.message || "verifique sua conexão com a API."}`);
      return;
    }
    const leitura = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      texto: resultado.texto,
      setor: setorAtivo,
      status: retorno.status,
      horario: new Date().toLocaleTimeString("pt-BR"),
      visitante: retorno.visitante,
    };

    setUltimaLeitura(leitura);
    setHistorico((lista) => [leitura, ...lista].slice(0, 30));

    if (retorno.status === "registrado") {
      setMensagem(`Presença registrada: ${retorno.visitante.nome}`);
      setAviso("");
    } else if (retorno.status === "repetido") {
      setMensagem(
        `${retorno.visitante.nome} já estava registrado em ${nomeDoSetor(setores, setorAtivo)}.`,
      );
      setAviso("");
    } else {
      setMensagem("");
      setAviso("Código não encontrado na lista de inscritos.");
    }
  }

  function pararCamera() {
    if (fluxoRef.current) {
      fluxoRef.current.getTracks().forEach((trilha) => trilha.stop());
      fluxoRef.current = null;
    }
    setCameraLigada(false);
  }

  async function ligarCamera() {
    setAviso("");
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      fluxoRef.current = fluxo;
      if (videoRef.current) {
        videoRef.current.srcObject = fluxo;
        await videoRef.current.play();
      }
      setCameraLigada(true);
    } catch {
      setAviso("Não foi possível acessar a câmera deste dispositivo.");
    }
  }

  /* Analisa um quadro do video a cada 300ms enquanto a camera estiver ligada */
  useEffect(() => {
    if (!cameraLigada) return undefined;

    const intervalo = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !video.videoWidth) return;

      const lado = Math.min(video.videoWidth, video.videoHeight);
      canvas.width = 360;
      canvas.height = 360;
      const contexto = canvas.getContext("2d");
      contexto.drawImage(
        video,
        (video.videoWidth - lado) / 2,
        (video.videoHeight - lado) / 2,
        lado,
        lado,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const imagem = contexto.getImageData(0, 0, canvas.width, canvas.height);
      const resultado = lerQrCode(imagem);
      if (resultado) void registrarLeitura(resultado);
    }, 300);

    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraLigada, setorAtivo, presencas]);

  useEffect(() => pararCamera, []);

  function lerArquivo(evento) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;
    setAviso("");

    const imagemHtml = new Image();
    imagemHtml.onload = () => {
      const canvas = canvasRef.current;
      const escala = Math.min(1, 700 / Math.max(imagemHtml.width, imagemHtml.height));
      canvas.width = Math.round(imagemHtml.width * escala);
      canvas.height = Math.round(imagemHtml.height * escala);
      const contexto = canvas.getContext("2d");
      contexto.drawImage(imagemHtml, 0, 0, canvas.width, canvas.height);
      const imagem = contexto.getImageData(0, 0, canvas.width, canvas.height);
      const resultado = lerQrCode(imagem);
      if (resultado) void registrarLeitura(resultado);
      else setAviso("Nenhum QR Code encontrado nesta imagem.");
      URL.revokeObjectURL(imagemHtml.src);
    };
    imagemHtml.src = URL.createObjectURL(arquivo);
    evento.target.value = "";
  }

  /* Abre a folha de impressao (PDF) com o QR Code que acabou de ser lido */
  function imprimirCredencial() {
    if (!cartaoRef.current) return;
    const conteudo = `<div class="folha-grade">${cartaoRef.current.innerHTML}</div>`;
    const aberta = abrirJanelaImpressao({
      titulo: `Credencial · ${nomeDoSetor(setores, ultimaLeitura.setor)}`,
      conteudo,
    });
    if (!aberta) setAviso("Libere as janelas pop-up do navegador para imprimir.");
  }

  async function compartilhar() {
    const visitante = ultimaLeitura?.visitante;
    const resultado = await compartilharCredencial({
      titulo: "Credencial Feira de Profissões 2026",
      texto: `${visitante ? visitante.nome : "Visitante"} · ${nomeDoSetor(setores, ultimaLeitura.setor)} · Código ${ultimaLeitura.texto}`,
    });
    if (resultado === "copiado") setMensagem("Dados copiados para a área de transferência.");
  }

  return (
    <div className="leitor">
      <div className="leitor-setores">
        <span className="leitor-setores-rotulo">Andar do evento</span>
        <div className="leitor-setores-botoes">
          {andaresDoEvento.map((andar) => {
            const salasNoAndar = setores.filter((setor) => setor.andar === andar).length;
            return (
              <button
                key={andar}
                className={andar === andarAtivo ? "leitor-setor ativo" : "leitor-setor"}
                onClick={() => setAndarAtivo(andar)}
              >
                {andar}
                <small>{salasNoAndar} sala(s)</small>
              </button>
            );
          })}
        </div>

        <span className="leitor-setores-rotulo leitor-setores-rotulo-salas">Sala de atração</span>
        <div className="leitor-setores-botoes">
          {salasDoAndar.map((setor) => (
            <button
              key={setor.id}
              className={setor.id === setorAtivo ? "leitor-setor ativo" : "leitor-setor"}
              onClick={() => setSetorAtivo(setor.id)}
            >
              {setor.local ? `${setor.local} · ` : ""}
              {setor.nome}
            </button>
          ))}
        </div>
        <p className="leitor-setores-total">
          {totalNoSetor} presença(s) registrada(s) em{" "}
          <strong>{nomeDoSetor(setores, setorAtivo)}</strong>
        </p>
      </div>

      <div className="leitor-colunas">
        <div className="leitor-camera">
          <div className="leitor-video-area">
            <video ref={videoRef} className="leitor-video" muted playsInline />
            {!cameraLigada && <p className="leitor-video-aviso">Câmera desligada</p>}
            <span className="leitor-mira" />
          </div>

          <div className="leitor-botoes">
            {cameraLigada ? (
              <button className="botao-azul" onClick={pararCamera}>
                Parar câmera
              </button>
            ) : (
              <button className="botao-azul" onClick={ligarCamera}>
                Ligar câmera
              </button>
            )}
            <label className="leitor-upload">
              Enviar imagem
              <input type="file" accept="image/*" onChange={lerArquivo} />
            </label>
          </div>

          {mensagem && <p className="leitor-mensagem">{mensagem}</p>}
          {aviso && <p className="leitor-mensagem leitor-mensagem-alerta">{aviso}</p>}
          <canvas ref={canvasRef} className="leitor-canvas" />
        </div>

        <div className="leitor-resultado">
          <h3>Última leitura</h3>
          {ultimaLeitura ? (
            <div className="leitor-cartao">
              <div ref={cartaoRef}>
                <div className="cracha">
                  <div className="cracha-topo">
                    <strong>6ª Feira das Profissões 2026</strong>
                    <span>Instituto Social Nossa Senhora de Fátima</span>
                  </div>
                  <QRCodeVisitante codigo={ultimaLeitura.texto} tamanho={130} />
                  <p className="cracha-nome">
                    {ultimaLeitura.visitante
                      ? ultimaLeitura.visitante.nome
                      : "Visitante não listado"}
                  </p>
                  <p className="cracha-linha">
                    {ultimaLeitura.visitante?.cursoInteresse || "Curso não informado"}
                  </p>
                  <p className="cracha-setor">{nomeDoSetor(setores, ultimaLeitura.setor)}</p>
                  <p className="cracha-codigo">{ultimaLeitura.texto}</p>
                </div>
              </div>

              <span
                className={
                  ultimaLeitura.status === "desconhecido"
                    ? "leitor-selo leitor-selo-alerta"
                    : "leitor-selo leitor-selo-ok"
                }
              >
                {ultimaLeitura.status === "registrado"
                  ? "Presença registrada"
                  : ultimaLeitura.status === "repetido"
                    ? "Presença já registrada"
                    : "Credencial não encontrada"}
              </span>
              <p className="leitor-info">Leitura às {ultimaLeitura.horario}</p>

              <div className="leitor-acoes">
                <button className="botao-amarelo" onClick={imprimirCredencial}>
                  Imprimir credencial (PDF)
                </button>
                <button className="admin-acao" onClick={compartilhar}>
                  Compartilhar
                </button>
              </div>
            </div>
          ) : (
            <p className="leitor-vazio">
              Escolha o andar e a sala, aponte um QR Code para a câmera ou envie uma imagem para
              começar.
            </p>
          )}

          <h3 className="leitor-historico-titulo">Histórico de leituras</h3>
          {historico.length === 0 ? (
            <p className="leitor-vazio">Nenhuma leitura registrada.</p>
          ) : (
            <ul className="leitor-historico">
              {historico.map((leitura) => (
                <li key={leitura.id}>
                  <span className="leitor-historico-hora">{leitura.horario}</span>
                  <span className="leitor-historico-texto">
                    {leitura.visitante ? leitura.visitante.nome : leitura.texto}
                  </span>
                  <span className="leitor-historico-setor">
                    {nomeDoSetor(setores, leitura.setor)}
                  </span>
                  <span
                    className={
                      leitura.status === "registrado"
                        ? "leitor-ponto leitor-ponto-ok"
                        : leitura.status === "repetido"
                          ? "leitor-ponto leitor-ponto-alerta"
                          : "leitor-ponto leitor-ponto-erro"
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default LeitorQr;
