import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { Resend } from "resend";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { EmailTemplate } from "~/server/api/routers/email-templates/financial-educator-email";
import { BackupEmailTemplate } from "./email-templates/backup-email";
import { appointments } from "~/server/db/schema";

// Definizione delle aree valide per la validazione
const validAreas = [
  "PROTEZIONE",
  "PREVIDENZA",
  "FISCALITA",
  "RISPARMIO/INVESTIMENTI",
  "FINANZIAMENTI",
] as const;

type ValidArea = (typeof validAreas)[number];

// Type guard per verificare se un'area è valida
function isValidArea(area: string | undefined): area is ValidArea {
  return area !== undefined && validAreas.includes(area as ValidArea);
}

export const emailRouter = createTRPCRouter({
  sendEmail: publicProcedure
    .input(
      z.object({
        name: z.string(),
        surname: z.string(),
        to: z.string().email(),
        area: z.string().optional(),
        educatorEmail: z
          .string()
          .email()
          .optional()
          .default("fabio.dadda5@gmail.com"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const area = input.area;
      if (!area)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send email",
        });
      let email = "";
      switch (area) {
        case "PROTEZIONE":
          email = "daniele.damore@aief.eu";
          break;
        case "PREVIDENZA":
          email = "daniele.damore@aief.eu";
          break;
        case "FISCALITA":
          email = "angela.miola@aief.eu";
          break;
        case "RISPARMIO/INVESTIMENTI":
          email = "lucilla.settimi@aief.eu";
          break;
        case "FINANZIAMENTI":
          email = "ferdinando.caputo@aief.eu";
          break;
        default:
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to send email",
          });
      }
      // Email all'educatore
      try {
        const { error } = await resend.emails.send({
          from: "prenotazione@aida.whattadata.it",
          to: [email],
          subject: "Richiesta Incontro di 30 minuti",
          replyTo: input.to,
          react: EmailTemplate({
            name: input.name,
            surname: input.surname,
            userEmail: input.to,
          }),
        });

        if (error) {
          console.log("ERROR", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
          });
        }
      } catch (error) {
        console.log("ERROR IN CATCH", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send email",
        });
      }

      // Email ad AIEF di Backup
      try {
        const { error } = await resend.emails.send({
          from: "prenotazione@aida.whattadata.it",
          to: ["aida@aief.eu"],
          subject: "Tracciamento Richiesta Incontro di 30 minuti",
          react: BackupEmailTemplate({
            name: input.name,
            surname: input.surname,
            userEmail: input.to,
            area: input.area ?? "Educazione Finanziaria Generale",
            educatorEmail: input.educatorEmail,
          }),
        });

        if (error) {
          console.log("ERROR", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
          });
        }
      } catch (error) {
        console.log("ERROR IN CATCH", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send email",
        });
      }

      // Salva l'appuntamento nel database per le statistiche
      try {
        if (isValidArea(area)) {
          await ctx.db.insert(appointments).values({
            area: area,
            userName: input.name,
            userSurname: input.surname,
            userEmail: input.to,
            educatorEmail: email,
          });
        }
      } catch (error) {
        // Non bloccare l'invio dell'email se il salvataggio delle statistiche fallisce
        console.log("ERROR SAVING APPOINTMENT STATS", error);
      }

      return { success: true };
    }),
});
