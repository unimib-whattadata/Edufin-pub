export type DashboardReportStatistics = {
  totalChats: number;
  chatsWithUserMessages: number;
  totalMessages: number;
  totalAppointments: number;
  uniqueUsers: number;
  feedbackStats: {
    totalVotes: number;
    upvotes: number;
    downvotes: number;
    positiveRate: number;
  };
  messagesByDay: Array<{ date: string; count: number }>;
  chatsByDay: Array<{ date: string; count: number }>;
  messagesBySender: Array<{ sender: string; count: number }>;
  appointmentsByArea: Array<{ area: string; count: number }>;
  appointmentsByDay: Array<{ date: string; count: number }>;
};

export type DashboardReportRow = {
  chatId: number;
  answerMessageId: number;
  questionText: string;
  answerText: string;
  feedback: string | null;
  note: string | null;
  questionTime: Date | string;
  answerTime: Date | string;
  feedbackTime: Date | string | null;
};

type RGB = readonly [number, number, number];

type RasterImage = {
  width: number;
  height: number;
  data: Uint8Array;
};

type PdfImage = RasterImage & {
  name: string;
  objectId: number | null;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 32;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
  navy: [16, 36, 65] as RGB,
  blue: [25, 119, 210] as RGB,
  cyan: [20, 161, 196] as RGB,
  green: [91, 167, 57] as RGB,
  mint: [225, 244, 235] as RGB,
  red: [198, 73, 75] as RGB,
  paleRed: [253, 237, 237] as RGB,
  amber: [210, 143, 25] as RGB,
  paleAmber: [255, 246, 223] as RGB,
  purple: [111, 86, 175] as RGB,
  paleBlue: [235, 244, 253] as RGB,
  ink: [35, 49, 68] as RGB,
  muted: [100, 115, 135] as RGB,
  grid: [222, 229, 237] as RGB,
  soft: [247, 249, 252] as RGB,
  white: [255, 255, 255] as RGB,
  black: [0, 0, 0] as RGB,
};

const pdfNumber = (value: number) =>
  Number.isFinite(value) ? value.toFixed(3).replace(/\.000$/, "") : "0";

const pdfColor = (color: RGB) =>
  color
    .map((value) => value / 255)
    .map(pdfNumber)
    .join(" ");

const pdfText = (value: string) => {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/€/g, "EUR")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/→/g, "->")
    .replace(/•/g, "-")
    .replace(/[^\x20-\x7E]/g, "?");

  return normalized
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
};

const cleanReportText = (value: string | null | undefined) =>
  (value ?? "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/[#*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const truncate = (value: string, maxLength: number) =>
  value.length > maxLength
    ? `${value.slice(0, maxLength - 3).trim()}...`
    : value;

const wrapText = (value: string, maxCharacters: number) => {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    if (word.length > maxCharacters) {
      if (line) lines.push(line);
      for (let index = 0; index < word.length; index += maxCharacters) {
        lines.push(word.slice(index, index + maxCharacters));
      }
      line = "";
      continue;
    }

    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxCharacters && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);
  return lines;
};

class PdfPage {
  readonly commands: string[] = [];
  readonly usedImages = new Set<PdfImage>();
}

class PdfBuilder {
  readonly pages: PdfPage[] = [];
  readonly images: PdfImage[] = [];

  createPage() {
    const page = new PdfPage();
    this.pages.push(page);
    return page;
  }

  addImage(image: RasterImage) {
    const pdfImage: PdfImage = {
      ...image,
      name: `Im${this.images.length + 1}`,
      objectId: null,
    };
    this.images.push(pdfImage);
    return pdfImage;
  }

  async save() {
    const encoder = new TextEncoder();
    const objects: Uint8Array[] = [];
    const addObject = (value: string | Uint8Array) => {
      const id = objects.length + 1;
      objects.push(typeof value === "string" ? encoder.encode(value) : value);
      return id;
    };
    const reserveObject = () => addObject(new Uint8Array());
    const setObject = (id: number, value: string | Uint8Array) => {
      objects[id - 1] =
        typeof value === "string" ? encoder.encode(value) : value;
    };
    const concat = (...parts: Array<string | Uint8Array>) => {
      const arrays = parts.map((part) =>
        typeof part === "string" ? encoder.encode(part) : part,
      );
      const totalLength = arrays.reduce(
        (total, part) => total + part.length,
        0,
      );
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const part of arrays) {
        result.set(part, offset);
        offset += part.length;
      }
      return result;
    };

    const regularFontId = addObject(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    );
    const boldFontId = addObject(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    );

    for (const image of this.images) {
      const imageStream = concat(
        `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${image.data.length} >>\nstream\n`,
        image.data,
        "\nendstream",
      );
      image.objectId = addObject(imageStream);
    }

    const contentIds = this.pages.map((page) => {
      const content = encoder.encode(page.commands.join("\n"));
      return addObject(
        concat(
          `<< /Length ${content.length} >>\nstream\n`,
          content,
          "\nendstream",
        ),
      );
    });
    const pageIds = this.pages.map(() => reserveObject());
    const pagesId = reserveObject();
    const catalogId = reserveObject();

    this.pages.forEach((page, index) => {
      const xObjects = Array.from(page.usedImages)
        .map((image) => `/${image.name} ${image.objectId ?? 0} 0 R`)
        .join(" ");
      const resources = `<< /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >>${
        xObjects ? ` /XObject << ${xObjects} >>` : ""
      } >>`;
      setObject(
        pageIds[index]!,
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources ${resources} /Contents ${contentIds[index]} 0 R >>`,
      );
    });

    setObject(
      pagesId,
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
    );
    setObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

    const header = encoder.encode("%PDF-1.4\n%PDF\n");
    const chunks: Uint8Array[] = [header];
    const offsets: number[] = [0];
    let offset = header.length;

    objects.forEach((object, index) => {
      const prefix = encoder.encode(`${index + 1} 0 obj\n`);
      const suffix = encoder.encode("\nendobj\n");
      offsets.push(offset);
      chunks.push(prefix, object, suffix);
      offset += prefix.length + object.length + suffix.length;
    });

    const xrefOffset = offset;
    const xref = [
      `xref\n0 ${objects.length + 1}`,
      "0000000000 65535 f ",
      ...offsets
        .slice(1)
        .map((value) => `${String(value).padStart(10, "0")} 00000 n `),
      "",
      `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>`,
      `startxref\n${xrefOffset}`,
      "%%EOF",
    ].join("\n");
    chunks.push(encoder.encode(`${xref}\n`));

    const totalLength = chunks.reduce(
      (total, chunk) => total + chunk.length,
      0,
    );
    const result = new Uint8Array(totalLength);
    let resultOffset = 0;
    for (const chunk of chunks) {
      result.set(chunk, resultOffset);
      resultOffset += chunk.length;
    }
    return result;
  }
}

const fillRect = (
  page: PdfPage,
  x: number,
  y: number,
  width: number,
  height: number,
  color: RGB,
) => {
  page.commands.push(
    `${pdfColor(color)} rg ${pdfNumber(x)} ${pdfNumber(y)} ${pdfNumber(width)} ${pdfNumber(height)} re f`,
  );
};

const strokeRect = (
  page: PdfPage,
  x: number,
  y: number,
  width: number,
  height: number,
  stroke: RGB,
  lineWidth = 0.8,
) => {
  page.commands.push(
    `${pdfColor(stroke)} RG ${pdfNumber(lineWidth)} w ${pdfNumber(x)} ${pdfNumber(y)} ${pdfNumber(width)} ${pdfNumber(height)} re S`,
  );
};

const line = (
  page: PdfPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: RGB,
  lineWidth = 0.8,
) => {
  page.commands.push(
    `${pdfColor(color)} RG ${pdfNumber(lineWidth)} w ${pdfNumber(x1)} ${pdfNumber(y1)} m ${pdfNumber(x2)} ${pdfNumber(y2)} l S`,
  );
};

const drawText = (
  page: PdfPage,
  value: string,
  x: number,
  y: number,
  size: number,
  color: RGB = COLORS.ink,
  bold = false,
) => {
  page.commands.push(
    `${pdfColor(color)} rg BT /${bold ? "F2" : "F1"} ${pdfNumber(size)} Tf 1 0 0 1 ${pdfNumber(x)} ${pdfNumber(y)} Tm (${pdfText(value)}) Tj ET`,
  );
};

const drawWrappedText = (
  page: PdfPage,
  value: string,
  x: number,
  y: number,
  width: number,
  size: number,
  color: RGB = COLORS.ink,
  maxLines?: number,
  bold = false,
) => {
  const charactersPerLine = Math.max(8, Math.floor(width / (size * 0.51)));
  let lines = wrapText(value, charactersPerLine);
  if (maxLines && lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] =
      truncate(lines[maxLines - 1] ?? "", Math.max(4, charactersPerLine - 3)) +
      "...";
  }
  const lineHeight = size * 1.32;
  lines.forEach((text, index) =>
    drawText(page, text, x, y - index * lineHeight, size, color, bold),
  );
  return lines.length * lineHeight;
};

const drawTextLines = (
  page: PdfPage,
  lines: string[],
  x: number,
  y: number,
  size: number,
  color: RGB = COLORS.ink,
  bold = false,
) => {
  const lineHeight = size * 1.32;
  lines.forEach((text, index) =>
    drawText(page, text, x, y - index * lineHeight, size, color, bold),
  );
};

const drawImage = (
  page: PdfPage,
  image: PdfImage,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  page.usedImages.add(image);
  page.commands.push(
    `q ${pdfNumber(width)} 0 0 ${pdfNumber(height)} ${pdfNumber(x)} ${pdfNumber(y)} cm /${image.name} Do Q`,
  );
};

const drawImageContain = (
  page: PdfPage,
  image: PdfImage,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
) => {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  drawImage(
    page,
    image,
    x + (maxWidth - width) / 2,
    y + (maxHeight - height) / 2,
    width,
    height,
  );
};

const drawLabel = (
  page: PdfPage,
  value: string,
  x: number,
  y: number,
  color: RGB = COLORS.muted,
) => {
  drawText(page, value.toUpperCase(), x, y, 7.2, color, true);
};

const drawKpiCard = (
  page: PdfPage,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  detail: string,
  accent: RGB,
  background: RGB = COLORS.paleBlue,
) => {
  fillRect(page, x, y, width, height, background);
  strokeRect(page, x, y, width, height, [191, 224, 242], 0.7);
  fillRect(page, x, y, 4, height, accent);
  drawLabel(page, label, x + 16, y + height - 20, COLORS.muted);
  drawText(page, value, x + 16, y + 29, 23, COLORS.navy, true);
  drawText(page, detail, x + 16, y + 13, 7.5, COLORS.muted);
};

const drawReportHeader = (
  page: PdfPage,
  title: string,
  periodLabel: string,
  description: string,
  aief: PdfImage | null,
) => {
  fillRect(page, 0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLORS.white);
  if (aief) {
    drawImageContain(page, aief, MARGIN, 775, 140, 54);
  } else {
    drawText(page, "aief", MARGIN, 798, 24, COLORS.cyan, true);
  }
  drawText(
    page,
    "REPORT MENSILE",
    PAGE_WIDTH - MARGIN - 92,
    807,
    7.5,
    COLORS.navy,
    true,
  );
  drawText(page, title, MARGIN, 720, 24, COLORS.navy, true);
  drawText(page, periodLabel, MARGIN, 696, 12.5, COLORS.muted);
  line(page, MARGIN, 681, PAGE_WIDTH - MARGIN, 681, [150, 181, 211], 0.8);
  if (description) drawText(page, description, MARGIN, 665, 7.6, COLORS.muted);
};

const drawFooter = (
  builder: PdfBuilder,
  page: PdfPage,
  pageNumber: number,
  totalPages: number,
  bicocca: RasterImage | null,
  whattadata: RasterImage | null,
) => {
  line(page, MARGIN, 36, PAGE_WIDTH - MARGIN, 36, COLORS.grid, 0.7);
  drawWhattadataWordmark(
    page,
    MARGIN,
    24,
    false,
    whattadata ? builder.addImage(whattadata) : null,
  );
  if (bicocca) {
    drawImageContain(page, builder.addImage(bicocca), 268, 8, 100, 22);
  } else {
    drawText(
      page,
      "Bicocca | knowledge base",
      268,
      17,
      6.2,
      COLORS.muted,
      true,
    );
  }
  drawText(
    page,
    `${String(pageNumber).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`,
    PAGE_WIDTH - MARGIN - 36,
    17,
    7.2,
    COLORS.muted,
    true,
  );
};

const drawWhattadataWordmark = (
  page: PdfPage,
  x: number,
  y: number,
  inverse = false,
  logo: PdfImage | null = null,
) => {
  const color = inverse ? COLORS.white : COLORS.navy;
  if (logo) {
    drawImageContain(page, logo, x, y - 1, 17, 17);
  } else {
    fillRect(page, x, y + 4, 7, 7, COLORS.cyan);
    fillRect(page, x + 9, y + 4, 7, 7, COLORS.green);
  }
  drawText(page, "w h a t t a d a t a", x + 23, y + 2, 9.5, color, true);
  drawText(
    page,
    "PROVIDER DELLA SOLUZIONE",
    x + 23,
    y - 9,
    5.3,
    inverse ? [215, 224, 236] : COLORS.muted,
    true,
  );
};

const drawSectionTitle = (page: PdfPage, title: string, y: number) => {
  drawText(page, title, MARGIN, y, 13.5, COLORS.navy, true);
  line(page, MARGIN, y - 8, PAGE_WIDTH - MARGIN, y - 8, COLORS.grid, 0.7);
};

const drawMetricRow = (
  page: PdfPage,
  label: string,
  value: string,
  y: number,
) => {
  line(page, MARGIN, y - 8, PAGE_WIDTH - MARGIN, y - 8, COLORS.grid, 0.6);
  drawText(page, label, MARGIN, y, 8.2, COLORS.ink);
  drawText(page, value, PAGE_WIDTH - MARGIN - 10, y - 1, 12, COLORS.navy, true);
};

const drawSummaryCard = (
  page: PdfPage,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  body: string,
  note?: string,
) => {
  fillRect(page, x, y, width, height, COLORS.paleBlue);
  drawText(page, title, x + 16, y + height - 24, 13, COLORS.navy, true);
  drawWrappedText(
    page,
    body,
    x + 16,
    y + height - 43,
    width - 32,
    8.5,
    COLORS.ink,
    2,
  );
  if (note) drawText(page, note, x + 16, y + 13, 6.5, COLORS.muted);
};

const drawPill = (
  page: PdfPage,
  label: string,
  x: number,
  y: number,
  width: number,
  background: RGB,
  color: RGB,
) => {
  fillRect(page, x, y, width, 18, background);
  drawText(page, label, x + 9, y + 5, 7.2, color, true);
};

const drawFeedbackSummary = (
  page: PdfPage,
  x: number,
  y: number,
  width: number,
  height: number,
  statistics: DashboardReportStatistics,
) => {
  fillRect(page, x, y, width, height, COLORS.paleBlue);
  const total = formatInteger(statistics.feedbackStats.totalVotes);
  drawText(
    page,
    `${total} valutazioni raccolte`,
    x + 16,
    y + height - 25,
    12,
    COLORS.navy,
    true,
  );
  drawText(
    page,
    "I feedback descrivono le sole risposte valutate.",
    x + 16,
    y + 15,
    7.2,
    COLORS.muted,
  );
  drawPill(
    page,
    `${formatInteger(statistics.feedbackStats.upvotes)} positive`,
    x + width - 190,
    y + height - 34,
    86,
    COLORS.mint,
    COLORS.green,
  );
  drawPill(
    page,
    `${formatInteger(statistics.feedbackStats.downvotes)} negative`,
    x + width - 96,
    y + height - 34,
    80,
    COLORS.paleRed,
    COLORS.red,
  );
};

const drawSelectedFeedbackCard = (
  page: PdfPage,
  row: DashboardReportRow,
  x: number,
  y: number,
  width: number,
  height: number,
  questionLines: string[],
  answerLines: string[],
  showNote: boolean,
  continuation: boolean,
) => {
  const isPositive = row.feedback === "positivo";
  const isNegative = row.feedback === "negativo";
  const accent = isPositive
    ? COLORS.green
    : isNegative
      ? COLORS.red
      : COLORS.amber;
  const paleAccent = isPositive
    ? COLORS.mint
    : isNegative
      ? COLORS.paleRed
      : COLORS.paleAmber;
  const label = isPositive
    ? "POSITIVO"
    : isNegative
      ? "NEGATIVO"
      : "NOTA QUALITATIVA";
  const questionSize = 8.4;
  const answerSize = 8.1;
  const questionLineHeight = questionSize * 1.32;
  const questionLineCount = questionLines.length;
  const questionTextY = y + height - 63;
  const answerLabelY = questionLines.length
    ? questionTextY - questionLineCount * questionLineHeight - 13
    : y + height - 51;
  const answerTextY = answerLabelY - 13;

  fillRect(page, x, y, width, height, COLORS.white);
  strokeRect(page, x, y, width, height, [191, 224, 242], 0.7);
  fillRect(page, x, y, 5, height, accent);
  drawPill(
    page,
    label,
    x + 16,
    y + height - 32,
    isNegative ? 61 : 55,
    paleAccent,
    accent,
  );
  drawText(
    page,
    `Chat #${row.chatId}`,
    x + 86,
    y + height - 26,
    8.5,
    COLORS.navy,
    true,
  );
  if (questionLines.length) {
    drawLabel(
      page,
      continuation ? "Domanda dell'utente (continua)" : "Domanda dell'utente",
      x + 16,
      y + height - 51,
      COLORS.muted,
    );
    drawTextLines(
      page,
      questionLines,
      x + 16,
      questionTextY,
      questionSize,
      COLORS.ink,
    );
  }
  if (answerLines.length) {
    drawLabel(
      page,
      continuation ? "Risposta AIDA (continua)" : "Risposta AIDA",
      x + 16,
      answerLabelY,
      accent,
    );
    drawTextLines(
      page,
      answerLines,
      x + 16,
      answerTextY,
      answerSize,
      COLORS.ink,
    );
  }
  if (showNote && row.note?.trim()) {
    fillRect(page, x + 16, y + 10, width - 32, 20, COLORS.paleAmber);
    drawWrappedText(
      page,
      `Nota: ${cleanReportText(row.note)}`,
      x + 23,
      y + 22,
      width - 46,
      6.8,
      COLORS.amber,
      1,
      true,
    );
  }
};

type SelectedFeedbackContent = {
  row: DashboardReportRow;
  questionLines: string[];
  answerLines: string[];
  showNote: boolean;
  continuation: boolean;
};

const drawSelectedFeedbackPage = (
  page: PdfPage,
  content: SelectedFeedbackContent | null,
  firstPage: boolean,
  lastPage: boolean,
  statistics: DashboardReportStatistics,
  periodLabel: string,
  aief: PdfImage | null,
  improvementBody: string,
) => {
  if (firstPage) {
    drawReportHeader(
      page,
      "Feedback degli utenti",
      periodLabel,
      "Risposte valutate e principali evidenze qualitative.",
      aief,
    );
    drawFeedbackSummary(page, MARGIN, 570, CONTENT_WIDTH, 70, statistics);
    drawSectionTitle(page, "Domande Valutate", 542);
  } else {
    drawReportHeader(
      page,
      "Domande Valutate",
      periodLabel,
      "Dettaglio delle risposte valutate nel periodo.",
      aief,
    );
    drawSectionTitle(page, "Domande Valutate", 640);
  }

  let cardY: number | null = null;

  if (content) {
    const questionLineHeight = 8.4 * 1.32;
    const answerLineHeight = 8.1 * 1.32;
    const questionHeight = content.questionLines.length * questionLineHeight;
    const answerHeight = content.answerLines.length
      ? (content.questionLines.length ? 89 + questionHeight : 64) +
        Math.max(0, content.answerLines.length - 1) * answerLineHeight
      : 63 + Math.max(0, content.questionLines.length - 1) * questionLineHeight;
    const cardHeight = Math.max(
      170,
      answerHeight + (content.showNote ? 40 : 18),
    );
    const cardTop = firstPage ? 520 : 620;
    cardY = cardTop - cardHeight;
    drawSelectedFeedbackCard(
      page,
      content.row,
      MARGIN,
      cardY,
      CONTENT_WIDTH,
      cardHeight,
      content.questionLines,
      content.answerLines,
      content.showNote,
      content.continuation,
    );
  }

  if (lastPage) {
    const improvementY = cardY === null ? 92 : Math.max(54, cardY - 12 - 72);
    drawImprovementCard(
      page,
      MARGIN,
      improvementY,
      CONTENT_WIDTH,
      72,
      improvementBody,
    );
  }
};

const splitSelectedFeedbackRow = (
  row: DashboardReportRow,
  width: number,
): SelectedFeedbackContent[] => {
  const questionSize = 8.4;
  const answerSize = 8.1;
  const remainingQuestion = wrapText(
    cleanReportText(row.questionText) || "Domanda non disponibile",
    Math.max(8, Math.floor((width - 32) / (questionSize * 0.51))),
  );
  const remainingAnswer = wrapText(
    cleanReportText(row.answerText) || "Risposta non disponibile",
    Math.max(8, Math.floor((width - 32) / (answerSize * 0.51))),
  );
  const chunks: SelectedFeedbackContent[] = [];
  let firstChunk = true;

  while (remainingQuestion.length || remainingAnswer.length) {
    const questionLines = remainingQuestion.splice(0, 4);
    const answerCapacity = firstChunk ? 15 : questionLines.length ? 25 : 28;
    const answerLines = remainingAnswer.splice(0, answerCapacity);
    chunks.push({
      row,
      questionLines,
      answerLines,
      showNote: false,
      continuation: !firstChunk,
    });
    firstChunk = false;
  }

  const lastChunk = chunks[chunks.length - 1];
  if (lastChunk) lastChunk.showNote = true;
  return chunks;
};

const drawImprovementCard = (
  page: PdfPage,
  x: number,
  y: number,
  width: number,
  height: number,
  body: string,
) => {
  fillRect(page, x, y, width, height, COLORS.paleBlue);
  drawText(
    page,
    "Spunto di miglioramento",
    x + 16,
    y + height - 23,
    12,
    COLORS.navy,
    true,
  );
  drawWrappedText(
    page,
    body,
    x + 16,
    y + height - 42,
    width - 32,
    8.2,
    COLORS.ink,
    2,
  );
};

const drawChartCard = (
  page: PdfPage,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  subtitle: string,
  data: Array<{ label: string; value: number }>,
  color: RGB,
  chartType: "line" | "bar",
) => {
  fillRect(page, x, y, width, height, COLORS.white);
  strokeRect(page, x, y, width, height, COLORS.grid, 0.7);
  drawText(page, title, x + 15, y + height - 25, 11, COLORS.navy, true);
  drawText(page, subtitle, x + 15, y + height - 39, 7.2, COLORS.muted);

  if (data.length === 0) {
    drawText(
      page,
      "Nessun dato disponibile per il periodo",
      x + 24,
      y + height / 2,
      8,
      COLORS.muted,
    );
    return;
  }

  const chartX = x + 34;
  const chartY = y + 27;
  const chartWidth = width - 48;
  const chartHeight = height - 83;
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const gridSteps = 4;

  fillRect(page, x + 15, y + 22, width - 30, height - 54, COLORS.soft);

  for (let step = 0; step <= gridSteps; step += 1) {
    const gridY = chartY + (chartHeight / gridSteps) * step;
    line(page, chartX, gridY, chartX + chartWidth, gridY, COLORS.grid, 0.5);
    const gridValue = Math.round((maxValue / gridSteps) * step);
    drawText(page, String(gridValue), x + 5, gridY - 2, 6.2, COLORS.muted);
  }

  if (chartType === "line") {
    const points = data.map((item, index) => {
      const pointX =
        chartX +
        (data.length === 1
          ? chartWidth / 2
          : (chartWidth / (data.length - 1)) * index);
      const pointY = chartY + (item.value / maxValue) * chartHeight;
      return [pointX, pointY] as const;
    });
    page.commands.push(
      `${pdfColor(COLORS.paleBlue)} rg ${pdfNumber(chartX)} ${pdfNumber(chartY)} m ${points
        .map(
          ([pointX, pointY]) => `${pdfNumber(pointX)} ${pdfNumber(pointY)} l`,
        )
        .join(" ")} ${pdfNumber(chartX + chartWidth)} ${pdfNumber(chartY)} l f`,
    );
    points.forEach(([pointX, pointY], index) => {
      if (index > 0) {
        const [previousX, previousY] = points[index - 1]!;
        line(page, previousX, previousY, pointX, pointY, color, 1.8);
      }
      fillRect(page, pointX - 2, pointY - 2, 4, 4, color);
    });
  } else {
    const gap = Math.min(9, chartWidth / Math.max(data.length * 2, 1));
    const barWidth = Math.max(
      4,
      (chartWidth - gap * Math.max(data.length - 1, 0)) / data.length,
    );
    data.forEach((item, index) => {
      const barX = chartX + index * (barWidth + gap);
      const barHeight = (item.value / maxValue) * chartHeight;
      fillRect(page, barX, chartY, barWidth, barHeight, color);
    });
  }

  const labelIndexes = Array.from(
    new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]),
  );
  labelIndexes.forEach((index) => {
    const item = data[index];
    if (!item) return;
    const labelX =
      chartX +
      (data.length === 1
        ? chartWidth / 2
        : (chartWidth / (data.length - 1)) * index);
    drawText(
      page,
      item.label,
      Math.max(chartX, labelX - 12),
      chartY - 14,
      6.2,
      COLORS.muted,
    );
  });
};

const formatInteger = (value: number) =>
  new Intl.NumberFormat("it-IT").format(Math.round(Number(value) || 0));

const formatShortDate = (value: string | Date) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
};

const formatDateTime = (value: string | Date | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateRange = (startDate: string, endDate: string) => {
  const format = (value: string) => {
    const [year, month, day] = value.split("-");
    return year && month && day ? `${day}/${month}/${year}` : value;
  };
  return `${format(startDate)} - ${format(endDate)}`;
};

const toSeries = (items: Array<{ date: string; count: number }>) =>
  items.map((item) => ({
    label: formatShortDate(item.date),
    value: Number(item.count) || 0,
  }));

const areaNameMap: Record<string, string> = {
  PROTEZIONE: "Protezione",
  PREVIDENZA: "Previdenza",
  FISCALITA: "Fiscalita",
  "RISPARMIO/INVESTIMENTI": "Risparmio / investimenti",
  FINANZIAMENTI: "Finanziamenti",
};

type FeedbackAppendixContent = {
  row: DashboardReportRow;
  questionLines: string[];
  answerLines: string[];
  noteLines: string[];
  continuation: boolean;
  noteContinuation: boolean;
};

const splitFeedbackAppendixRow = (
  row: DashboardReportRow,
  width: number,
): FeedbackAppendixContent[] => {
  const questionSize = 7.6;
  const answerSize = 7.2;
  const noteSize = 6.8;
  const questionLines = wrapText(
    cleanReportText(row.questionText) || "Domanda non disponibile",
    Math.max(8, Math.floor((width - 30) / (questionSize * 0.51))),
  );
  const answerLines = wrapText(
    cleanReportText(row.answerText) || "Risposta non disponibile",
    Math.max(8, Math.floor((width - 30) / (answerSize * 0.51))),
  );
  const remainingQuestion = [...questionLines];
  const remainingAnswer = [...answerLines];
  const chunks: FeedbackAppendixContent[] = [];
  let firstChunk = true;

  while (remainingQuestion.length || remainingAnswer.length) {
    const currentQuestion = remainingQuestion.splice(0, 4);
    const answerCapacity = firstChunk ? 14 : currentQuestion.length ? 20 : 24;
    const currentAnswer = remainingAnswer.splice(0, answerCapacity);
    chunks.push({
      row,
      questionLines: currentQuestion,
      answerLines: currentAnswer,
      noteLines: [],
      continuation: !firstChunk,
      noteContinuation: false,
    });
    firstChunk = false;
  }

  const remainingNote = wrapText(
    cleanReportText(row.note),
    Math.max(8, Math.floor((width - 44) / (noteSize * 0.51))),
  );
  if (remainingNote.length) {
    const lastChunk = chunks[chunks.length - 1];
    if (lastChunk) lastChunk.noteLines = remainingNote.splice(0, 3);
    while (remainingNote.length) {
      chunks.push({
        row,
        questionLines: [],
        answerLines: [],
        noteLines: remainingNote.splice(0, 8),
        continuation: true,
        noteContinuation: true,
      });
    }
  }

  return chunks;
};

const getFeedbackAppendixCardHeight = (content: FeedbackAppendixContent) => {
  const questionLineHeight = 7.6 * 1.32;
  const answerLineHeight = 7.2 * 1.32;
  const noteLineHeight = 6.8 * 1.32;
  const questionBottom = content.questionLines.length
    ? 55 + (content.questionLines.length - 1) * questionLineHeight
    : 0;
  const answerStart = content.questionLines.length
    ? 80 + content.questionLines.length * questionLineHeight
    : 55;
  const answerBottom = content.answerLines.length
    ? answerStart + (content.answerLines.length - 1) * answerLineHeight
    : 0;
  const textBottom = Math.max(questionBottom, answerBottom, 55);
  const noteHeight = content.noteLines.length
    ? 14 + content.noteLines.length * noteLineHeight
    : 0;
  return Math.max(148, textBottom + (noteHeight ? noteHeight + 22 : 18));
};

const drawFeedbackCard = (
  page: PdfPage,
  row: DashboardReportRow,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: RGB,
  label: string,
  content: FeedbackAppendixContent,
) => {
  fillRect(page, x, y, width, height, COLORS.white);
  strokeRect(page, x, y, width, height, COLORS.grid, 0.7);
  fillRect(page, x, y, 5, height, accent);
  drawText(
    page,
    `Chat #${row.chatId}`,
    x + 15,
    y + height - 21,
    8.5,
    COLORS.navy,
    true,
  );
  drawText(page, label, x + 75, y + height - 21, 7.2, accent, true);
  const dateText = formatDateTime(row.feedbackTime ?? row.answerTime);
  drawText(page, dateText, x + width - 102, y + height - 21, 6.7, COLORS.muted);

  const questionLineHeight = 7.6 * 1.32;
  const questionTextY = y + height - 55;
  const answerLabelY = content.questionLines.length
    ? questionTextY - content.questionLines.length * questionLineHeight - 12
    : y + height - 42;
  const answerTextY = answerLabelY - 13;

  if (content.questionLines.length) {
    drawLabel(
      page,
      content.continuation ? "Domanda (continua)" : "Domanda",
      x + 15,
      y + height - 42,
      COLORS.blue,
    );
    drawTextLines(
      page,
      content.questionLines,
      x + 15,
      questionTextY,
      7.6,
      COLORS.ink,
    );
  }
  if (content.answerLines.length) {
    drawLabel(
      page,
      content.continuation ? "Risposta AIDA (continua)" : "Risposta AIDA",
      x + 15,
      answerLabelY,
      accent,
    );
    drawTextLines(
      page,
      content.answerLines,
      x + 15,
      answerTextY,
      7.2,
      COLORS.ink,
    );
  }

  if (content.noteLines.length) {
    const noteLineHeight = 6.8 * 1.32;
    const noteHeight = 14 + content.noteLines.length * noteLineHeight;
    fillRect(page, x + 15, y + 12, width - 30, noteHeight, COLORS.paleAmber);
    drawLabel(
      page,
      content.noteContinuation ? "Nota (continua)" : "Nota",
      x + 22,
      y + 12 + noteHeight - 11,
      COLORS.amber,
    );
    drawTextLines(
      page,
      content.noteLines,
      x + 22,
      y + 12 + noteHeight - 22,
      6.8,
      COLORS.ink,
    );
  }
};

const drawFeedbackPages = (
  builder: PdfBuilder,
  title: string,
  periodLabel: string,
  subtitle: string,
  rows: DashboardReportRow[],
  accent: RGB,
  label: string,
  aief: RasterImage | null,
) => {
  if (rows.length === 0) return;

  const contents = rows.flatMap((row) =>
    splitFeedbackAppendixRow(row, CONTENT_WIDTH),
  );
  const cardGap = 12;
  let page: PdfPage | null = null;
  let cursorY = 0;

  contents.forEach((content) => {
    const cardHeight = getFeedbackAppendixCardHeight(content);
    if (!page || cursorY - cardHeight < 46) {
      page = builder.createPage();
      drawReportHeader(
        page,
        title,
        periodLabel,
        subtitle,
        aief ? builder.addImage(aief) : null,
      );
      cursorY = PAGE_HEIGHT - 124;
    }
    drawFeedbackCard(
      page,
      content.row,
      MARGIN,
      cursorY - cardHeight,
      CONTENT_WIDTH,
      cardHeight,
      accent,
      label,
      content,
    );
    cursorY -= cardHeight + cardGap;
  });
};

const loadImage = async (source: string) => {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Unable to load ${source}`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error(`Unable to decode ${source}`));
      element.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const rasterize = (
  image: CanvasImageSource,
  maxWidth: number,
  maxHeight: number,
): RasterImage => {
  const sourceWidth =
    image instanceof HTMLImageElement
      ? image.naturalWidth || image.width
      : image instanceof SVGImageElement
        ? image.width.baseVal.value || maxWidth
        : maxWidth;
  const sourceHeight =
    image instanceof HTMLImageElement
      ? image.naturalHeight || image.height
      : image instanceof SVGImageElement
        ? image.height.baseVal.value || maxHeight
        : maxHeight;
  const scale = Math.min(
    1,
    maxWidth / Math.max(sourceWidth, 1),
    maxHeight / Math.max(sourceHeight, 1),
  );
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas non disponibile");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const rgba = context.getImageData(0, 0, width, height).data;
  const rgb = new Uint8Array(width * height * 3);
  for (let index = 0, target = 0; index < rgba.length; index += 4) {
    rgb[target++] = rgba[index] ?? 255;
    rgb[target++] = rgba[index + 1] ?? 255;
    rgb[target++] = rgba[index + 2] ?? 255;
  }
  return { width, height, data: rgb };
};

const loadLogoAssets = async () => {
  const assets: {
    aief: RasterImage | null;
    bicocca: RasterImage | null;
    whattadata: RasterImage | null;
  } = {
    aief: null,
    bicocca: null,
    whattadata: null,
  };
  try {
    assets.aief = rasterize(
      await loadImage("/logo-aief-official.png"),
      520,
      220,
    );
  } catch {
    assets.aief = null;
  }

  try {
    assets.whattadata = rasterize(
      await loadImage("/whattadata-logo.png"),
      120,
      120,
    );
  } catch {
    assets.whattadata = null;
  }

  try {
    const svg = document.querySelector("#dashboard-report-bicocca-logo svg");
    if (svg) {
      const serialized = new XMLSerializer().serializeToString(svg);
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () =>
          reject(new Error("Unable to decode Bicocca logo"));
        element.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
      });
      assets.bicocca = rasterize(image, 300, 150);
    }
  } catch {
    assets.bicocca = null;
  }
  return assets;
};

const formatPeriodLabel = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth()
  ) {
    const label = start.toLocaleDateString("it-IT", {
      month: "long",
      year: "numeric",
    });
    return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
  }
  return formatDateRange(startDate, endDate);
};

export async function generateDashboardReport({
  statistics,
  rows,
  startDate,
  endDate,
}: {
  statistics: DashboardReportStatistics;
  rows: DashboardReportRow[];
  startDate: string;
  endDate: string;
}) {
  const builder = new PdfBuilder();
  const logoAssets = await loadLogoAssets();
  const periodLabel = formatPeriodLabel(startDate, endDate);
  const positiveRows = rows.filter((row) => row.feedback === "positivo");
  const negativeRows = rows.filter((row) => row.feedback === "negativo");
  const noteOnlyRows = rows.filter((row) => row.note?.trim() && !row.feedback);
  const notedRows = rows.filter((row) => row.note?.trim());

  const cover = builder.createPage();
  drawReportHeader(
    cover,
    "Utilizzo e feedback",
    periodLabel,
    "",
    logoAssets.aief ? builder.addImage(logoAssets.aief) : null,
  );
  const cardWidth = (CONTENT_WIDTH - 12) / 2;
  drawKpiCard(
    cover,
    MARGIN,
    565,
    cardWidth,
    78,
    "Visitatori piattaforma",
    formatInteger(statistics.totalChats),
    `${formatInteger(statistics.uniqueUsers)} utenti unici`,
    COLORS.cyan,
  );
  drawKpiCard(
    cover,
    MARGIN + cardWidth + 12,
    565,
    cardWidth,
    78,
    "Conversazioni attive",
    formatInteger(statistics.chatsWithUserMessages),
    "Chat con almeno una domanda",
    COLORS.green,
  );
  drawKpiCard(
    cover,
    MARGIN,
    477,
    cardWidth,
    78,
    "Domande ricevute",
    formatInteger(statistics.totalMessages),
    "Nel periodo analizzato",
    COLORS.green,
  );
  drawKpiCard(
    cover,
    MARGIN + cardWidth + 12,
    477,
    cardWidth,
    78,
    "Feedback positivi",
    `${formatInteger(statistics.feedbackStats.upvotes)} su ${formatInteger(statistics.feedbackStats.totalVotes)}`,
    `${statistics.feedbackStats.positiveRate}% delle valutazioni raccolte`,
    COLORS.cyan,
  );
  drawSummaryCard(
    cover,
    MARGIN,
    373,
    CONTENT_WIDTH,
    86,
    "Il mese in breve",
    `${formatInteger(statistics.chatsWithUserMessages)} conversazioni e ${formatInteger(statistics.totalMessages)} domande ricevute. ${formatInteger(statistics.feedbackStats.upvotes)} delle ${formatInteger(statistics.feedbackStats.totalVotes)} valutazioni raccolte sono positive.`,
    "Le valutazioni descrivono le sole risposte valutate.",
  );
  drawSectionTitle(cover, "Altri indicatori", 344);
  drawKpiCard(
    cover,
    MARGIN,
    249,
    cardWidth,
    78,
    "Richieste di appuntamento",
    formatInteger(statistics.totalAppointments),
    "Richieste nel periodo analizzato",
    COLORS.blue,
  );
  drawKpiCard(
    cover,
    MARGIN + cardWidth + 12,
    249,
    cardWidth,
    78,
    "Note qualitative",
    formatInteger(notedRows.length),
    "Risposte con una nota nel periodo",
    COLORS.amber,
  );
  drawSectionTitle(cover, "Come leggere i dati", 217);
  drawWrappedText(
    cover,
    "Le valutazioni esprimono il feedback degli utenti sulle risposte di AIDA e non rappresentano il totale delle conversazioni.",
    MARGIN,
    196,
    CONTENT_WIDTH,
    8.2,
    COLORS.muted,
    2,
  );

  const trends = builder.createPage();
  drawReportHeader(
    trends,
    "Andamento dell'utilizzo",
    periodLabel,
    "Volumi e distribuzione delle interazioni.",
    logoAssets.aief ? builder.addImage(logoAssets.aief) : null,
  );
  drawKpiCard(
    trends,
    MARGIN,
    565,
    cardWidth,
    78,
    "Domande ricevute",
    formatInteger(statistics.totalMessages),
    "Messaggi inviati dagli utenti",
    COLORS.cyan,
  );
  drawKpiCard(
    trends,
    MARGIN + cardWidth + 12,
    565,
    cardWidth,
    78,
    "Conversazioni attive",
    formatInteger(statistics.chatsWithUserMessages),
    "Chat con almeno una domanda",
    COLORS.green,
  );
  drawChartCard(
    trends,
    MARGIN,
    380,
    CONTENT_WIDTH,
    165,
    "Domande nel tempo",
    "Serie giornaliera dal periodo selezionato",
    toSeries(statistics.messagesByDay),
    COLORS.blue,
    "line",
  );
  drawChartCard(
    trends,
    MARGIN,
    195,
    CONTENT_WIDTH,
    165,
    "Conversazioni attive nel tempo",
    "Chat aggiornate per giorno",
    toSeries(statistics.chatsByDay),
    COLORS.cyan,
    "line",
  );
  drawSummaryCard(
    trends,
    MARGIN,
    108,
    CONTENT_WIDTH,
    64,
    "Lettura del periodo",
    `${formatInteger(statistics.totalMessages)} domande ricevute in ${formatInteger(statistics.chatsWithUserMessages)} conversazioni con almeno una domanda.`,
  );
  drawMetricRow(
    trends,
    "Richieste di appuntamento",
    formatInteger(statistics.totalAppointments),
    84,
  );
  const appointmentAreas = statistics.appointmentsByArea
    .filter((item) => Number(item.count) > 0)
    .map(
      (item) =>
        `${areaNameMap[item.area] ?? item.area}: ${formatInteger(item.count)}`,
    )
    .join("  |  ");
  if (appointmentAreas) {
    drawText(
      trends,
      `Aree: ${truncate(appointmentAreas, 100)}`,
      MARGIN,
      61,
      6.5,
      COLORS.muted,
    );
  }

  const feedback = builder.createPage();
  const selectedRows = [
    ...positiveRows.slice(0, 2),
    ...negativeRows.slice(0, 1),
  ];
  if (selectedRows.length < 3) {
    selectedRows.push(
      ...noteOnlyRows
        .filter((row) => !selectedRows.includes(row))
        .slice(0, 3 - selectedRows.length),
    );
  }

  const improvementBody =
    negativeRows.length > 0
      ? "Usare i feedback negativi e le note per rendere le risposte piu concrete e orientate all'azione."
      : "Continuare a raccogliere feedback per individuare con precisione le aree di miglioramento.";
  const selectedContents = selectedRows.flatMap((row) =>
    splitSelectedFeedbackRow(row, CONTENT_WIDTH),
  );
  if (selectedRows.length === 0) {
    drawSelectedFeedbackPage(
      feedback,
      null,
      true,
      true,
      statistics,
      periodLabel,
      logoAssets.aief ? builder.addImage(logoAssets.aief) : null,
      improvementBody,
    );
    drawText(
      feedback,
      "Nessuna valutazione o nota disponibile nel periodo selezionato.",
      MARGIN + 16,
      470,
      8.5,
      COLORS.muted,
    );
  } else {
    selectedContents.forEach((content, index) => {
      const selectedPage = index === 0 ? feedback : builder.createPage();
      drawSelectedFeedbackPage(
        selectedPage,
        content,
        index === 0,
        index === selectedContents.length - 1,
        statistics,
        periodLabel,
        logoAssets.aief ? builder.addImage(logoAssets.aief) : null,
        improvementBody,
      );
    });
  }

  const selectedIds = new Set(selectedRows.map((row) => row.answerMessageId));
  const remainingRows = rows.filter(
    (row) => !selectedIds.has(row.answerMessageId),
  );
  drawFeedbackPages(
    builder,
    "Appendice - feedback positivi",
    periodLabel,
    "Tutte le risposte valutate positivamente oltre agli esempi selezionati",
    remainingRows.filter((row) => row.feedback === "positivo"),
    COLORS.green,
    "VALUTAZIONE POSITIVA",
    logoAssets.aief,
  );
  drawFeedbackPages(
    builder,
    "Appendice - feedback negativi",
    periodLabel,
    "Tutte le evidenze negative oltre agli esempi selezionati",
    remainingRows.filter((row) => row.feedback === "negativo"),
    COLORS.red,
    "VALUTAZIONE NEGATIVA",
    logoAssets.aief,
  );
  drawFeedbackPages(
    builder,
    "Appendice - note qualitative",
    periodLabel,
    "Tutte le risposte accompagnate da note oltre agli esempi selezionati",
    remainingRows.filter((row) => row.note?.trim() && !row.feedback),
    COLORS.amber,
    "NOTA QUALITATIVA",
    logoAssets.aief,
  );

  builder.pages.forEach((page, index) =>
    drawFooter(
      builder,
      page,
      index + 1,
      builder.pages.length,
      logoAssets.bicocca,
      logoAssets.whattadata,
    ),
  );
  return builder.save();
}
