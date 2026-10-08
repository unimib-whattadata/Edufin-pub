import * as React from "react";

interface BackupEmailTemplateProps {
  name: string;
  surname: string;
  userEmail: string;
  educatorEmail: string;
  area: string;
}

export function BackupEmailTemplate({
  name,
  surname,
  userEmail,
  educatorEmail,
  area,
}: BackupEmailTemplateProps) {
  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        lineHeight: "1.6",
        color: "#333",
        maxWidth: "600px",
        margin: "0 auto",
      }}
    >
      <h2 style={{ color: "#2563eb", marginBottom: "20px" }}>
        Nuova Richiesta di Incontro
      </h2>

      <p>Gentilissimi,</p>

      <p>
        È stata registrata una nuova richiesta di incontro con i seguenti
        dettagli:
      </p>

      <div
        style={{
          backgroundColor: "#f3f4f6",
          padding: "20px",
          borderRadius: "8px",
          marginTop: "20px",
          marginBottom: "20px",
        }}
      >
        <p style={{ margin: "8px 0" }}>
          <strong>Richiedente:</strong> {name} {surname}
        </p>
        <p style={{ margin: "8px 0" }}>
          <strong>Email utente:</strong>{" "}
          <a href={`mailto:${userEmail}`}>{userEmail}</a>
        </p>
        <p style={{ margin: "8px 0" }}>
          <strong>Area di interesse:</strong> {area}
        </p>
        <p style={{ margin: "8px 0" }}>
          <strong>Educatore assegnato:</strong>{" "}
          <a href={`mailto:${educatorEmail}`}>{educatorEmail}</a>
        </p>
      </div>

      <p>
        L&apos;educatore è invitato a contattare l&apos;utente per organizzare
        l&apos;incontro di 30 minuti.
      </p>

      <p style={{ marginTop: "30px", color: "#6b7280" }}>
        Cordiali saluti,
        <br />
        <strong>Sistema Aida - Assistente Finanziario</strong>
      </p>
    </div>
  );
}
