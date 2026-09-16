import rateLimit from "express-rate-limit";

/* Limites diferenciados por sensibilidade da rota. Em produção com mais de uma
 * instância, troque o store padrão (memória) por um store compartilhado, ex.:
 * `rate-limit-redis`, para os limites valerem entre instâncias. */

function respostaLimite(mensagem) {
  return (req, res) => {
    res.status(429).json({ erro: { codigo: "LIMITE_EXCEDIDO", mensagem } });
  };
}

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: respostaLimite("Muitas tentativas. Aguarde alguns minutos e tente novamente."),
});

export const publicWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: respostaLimite("Muitas inscrições enviadas deste endereço. Aguarde alguns minutos."),
});

export const publicReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: respostaLimite("Muitas requisições. Aguarde um minuto e tente novamente."),
});

export const authenticatedLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.usuario?.id ?? req.ip,
  handler: respostaLimite("Muitas requisições. Aguarde um minuto e tente novamente."),
});
