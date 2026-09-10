import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { decodificarMatriz, lerQrCode } from "../index";
import { corrigirBloco, multiplicar, dividir, potencia } from "../gf256";
import { blocosDaVersao, totalCodewords } from "../tabelas";

/* Gera a matriz de modulos de referencia com a biblioteca qrcode (apenas nos testes) */
function gerarMatriz(texto, opcoes = {}) {
  const qr = QRCode.create(texto, { errorCorrectionLevel: "M", ...opcoes });
  const tamanho = qr.modules.size;
  const dados = qr.modules.data;
  const matriz = [];
  for (let y = 0; y < tamanho; y += 1) {
    const linha = [];
    for (let x = 0; x < tamanho; x += 1) linha.push(Boolean(dados[y * tamanho + x]));
    matriz.push(linha);
  }
  return matriz;
}

/* Transforma a matriz em um ImageData sintetico com borda e escala */
function gerarImageData(matriz, escala = 6, borda = 4) {
  const modulos = matriz.length;
  const lado = (modulos + borda * 2) * escala;
  const data = new Uint8ClampedArray(lado * lado * 4).fill(255);
  for (let y = 0; y < lado; y += 1) {
    for (let x = 0; x < lado; x += 1) {
      const mx = Math.floor(x / escala) - borda;
      const my = Math.floor(y / escala) - borda;
      const escuro = mx >= 0 && my >= 0 && mx < modulos && my < modulos && matriz[my][mx];
      const p = (y * lado + x) * 4;
      const cor = escuro ? 0 : 255;
      data[p] = cor;
      data[p + 1] = cor;
      data[p + 2] = cor;
      data[p + 3] = 255;
    }
  }
  return { width: lado, height: lado, data };
}

describe("GF(256)", () => {
  it("multiplica e divide de forma consistente", () => {
    expect(multiplicar(0, 5)).toBe(0);
    expect(multiplicar(1, 200)).toBe(200);
    for (let a = 1; a < 256; a += 37) {
      for (let b = 1; b < 256; b += 29) {
        expect(dividir(multiplicar(a, b), b)).toBe(a);
      }
    }
  });

  it("respeita as potencias de alpha", () => {
    expect(potencia(0)).toBe(1);
    expect(potencia(255)).toBe(1);
    expect(potencia(-1)).toBe(potencia(254));
  });
});

describe("tabelas da especificacao", () => {
  it("calcula o total de codewords das versoes conhecidas", () => {
    expect(totalCodewords(1)).toBe(26);
    expect(totalCodewords(2)).toBe(44);
    expect(totalCodewords(7)).toBe(196);
    expect(totalCodewords(40)).toBe(3706);
  });

  it("divide os blocos somando o total de dados", () => {
    const blocos = blocosDaVersao(5, "Q");
    const soma = blocos.reduce((total, bloco) => total + bloco.dados + bloco.ec, 0);
    expect(soma).toBe(totalCodewords(5));
  });
});

describe("decodificador de matriz", () => {
  it("le texto alfanumerico", () => {
    const resultado = decodificarMatriz(gerarMatriz("FEIRA2026-ABC123"));
    expect(resultado.texto).toBe("FEIRA2026-ABC123");
    expect(resultado.nivel).toBe("M");
  });

  it("le texto numerico", () => {
    const resultado = decodificarMatriz(gerarMatriz("1234567890123"));
    expect(resultado.texto).toBe("1234567890123");
  });

  it("le texto em bytes com acentos", () => {
    const resultado = decodificarMatriz(gerarMatriz("Inscrição confirmada — José"));
    expect(resultado.texto).toBe("Inscrição confirmada — José");
  });

  it("le todos os niveis de correcao", () => {
    ["L", "M", "Q", "H"].forEach((nivel) => {
      const resultado = decodificarMatriz(
        gerarMatriz("VISITANTE-0001", { errorCorrectionLevel: nivel }),
      );
      expect(resultado.texto).toBe("VISITANTE-0001");
      expect(resultado.nivel).toBe(nivel);
    });
  });

  it("le versoes maiores com multiplos blocos", () => {
    const texto = "FEIRA2026-".repeat(20);
    const resultado = decodificarMatriz(gerarMatriz(texto, { errorCorrectionLevel: "Q" }));
    expect(resultado.texto).toBe(texto);
    expect(resultado.versao).toBeGreaterThan(6);
  });

  it("le um QR Code com 1500+ caracteres de texto", () => {
    const texto = "CREDENCIAL-FEIRA-2026-FRANCISCO-JOSE-DA-SILVA-123456789-".repeat(28);
    expect(texto.length).toBeGreaterThan(1500);
    const resultado = decodificarMatriz(gerarMatriz(texto, { errorCorrectionLevel: "M" }));
    expect(resultado.texto).toBe(texto);
  });
});

describe("correcao Reed-Solomon", () => {
  it("corrige modulos danificados na matriz", () => {
    const matriz = gerarMatriz("FEIRA2026-1699999-XYZ12", { errorCorrectionLevel: "H" });
    /* Danifica alguns modulos de dados no canto inferior direito */
    for (let i = 0; i < 6; i += 1) {
      const linha = matriz.length - 2 - i;
      matriz[linha][matriz.length - 2] = !matriz[linha][matriz.length - 2];
    }
    expect(decodificarMatriz(matriz).texto).toBe("FEIRA2026-1699999-XYZ12");
  });

  it("recusa blocos com erros acima do limite", () => {
    const bloco = new Array(26).fill(0);
    expect(() =>
      corrigirBloco(
        bloco.map((_, i) => (i * 7) % 256),
        10,
      ),
    ).toThrow();
  });
});

describe("leitura a partir de imagem", () => {
  it("le um QR Code renderizado em imagem", () => {
    const imagem = gerarImageData(gerarMatriz("FEIRA2026-CREDENCIAL-77"));
    const resultado = lerQrCode(imagem);
    expect(resultado?.texto).toBe("FEIRA2026-CREDENCIAL-77");
  });

  it("le imagem com cores invertidas", () => {
    const imagem = gerarImageData(gerarMatriz("FEIRA2026-INVERTIDO"));
    for (let i = 0; i < imagem.data.length; i += 4) {
      imagem.data[i] = 255 - imagem.data[i];
      imagem.data[i + 1] = 255 - imagem.data[i + 1];
      imagem.data[i + 2] = 255 - imagem.data[i + 2];
    }
    expect(lerQrCode(imagem)?.texto).toBe("FEIRA2026-INVERTIDO");
  });

  it("devolve null quando nao existe QR Code", () => {
    const branco = {
      width: 80,
      height: 80,
      data: new Uint8ClampedArray(80 * 80 * 4).fill(255),
    };
    expect(lerQrCode(branco)).toBeNull();
  });
});
