import * as React from "react";

interface EmailTemplateProps {
  name: string;
  surname: string;
  userEmail: string;
}

export function EmailTemplate({
  name,
  surname,
  userEmail,
}: EmailTemplateProps) {
  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        lineHeight: "1.6",
        color: "#333",
      }}
    >
      <p>Gentile Educatore,</p>
      <p>
        È stato richiesto un incontro da parte dell&apos;utente{" "}
        <strong>
          {name} {surname}
        </strong>
        .
      </p>
      <p>
        La invitiamo a rispondere a questa email per mettersi in contatto
        direttamente con l&apos;utente ({userEmail}) e organizzare
        l&apos;incontro.
      </p>
      <p style={{ marginTop: "20px" }}>
        Cordiali saluti,
        <br />
        <strong>Aida - Assistente Finanziario</strong>
      </p>
    </div>
  );
}
