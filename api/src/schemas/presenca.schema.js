import { z } from "zod";

export const registrarPresencaSchema = z.object({
  codigoQr: z
    .string()
    .trim()
    .min(1, "Informe o código do QR Code.")
    .max(120, "Código QR muito longo."),
  setorId: z.string().trim().min(1, "Setor não informado.").max(40),
});
