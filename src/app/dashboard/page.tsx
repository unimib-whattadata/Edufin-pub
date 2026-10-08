"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import Image from "next/image";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "~/app/_components/ui/button";
import { Label } from "~/app/_components/ui/label";
import {
  BarChart3,
  Download,
  FileDown,
  MessageSquare,
  Moon,
  Sun,
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "~/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { LogoOfficial } from "~/app/_components/logo-aief";
import { LogoBicocca } from "~/app/_components/logo-bicocca";
import { MarkdownRenderer } from "~/app/_components/ui/markdown-renderer";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { env } from "~/env";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import {
  generateDashboardReport,
  type DashboardReportRow,
  type DashboardReportStatistics,
} from "~/lib/dashboard-report";

const AUTH_KEY = "dashboard_authenticated";
const IS_DASHBOARD_ENABLED = true;
type ChatSortOrder = "asc" | "desc";
type ChatSortBy = "lastUpdate" | "messageCount";
type DashboardTab = "statistics" | "chats";
type DashboardMetricTone = "green" | "neutral" | "red";

type DashboardMetricCardProps = {
  label: string;
  value: string;
  tone: DashboardMetricTone;
};

const dashboardMetricTones: Record<
  DashboardMetricTone,
  { card: string; value: string }
> = {
  green: {
    card: "border-green-200 bg-green-50/60 dark:border-green-900 dark:bg-green-950/20",
    value: "text-green-800 dark:text-green-300",
  },
  neutral: {
    card: "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900",
    value: "text-gray-900 dark:text-white",
  },
  red: {
    card: "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20",
    value: "text-red-800 dark:text-red-300",
  },
};

function DashboardMetricCard({ label, value, tone }: DashboardMetricCardProps) {
  const colors = dashboardMetricTones[tone];

  return (
    <Card
      role="listitem"
      className={cn("gap-0 overflow-hidden py-0 shadow-none", colors.card)}
    >
      <CardContent className="flex min-h-32 flex-col justify-between gap-5 p-4 sm:min-h-36 sm:p-5">
        <h3 className="max-w-[24ch] text-sm leading-snug font-medium text-gray-600 md:text-base dark:text-gray-300">
          {label}
        </h3>
        <p
          className={cn(
            "text-3xl leading-none font-semibold tracking-tight tabular-nums md:text-4xl",
            colors.value,
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

type QuestionAnswerExportRow = {
  chatId: number;
  answerMessageId: number;
  questionText: string;
  answerText: string;
  feedback: string | null;
  note: string | null;
  questionTime: Date;
  answerTime: Date;
  feedbackTime: Date | null;
};

const cleanCsvText = (value: string | null | undefined) =>
  (value ?? "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/[*_~`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const csvCell = (value: string | number) =>
  `"${String(value).replace(/"/g, '""')}"`;

const formatExportDate = (value: Date | null) =>
  value ? new Date(value).toISOString() : "";

const formatDateInput = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildQuestionAnswerCsv = (rows: QuestionAnswerExportRow[]) => {
  const headers = [
    "chat_id",
    "message_id_risposta",
    "domanda",
    "risposta",
    "feedback",
    "nota",
    "data_domanda",
    "data_risposta",
    "data_feedback",
  ];

  const values = rows.map((row) => [
    row.chatId,
    row.answerMessageId,
    cleanCsvText(row.questionText),
    cleanCsvText(row.answerText),
    cleanCsvText(row.feedback),
    cleanCsvText(row.note),
    formatExportDate(row.questionTime),
    formatExportDate(row.answerTime),
    formatExportDate(row.feedbackTime),
  ]);

  return `\uFEFF${[headers, ...values]
    .map((line) => line.map((value) => csvCell(value)).join(";"))
    .join("\r\n")}\r\n`;
};

export default function DashboardPage() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const currentTheme = resolvedTheme ?? theme ?? "light";
  const isDarkTheme = currentTheme === "dark";
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [draftStartDate, setDraftStartDate] = useState<string>("");
  const [draftEndDate, setDraftEndDate] = useState<string>("");
  const [dateRangeError, setDateRangeError] = useState<string>("");
  const [activeTab, setActiveTab] = useState<DashboardTab>("statistics");
  const [chatSortBy, setChatSortBy] = useState<ChatSortBy>("lastUpdate");
  const [chatSortOrder, setChatSortOrder] = useState<ChatSortOrder>("desc");
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [focusNegativeFeedback, setFocusNegativeFeedback] = useState(false);

  // Calcola le date di default (ultimi 30 giorni)
  useEffect(() => {
    if (isAuthenticated) {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 29);
      const nextStartDate = formatDateInput(start);
      const nextEndDate = formatDateInput(end);
      setStartDate(nextStartDate);
      setEndDate(nextEndDate);
      setDraftStartDate(nextStartDate);
      setDraftEndDate(nextEndDate);
    }
  }, [isAuthenticated]);

  const applyDateRange = (days: number) => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - days + 1);
    const nextStartDate = formatDateInput(start);
    const nextEndDate = formatDateInput(end);
    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
    setDraftStartDate(nextStartDate);
    setDraftEndDate(nextEndDate);
    setDateRangeError("");
  };

  const hasUnappliedDateChanges =
    draftStartDate !== startDate || draftEndDate !== endDate;
  const isDraftDateRangeValid =
    Boolean(draftStartDate && draftEndDate) && draftStartDate <= draftEndDate;

  const applyDraftDateRange = () => {
    if (!draftStartDate || !draftEndDate) {
      setDateRangeError("Seleziona una data di inizio e una data di fine.");
      return;
    }

    if (draftStartDate > draftEndDate) {
      setDateRangeError("La data di inizio deve precedere quella di fine.");
      return;
    }

    setStartDate(draftStartDate);
    setEndDate(draftEndDate);
    setDateRangeError("");
  };

  // Crea le date in modo corretto per il backend
  const getDateFromString = (dateString: string): Date => {
    // Crea la data nel fuso orario locale
    const parts = dateString.split("-").map(Number);
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    if (year === undefined || month === undefined || day === undefined) {
      throw new Error("Invalid date format");
    }
    return new Date(year, month - 1, day);
  };

  const parsedStartDate = startDate ? getDateFromString(startDate) : undefined;
  const parsedEndDate = endDate ? getDateFromString(endDate) : undefined;
  const hasDateFilters = Boolean(startDate && endDate);

  const statistics = api.dashboard.getStatistics.useQuery(
    {
      startDate: parsedStartDate,
      endDate: parsedEndDate,
    },
    {
      enabled: isAuthenticated && hasDateFilters,
    },
  );

  const chatsList = api.dashboard.getChatsList.useQuery(
    {
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      sortBy: chatSortBy,
      sortOrder: chatSortOrder,
      excludeZeroUserChats: true,
    },
    {
      enabled: isAuthenticated && hasDateFilters,
    },
  );

  const chatDetail = api.dashboard.getChatDetail.useQuery(
    {
      chatId: selectedChatId ?? -1,
    },
    {
      enabled:
        isAuthenticated &&
        selectedChatId !== null &&
        (chatsList.data?.some((chat) => chat.chatId === selectedChatId) ??
          false),
    },
  );

  const negativeFeedbackMessages =
    api.dashboard.getNegativeFeedbackMessages.useQuery(
      {
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        limit: 50,
      },
      {
        enabled: isAuthenticated && hasDateFilters && activeTab === "chats",
      },
    );

  const positiveFeedbackMessages =
    api.dashboard.getPositiveFeedbackMessages.useQuery(
      {
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        limit: 50,
      },
      {
        enabled: isAuthenticated && hasDateFilters && activeTab === "chats",
      },
    );

  useEffect(() => {
    if (activeTab !== "chats" || !focusNegativeFeedback) return;

    setFocusNegativeFeedback(false);
    window.requestAnimationFrame(() => {
      const feedbackSection = document.getElementById(
        "dashboard-negative-feedback",
      );
      feedbackSection?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      feedbackSection?.querySelector<HTMLElement>("h4")?.focus({
        preventScroll: true,
      });
    });
  }, [activeTab, focusNegativeFeedback]);

  const [isExporting, setIsExporting] = useState(false);

  const questionAnswerExport = api.dashboard.exportQuestionAnswers.useQuery(
    {},
    {
      enabled: false,
    },
  );

  const reportQuestionAnswerExport =
    api.dashboard.exportQuestionAnswers.useQuery(
      {
        startDate: parsedStartDate,
        endDate: parsedEndDate,
      },
      {
        enabled: false,
      },
    );

  const handleExportQuestionAnswers = async () => {
    setIsExporting(true);
    try {
      const result = await questionAnswerExport.refetch();
      const rows = (result.data ?? []) as QuestionAnswerExportRow[];
      if (rows.length === 0) {
        toast.info("Nessuna domanda e risposta da esportare");
        return;
      }

      const csv = buildQuestionAnswerCsv(rows);
      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8",
      });
      saveAs(blob, "export-domande-risposte-completo.csv");
      toast.success(`Esportate ${rows.length} domande e risposte`);
    } catch {
      toast.error("Esportazione non riuscita");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!statistics.data || !startDate || !endDate) {
      toast.info("Seleziona un intervallo temporale valido");
      return;
    }

    setIsGeneratingReport(true);
    try {
      const result = await reportQuestionAnswerExport.refetch();
      const rows = (result.data ?? []) as DashboardReportRow[];
      const pdfBytes = await generateDashboardReport({
        statistics: statistics.data as DashboardReportStatistics,
        rows,
        startDate,
        endDate,
      });
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      saveAs(blob, `report-aida-${startDate}-${endDate}.pdf`);
      toast.success("Report PDF scaricato");
    } catch (error) {
      console.error("Errore nella generazione del report PDF", error);
      toast.error("Generazione del report non riuscita");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  useEffect(() => {
    if (!chatsList.data) return;

    if (chatsList.data.length === 0) {
      setSelectedChatId(null);
      return;
    }

    const selectedChatStillVisible =
      selectedChatId !== null &&
      chatsList.data.some((chat) => chat.chatId === selectedChatId);

    if (!selectedChatStillVisible) {
      setSelectedChatId(chatsList.data[0]?.chatId ?? null);
    }
  }, [chatsList.data, selectedChatId]);

  useEffect(() => {
    // Verifica se l'utente è già autenticato
    const authStatus = localStorage.getItem(AUTH_KEY);
    if (authStatus === "true") {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password === env.NEXT_PUBLIC_AUTH_KEY_DASHBOARD) {
      localStorage.setItem(AUTH_KEY, "true");
      setIsAuthenticated(true);
      setPassword("");
    } else {
      setError("Password non corretta");
      setPassword("");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
    setPassword("");
    setError("");
  };

  if (!IS_DASHBOARD_ENABLED) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-800">
        <div className="text-gray-700 dark:text-gray-300">
          Dashboard non disponibile
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-800">
        <div className="text-gray-600 dark:text-gray-400">Caricamento...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4 dark:bg-gray-800">
        <div className="w-full max-w-md space-y-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-col items-center space-y-4">
            <div className="flex flex-col items-center justify-center">
              <p className="font-thasadith mb-2 text-lg font-extralight text-gray-600 drop-shadow dark:text-white/80">
                powered by
              </p>
              <div className="flex flex-row items-center justify-center gap-4">
                <LogoOfficial />
                <LogoBicocca theme={isDarkTheme ? "dark" : "light"} />
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Dashboard Protetta
              </h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Inserisci la password per accedere
              </p>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(
                  "flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm",
                  "transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium",
                  "placeholder:text-gray-400 focus-visible:ring-2 focus-visible:outline-none",
                  "focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50",
                  "dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500",
                  error && "border-red-500 focus-visible:ring-red-500",
                )}
                placeholder="Inserisci la password"
                autoFocus
              />
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full">
              Accedi
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Prepara i dati per i grafici

  const messagesChartData: Array<{ date: string; Messaggi: number }> =
    statistics.data?.messagesByDay?.map(
      (item: { date: string; count: number }) => ({
        date: new Date(item.date).toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "2-digit",
        }),
        Messaggi: item.count ?? 0,
      }),
    ) ?? [];

  const chatsChartData: Array<{ date: string; Chat: number }> =
    statistics.data?.chatsByDay?.map(
      (item: { date: string; count: number }) => ({
        date: new Date(item.date).toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "2-digit",
        }),
        Chat: item.count ?? 0,
      }),
    ) ?? [];

  const appointmentsChartData: Array<{ date: string; Appuntamenti: number }> =
    statistics.data?.appointmentsByDay?.map(
      (item: { date: string; count: number }) => ({
        date: new Date(item.date).toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "2-digit",
        }),
        Appuntamenti: item.count ?? 0,
      }),
    ) ?? [];

  // Mappa per abbreviare i nomi delle aree nel grafico
  const areaNameMap: Record<string, string> = {
    PROTEZIONE: "Protezione",
    PREVIDENZA: "Previdenza",
    FISCALITA: "Fiscalità",
    "RISPARMIO/INVESTIMENTI": "Risparmio/Inv.",
    FINANZIAMENTI: "Finanziamenti",
  };

  const appointmentsByAreaData: Array<{ area: string; count: number }> =
    statistics.data?.appointmentsByArea?.map(
      (item: { area: string; count: number }) => ({
        area: areaNameMap[item.area] ?? item.area,
        count: item.count ?? 0,
      }),
    ) ?? [];

  const chartColors = {
    messages: isDarkTheme ? "#60A5FA" : "#2563EB",
    visitors: isDarkTheme ? "#34D399" : "#0891B2",
    appointments: isDarkTheme ? "#FBBF24" : "#D97706",
    bars: isDarkTheme ? "#A78BFA" : "#7C3AED",
  };

  const chartConfig = {
    Messaggi: {
      label: "Messaggi Utente",
      color: chartColors.messages,
    },
    Chat: {
      label: "Visitatori Piattaforma",
      color: chartColors.visitors,
    },
    Appuntamenti: {
      label: "Appuntamenti",
      color: chartColors.appointments,
    },
    count: {
      label: "Appuntamenti",
      color: chartColors.bars,
    },
  };

  const formatDateTime = (value: Date | string) => {
    return new Date(value).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatMetricCount = (value: number | undefined) =>
    statistics.isLoading ? "…" : Number(value ?? 0).toLocaleString("it-IT");

  const totalVotes = statistics.data?.feedbackStats?.totalVotes ?? 0;
  const usageMetrics: DashboardMetricCardProps[] = [
    {
      label: "Chat totali",
      value: formatMetricCount(statistics.data?.totalChats),
      tone: "neutral",
    },
    {
      label: "Chat con almeno una domanda",
      value: formatMetricCount(statistics.data?.chatsWithUserMessages),
      tone: "neutral",
    },
    {
      label: "Domande inviate",
      value: formatMetricCount(statistics.data?.totalMessages),
      tone: "neutral",
    },
    {
      label: "Richieste di appuntamento",
      value: formatMetricCount(statistics.data?.totalAppointments),
      tone: "neutral",
    },
  ];
  const feedbackMetrics: DashboardMetricCardProps[] = [
    {
      label: "Feedback raccolti",
      value: formatMetricCount(statistics.data?.feedbackStats?.totalVotes),
      tone: "neutral",
    },
    {
      label: "Voti positivi",
      value: formatMetricCount(statistics.data?.feedbackStats?.upvotes),
      tone: "green",
    },
    {
      label: "Voti negativi",
      value: formatMetricCount(statistics.data?.feedbackStats?.downvotes),
      tone: "red",
    },
    {
      label: "Tasso positivo",
      value: statistics.isLoading
        ? "…"
        : totalVotes === 0
          ? "—"
          : `${statistics.data?.feedbackStats?.positiveRate ?? 0}%`,
      tone: "green",
    },
  ];
  const hasNegativeFeedback =
    !statistics.isLoading &&
    (statistics.data?.feedbackStats?.downvotes ?? 0) > 0;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-800">
      <div
        id="dashboard-report-bicocca-logo"
        aria-hidden="true"
        className="pointer-events-none fixed top-0 -left-[10000px] h-20 w-40 opacity-0"
      >
        <LogoBicocca theme="light" />
      </div>
      <header className="flex shrink-0 items-center gap-0 rounded-t-none bg-blue-600 px-2 py-2 md:px-2 md:py-3">
        <div className="mr-2 flex h-8 items-center md:h-10">
          <Image
            src="/bot_logo_dark.png"
            alt="Logo"
            width={50}
            height={50}
            className="md:h-[65px] md:w-[65px]"
          />
        </div>
        <div className="flex flex-1 flex-col">
          <span className="truncate text-base font-bold text-white md:text-lg">
            Dashboard
          </span>
          <span className="text-[10px] text-white/90 md:text-xs">
            Area Riservata
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setTheme(isDarkTheme ? "light" : "dark")}
            className="border-white/20 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20 hover:text-white md:px-3 md:py-2 md:text-sm"
            aria-label="Cambia tema"
          >
            {isDarkTheme ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="border-white/20 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20 hover:text-white md:px-4 md:py-2 md:text-sm"
          >
            Esci
          </Button>
        </div>
      </header>
      <div className="px-2 py-4 md:p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <Card className="h-fit py-0">
            <CardHeader className="border-b px-4 py-4">
              <CardTitle className="text-sm text-gray-900 dark:text-white">
                Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-2 py-2">
              <Button
                variant={activeTab === "statistics" ? "default" : "ghost"}
                onClick={() => setActiveTab("statistics")}
                className={cn(
                  "w-full justify-start gap-2",
                  activeTab !== "statistics" &&
                    "text-gray-700 dark:text-gray-200",
                )}
              >
                <BarChart3 className="h-4 w-4" />
                Statistiche
              </Button>
              <Button
                variant={activeTab === "chats" ? "default" : "ghost"}
                onClick={() => setActiveTab("chats")}
                className={cn(
                  "w-full justify-start gap-2",
                  activeTab !== "chats" && "text-gray-700 dark:text-gray-200",
                )}
              >
                <MessageSquare className="h-4 w-4" />
                Chat
              </Button>
            </CardContent>
          </Card>

          <div className="min-w-0">
            {/* Filtri temporali */}
            <div className="mb-4 rounded-lg border border-gray-200 bg-white px-2 py-3 md:mb-6 md:p-4 dark:border-gray-700 dark:bg-gray-900">
              <h3 className="mb-3 text-base font-semibold text-gray-900 md:mb-4 md:text-lg dark:text-white">
                Filtri Temporali
              </h3>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
                <div className="flex-1">
                  <Label htmlFor="startDate">Data Inizio</Label>
                  <input
                    id="startDate"
                    type="date"
                    value={draftStartDate}
                    onChange={(e) => {
                      const nextStartDate = e.target.value;
                      setDraftStartDate(nextStartDate);
                      setDateRangeError(
                        !nextStartDate || !draftEndDate
                          ? "Seleziona entrambe le date."
                          : nextStartDate > draftEndDate
                            ? "La data di inizio deve precedere quella di fine."
                            : "",
                      );
                    }}
                    aria-invalid={Boolean(dateRangeError)}
                    aria-describedby={
                      dateRangeError ? "date-range-error" : undefined
                    }
                    className={cn(
                      "mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm",
                      "transition-colors focus-visible:ring-2 focus-visible:outline-none",
                      "focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50",
                      "dark:border-gray-600 dark:text-white",
                    )}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="endDate">Data Fine</Label>
                  <input
                    id="endDate"
                    type="date"
                    value={draftEndDate}
                    onChange={(e) => {
                      const nextEndDate = e.target.value;
                      setDraftEndDate(nextEndDate);
                      setDateRangeError(
                        !draftStartDate || !nextEndDate
                          ? "Seleziona entrambe le date."
                          : draftStartDate > nextEndDate
                            ? "La data di inizio deve precedere quella di fine."
                            : "",
                      );
                    }}
                    aria-invalid={Boolean(dateRangeError)}
                    aria-describedby={
                      dateRangeError ? "date-range-error" : undefined
                    }
                    className={cn(
                      "mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm",
                      "transition-colors focus-visible:ring-2 focus-visible:outline-none",
                      "focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50",
                      "dark:border-gray-600 dark:text-white",
                    )}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={applyDraftDateRange}
                  disabled={!isDraftDateRangeValid || !hasUnappliedDateChanges}
                  className="h-10 shrink-0"
                >
                  Applica intervallo
                </Button>
                <Button
                  type="button"
                  onClick={handleDownloadReport}
                  disabled={
                    isGeneratingReport ||
                    reportQuestionAnswerExport.isFetching ||
                    statistics.isLoading ||
                    statistics.isFetching ||
                    !hasDateFilters
                  }
                  className="h-10 shrink-0 gap-2 bg-slate-900 px-4 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700"
                  title="Scarica il report PDF del range selezionato"
                >
                  <FileDown className="h-4 w-4" />
                  {isGeneratingReport ? "Generazione..." : "Scarica report PDF"}
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <span className="font-medium">Intervalli rapidi</span>
                {[7, 30, 90].map((days) => (
                  <Button
                    key={days}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => applyDateRange(days)}
                    className="h-8 rounded-full px-3 text-xs text-gray-600 hover:bg-blue-50 hover:text-blue-700 dark:text-gray-300 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
                  >
                    {days === 7 ? "Ultimi 7 giorni" : `Ultimi ${days} giorni`}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => applyDateRange(30)}
                  className="h-8 px-2 text-xs text-gray-500 dark:text-gray-400"
                >
                  Ripristina 30 giorni
                </Button>
              </div>
              {dateRangeError && (
                <p
                  id="date-range-error"
                  role="alert"
                  className="mt-2 text-sm text-red-700 dark:text-red-300"
                >
                  {dateRangeError}
                </p>
              )}
              <p
                role="status"
                aria-live="polite"
                className="text-xs text-gray-600 dark:text-gray-400"
              >
                {hasUnappliedDateChanges
                  ? "Hai modificato le date: applica l’intervallo per aggiornare i dati."
                  : statistics.isFetching
                    ? "Aggiornamento dei dati in corso…"
                    : statistics.dataUpdatedAt
                      ? `Dati aggiornati alle ${new Date(statistics.dataUpdatedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}.`
                      : "In attesa di dati per l’intervallo selezionato."}
              </p>
            </div>

            {activeTab === "statistics" && (
              <>
                <section
                  aria-labelledby="dashboard-usage-title"
                  className="mb-7"
                >
                  <h2
                    id="dashboard-usage-title"
                    className="mb-3 text-lg font-semibold text-gray-900 md:text-xl dark:text-white"
                  >
                    Utilizzo
                  </h2>
                  <div
                    role="list"
                    aria-label="Statistiche di utilizzo"
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4"
                  >
                    {usageMetrics.map((metric) => (
                      <DashboardMetricCard key={metric.label} {...metric} />
                    ))}
                  </div>
                </section>

                <section
                  aria-labelledby="dashboard-feedback-title"
                  className="mb-6"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h2
                      id="dashboard-feedback-title"
                      className="text-lg font-semibold text-gray-900 md:text-xl dark:text-white"
                    >
                      Feedback
                    </h2>
                    {hasNegativeFeedback && (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 shrink-0"
                        onClick={() => {
                          setFocusNegativeFeedback(true);
                          setActiveTab("chats");
                        }}
                      >
                        Esamina i voti negativi
                      </Button>
                    )}
                  </div>
                  <div
                    role="list"
                    aria-label="Statistiche dei feedback"
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4"
                  >
                    {feedbackMetrics.map((metric) => (
                      <DashboardMetricCard key={metric.label} {...metric} />
                    ))}
                  </div>
                </section>

                <details className="mb-4">
                  <summary className="flex min-h-11 cursor-pointer items-center rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                    Andamento e distribuzione nel periodo
                  </summary>
                  <div className="mt-4 space-y-4 md:space-y-6">
                    {/* Grafico messaggi utente nel tempo */}
                    <div className="rounded-lg border border-gray-200 bg-white px-2 py-3 md:p-6 dark:border-gray-700 dark:bg-gray-900">
                      <div className="mb-3 flex flex-col gap-2 md:mb-4 md:flex-row md:items-center md:justify-between">
                        <h3 className="text-base font-semibold text-gray-900 md:text-lg dark:text-white">
                          Messaggi Utente nel Tempo
                        </h3>
                        {}
                        {!statistics.isLoading &&
                          messagesChartData.length > 0 && (
                            <div className="flex flex-wrap gap-2 text-xs text-gray-600 md:gap-4 md:text-sm dark:text-gray-400">
                              <div>
                                <span className="font-medium">Totale: </span>
                                <span className="text-gray-900 dark:text-white">
                                  {}
                                  {statistics.data?.totalMessages?.toLocaleString() ??
                                    0}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium">Media: </span>
                                <span className="text-gray-900 dark:text-white">
                                  {messagesChartData.length > 0
                                    ? Math.round(
                                        messagesChartData.reduce(
                                          (acc, item) => acc + item.Messaggi,
                                          0,
                                        ) / messagesChartData.length,
                                      ).toLocaleString()
                                    : 0}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium">Picco: </span>
                                <span className="text-gray-900 dark:text-white">
                                  {messagesChartData.length > 0
                                    ? Math.max(
                                        ...messagesChartData.map(
                                          (item) => item.Messaggi,
                                        ),
                                      ).toLocaleString()
                                    : 0}
                                </span>
                              </div>
                            </div>
                          )}
                      </div>
                      {}
                      {statistics.isLoading ? (
                        <div className="flex h-48 items-center justify-center md:h-64">
                          <p className="text-sm text-gray-600 md:text-base dark:text-gray-400">
                            Caricamento...
                          </p>
                        </div>
                      ) : messagesChartData.length > 0 ? (
                        <ChartContainer
                          config={chartConfig}
                          className="h-48 w-full md:h-64"
                        >
                          <AreaChart data={messagesChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Area
                              type="monotone"
                              dataKey="Messaggi"
                              stroke={chartColors.messages}
                              fill={chartColors.messages}
                              fillOpacity={isDarkTheme ? 0.35 : 0.2}
                            />
                          </AreaChart>
                        </ChartContainer>
                      ) : (
                        <div className="flex h-48 items-center justify-center md:h-64">
                          <p className="text-sm text-gray-600 md:text-base dark:text-gray-400">
                            Nessun dato disponibile per il periodo selezionato
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Grafico visitatori piattaforma nel tempo */}
                    <div className="rounded-lg border border-gray-200 bg-white px-2 py-3 md:p-6 dark:border-gray-700 dark:bg-gray-900">
                      <div className="mb-3 flex flex-col gap-2 md:mb-4 md:flex-row md:items-center md:justify-between">
                        <h3 className="text-base font-semibold text-gray-900 md:text-lg dark:text-white">
                          Visitatori Piattaforma
                        </h3>
                        {}
                        {!statistics.isLoading && chatsChartData.length > 0 && (
                          <div className="flex flex-wrap gap-2 text-xs text-gray-600 md:gap-4 md:text-sm dark:text-gray-400">
                            <div>
                              <span className="font-medium">Totale: </span>
                              <span className="text-gray-900 dark:text-white">
                                {}
                                {statistics.data?.totalChats?.toLocaleString() ??
                                  0}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium">Media: </span>
                              <span className="text-gray-900 dark:text-white">
                                {chatsChartData.length > 0
                                  ? Math.round(
                                      chatsChartData.reduce(
                                        (acc, item) => acc + item.Chat,
                                        0,
                                      ) / chatsChartData.length,
                                    ).toLocaleString()
                                  : 0}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium">Picco: </span>
                              <span className="text-gray-900 dark:text-white">
                                {chatsChartData.length > 0
                                  ? Math.max(
                                      ...chatsChartData.map(
                                        (item) => item.Chat,
                                      ),
                                    ).toLocaleString()
                                  : 0}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      {}
                      {statistics.isLoading ? (
                        <div className="flex h-48 items-center justify-center md:h-64">
                          <p className="text-sm text-gray-600 md:text-base dark:text-gray-400">
                            Caricamento...
                          </p>
                        </div>
                      ) : chatsChartData.length > 0 ? (
                        <ChartContainer
                          config={chartConfig}
                          className="h-48 w-full md:h-64"
                        >
                          <AreaChart data={chatsChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Area
                              type="monotone"
                              dataKey="Chat"
                              stroke={chartColors.visitors}
                              fill={chartColors.visitors}
                              fillOpacity={isDarkTheme ? 0.35 : 0.2}
                            />
                          </AreaChart>
                        </ChartContainer>
                      ) : (
                        <div className="flex h-48 items-center justify-center md:h-64">
                          <p className="text-sm text-gray-600 md:text-base dark:text-gray-400">
                            Nessun dato disponibile per il periodo selezionato
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Sezione Appuntamenti */}
                    <div className="mt-6 rounded-lg border-2 border-green-200 bg-green-50/50 p-4 dark:border-green-700 dark:bg-green-900/10">
                      <h2 className="mb-4 text-lg font-bold text-green-700 md:text-xl dark:text-green-400">
                        Statistiche Appuntamenti
                      </h2>

                      {/* Grafico appuntamenti per area */}
                      <div className="mb-4 rounded-lg border border-gray-200 bg-white px-2 py-3 md:p-6 dark:border-gray-700 dark:bg-gray-900">
                        <div className="mb-3 flex flex-col gap-2 md:mb-4 md:flex-row md:items-center md:justify-between">
                          <h3 className="text-base font-semibold text-gray-900 md:text-lg dark:text-white">
                            Appuntamenti per Area
                          </h3>
                          {!statistics.isLoading &&
                            appointmentsByAreaData.length > 0 && (
                              <div className="flex flex-wrap gap-2 text-xs text-gray-600 md:gap-4 md:text-sm dark:text-gray-400">
                                <div>
                                  <span className="font-medium">Totale: </span>
                                  <span className="text-gray-900 dark:text-white">
                                    {statistics.data?.totalAppointments?.toLocaleString() ??
                                      0}
                                  </span>
                                </div>
                              </div>
                            )}
                        </div>
                        {statistics.isLoading ? (
                          <div className="flex h-48 items-center justify-center md:h-64">
                            <p className="text-sm text-gray-600 md:text-base dark:text-gray-400">
                              Caricamento...
                            </p>
                          </div>
                        ) : appointmentsByAreaData.length > 0 ? (
                          <ChartContainer
                            config={chartConfig}
                            className="h-48 w-full md:h-64"
                          >
                            <BarChart data={appointmentsByAreaData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                dataKey="area"
                                tick={{ fontSize: 11 }}
                                interval={0}
                                angle={-20}
                                textAnchor="end"
                                height={60}
                              />
                              <YAxis allowDecimals={false} />
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Bar
                                dataKey="count"
                                fill={chartColors.bars}
                                radius={[4, 4, 0, 0]}
                              />
                            </BarChart>
                          </ChartContainer>
                        ) : (
                          <div className="flex h-48 items-center justify-center md:h-64">
                            <p className="text-sm text-gray-600 md:text-base dark:text-gray-400">
                              Nessun appuntamento registrato per il periodo
                              selezionato
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Grafico appuntamenti nel tempo */}
                      <div className="rounded-lg border border-gray-200 bg-white px-2 py-3 md:p-6 dark:border-gray-700 dark:bg-gray-900">
                        <div className="mb-3 flex flex-col gap-2 md:mb-4 md:flex-row md:items-center md:justify-between">
                          <h3 className="text-base font-semibold text-gray-900 md:text-lg dark:text-white">
                            Appuntamenti nel Tempo
                          </h3>
                          {!statistics.isLoading &&
                            appointmentsChartData.length > 0 && (
                              <div className="flex flex-wrap gap-2 text-xs text-gray-600 md:gap-4 md:text-sm dark:text-gray-400">
                                <div>
                                  <span className="font-medium">Totale: </span>
                                  <span className="text-gray-900 dark:text-white">
                                    {statistics.data?.totalAppointments?.toLocaleString() ??
                                      0}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-medium">Media: </span>
                                  <span className="text-gray-900 dark:text-white">
                                    {appointmentsChartData.length > 0
                                      ? Math.round(
                                          appointmentsChartData.reduce(
                                            (acc, item) =>
                                              acc + item.Appuntamenti,
                                            0,
                                          ) / appointmentsChartData.length,
                                        ).toLocaleString()
                                      : 0}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-medium">Picco: </span>
                                  <span className="text-gray-900 dark:text-white">
                                    {appointmentsChartData.length > 0
                                      ? Math.max(
                                          ...appointmentsChartData.map(
                                            (item) => item.Appuntamenti,
                                          ),
                                        ).toLocaleString()
                                      : 0}
                                  </span>
                                </div>
                              </div>
                            )}
                        </div>
                        {statistics.isLoading ? (
                          <div className="flex h-48 items-center justify-center md:h-64">
                            <p className="text-sm text-gray-600 md:text-base dark:text-gray-400">
                              Caricamento...
                            </p>
                          </div>
                        ) : appointmentsChartData.length > 0 ? (
                          <ChartContainer
                            config={chartConfig}
                            className="h-48 w-full md:h-64"
                          >
                            <AreaChart data={appointmentsChartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis allowDecimals={false} />
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Area
                                type="monotone"
                                dataKey="Appuntamenti"
                                stroke={chartColors.appointments}
                                fill={chartColors.appointments}
                                fillOpacity={isDarkTheme ? 0.35 : 0.2}
                              />
                            </AreaChart>
                          </ChartContainer>
                        ) : (
                          <div className="flex h-48 items-center justify-center md:h-64">
                            <p className="text-sm text-gray-600 md:text-base dark:text-gray-400">
                              Nessun appuntamento registrato per il periodo
                              selezionato
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </details>
              </>
            )}

            {activeTab === "chats" && (
              <div className="rounded-lg border border-gray-200 bg-white px-2 py-3 md:p-6 dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 md:text-lg dark:text-white">
                      Chat
                    </h3>
                    <p className="text-xs text-gray-600 md:text-sm dark:text-gray-400">
                      Seleziona una chat per visualizzare tutti i messaggi
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-end">
                    <div className="w-full md:w-72">
                      <Label htmlFor="chatSortSelect">Ordinamento chat</Label>
                      <select
                        id="chatSortSelect"
                        value={`${chatSortBy}:${chatSortOrder}`}
                        onChange={(e) => {
                          const [nextSortBy, nextSortOrder] = e.target.value
                            .split(":")
                            .map((value) => value.trim());
                          setChatSortBy(nextSortBy as ChatSortBy);
                          setChatSortOrder(nextSortOrder as ChatSortOrder);
                        }}
                        className={cn(
                          "mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm",
                          "transition-colors focus-visible:ring-2 focus-visible:outline-none",
                          "focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50",
                          "dark:border-gray-600 dark:text-white",
                        )}
                      >
                        <option value="lastUpdate:desc">
                          Data: più recenti
                        </option>
                        <option value="lastUpdate:asc">
                          Data: meno recenti
                        </option>
                        <option value="messageCount:desc">
                          Messaggi: più messaggi
                        </option>
                        <option value="messageCount:asc">
                          Messaggi: meno messaggi
                        </option>
                      </select>
                    </div>
                    <Button
                      type="button"
                      onClick={handleExportQuestionAnswers}
                      disabled={isExporting || questionAnswerExport.isFetching}
                      className="h-10 shrink-0 gap-2"
                      title="Scarica tutte le domande, risposte, feedback e note in CSV"
                    >
                      <Download className="h-4 w-4" />
                      {isExporting ? "Esportazione..." : "Scarica CSV completo"}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40">
                    <div className="border-b border-gray-200 px-3 py-2 dark:border-gray-700">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Elenco chat
                      </p>
                    </div>
                    <div className="max-h-[460px] overflow-y-auto p-2">
                      {chatsList.isLoading ? (
                        <p className="p-2 text-sm text-gray-600 dark:text-gray-400">
                          Caricamento chat...
                        </p>
                      ) : (chatsList.data?.length ?? 0) > 0 ? (
                        <div className="space-y-2">
                          {chatsList.data?.map((chat) => {
                            const isSelected = selectedChatId === chat.chatId;
                            return (
                              <button
                                key={chat.chatId}
                                type="button"
                                onClick={() => setSelectedChatId(chat.chatId)}
                                className={cn(
                                  "w-full rounded-md border px-3 py-2 text-left transition-colors",
                                  isSelected
                                    ? "border-blue-300 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/30"
                                    : "border-gray-200 bg-white hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800",
                                )}
                              >
                                <div className="mb-1 flex items-start justify-between gap-2">
                                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                    Chat #{chat.chatId}
                                  </span>
                                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                                    {chat.userMessageCount}{" "}
                                    {chat.userMessageCount === 1
                                      ? "domanda utente"
                                      : "domande utente"}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  Modifica: {formatDateTime(chat.lastUpdate)}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="p-2 text-sm text-gray-600 dark:text-gray-400">
                          Nessuna chat nel range selezionato
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40">
                    <div className="border-b border-gray-200 px-3 py-2 dark:border-gray-700">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {selectedChatId !== null
                          ? `Dettaglio chat #${selectedChatId}`
                          : "Dettaglio chat"}
                      </p>
                    </div>
                    <div className="max-h-[460px] overflow-y-auto p-3">
                      {selectedChatId === null ? (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Seleziona una chat dall&apos;elenco
                        </p>
                      ) : chatDetail.isLoading ? (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Caricamento messaggi...
                        </p>
                      ) : chatDetail.isError ? (
                        <p className="text-sm text-red-600 dark:text-red-400">
                          Errore nel caricamento della chat
                        </p>
                      ) : (chatDetail.data?.messages.length ?? 0) > 0 ? (
                        <div className="space-y-3">
                          {chatDetail.data?.messages.map((message) => (
                            <div
                              key={message.messageId}
                              className={cn(
                                "max-w-[90%] rounded-md border px-3 py-2",
                                message.sender === "user"
                                  ? "ml-auto border-blue-300 bg-blue-600 text-white dark:border-blue-500"
                                  : "border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100",
                              )}
                            >
                              <div
                                className={cn(
                                  "mb-1 text-[11px] font-semibold tracking-wide uppercase",
                                  message.sender === "user"
                                    ? "text-blue-100"
                                    : "text-gray-500 dark:text-gray-400",
                                )}
                              >
                                {message.sender === "user" ? "Utente" : "AIDA"}
                              </div>
                              {message.sender === "user" ? (
                                <p className="text-sm break-words whitespace-pre-wrap">
                                  {message.text}
                                </p>
                              ) : (
                                <MarkdownRenderer
                                  content={message.text}
                                  className="prose-p:my-0 prose-p:text-sm"
                                />
                              )}
                              <div
                                className={cn(
                                  "mt-2 text-[11px]",
                                  message.sender === "user"
                                    ? "text-blue-100"
                                    : "text-gray-500 dark:text-gray-400",
                                )}
                              >
                                {formatDateTime(message.time)}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Nessun messaggio disponibile
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <section
                  id="dashboard-negative-feedback"
                  className="mt-4 scroll-mt-4 rounded-lg border border-red-200 bg-red-50/30 px-3 py-3 md:p-4 dark:border-red-700 dark:bg-red-900/10"
                >
                  <div className="mb-3">
                    <h4
                      tabIndex={-1}
                      className="text-sm font-semibold text-red-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none md:text-base dark:text-red-300"
                    >
                      Messaggi con feedback negativo
                    </h4>
                    <p className="text-xs text-red-700/80 md:text-sm dark:text-red-300/80">
                      Elenco di domanda e risposta per i messaggi valutati
                      negativamente
                    </p>
                  </div>

                  <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                    {negativeFeedbackMessages.isLoading ? (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Caricamento feedback negativi...
                      </p>
                    ) : negativeFeedbackMessages.isError ? (
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Errore nel caricamento dei feedback negativi
                      </p>
                    ) : (negativeFeedbackMessages.data?.length ?? 0) > 0 ? (
                      negativeFeedbackMessages.data?.map((item) => (
                        <div
                          key={item.messageId}
                          className="rounded-md border border-red-200 bg-white p-3 dark:border-red-800 dark:bg-gray-900"
                        >
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-400">
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              Chat #{item.chatId}
                            </span>
                            <span>{formatDateTime(item.voteTime)}</span>
                          </div>
                          <div className="mb-2">
                            <p className="mb-1 text-[11px] font-semibold tracking-wide text-blue-700 uppercase dark:text-blue-300">
                              Domanda utente
                            </p>
                            <p className="text-sm whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                              {item.questionText ?? "Domanda non disponibile"}
                            </p>
                          </div>
                          <div>
                            <p className="mb-1 text-[11px] font-semibold tracking-wide text-red-700 uppercase dark:text-red-300">
                              Risposta AIDA
                            </p>
                            <MarkdownRenderer
                              content={item.answerText}
                              className="prose-p:my-0 prose-p:text-sm"
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Nessun feedback negativo nel range selezionato
                      </p>
                    )}
                  </div>
                </section>

                <div className="mt-4 rounded-lg border border-green-200 bg-green-50/30 px-3 py-3 md:p-4 dark:border-green-700 dark:bg-green-900/10">
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold text-green-700 md:text-base dark:text-green-300">
                      Messaggi con feedback positivo
                    </h4>
                    <p className="text-xs text-green-700/80 md:text-sm dark:text-green-300/80">
                      Elenco di domanda e risposta per i messaggi valutati
                      positivamente
                    </p>
                  </div>

                  <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                    {positiveFeedbackMessages.isLoading ? (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Caricamento feedback positivi...
                      </p>
                    ) : positiveFeedbackMessages.isError ? (
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Errore nel caricamento dei feedback positivi
                      </p>
                    ) : (positiveFeedbackMessages.data?.length ?? 0) > 0 ? (
                      positiveFeedbackMessages.data?.map((item) => (
                        <div
                          key={item.messageId}
                          className="rounded-md border border-green-200 bg-white p-3 dark:border-green-800 dark:bg-gray-900"
                        >
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-400">
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              Chat #{item.chatId}
                            </span>
                            <span>{formatDateTime(item.voteTime)}</span>
                          </div>
                          <div className="mb-2">
                            <p className="mb-1 text-[11px] font-semibold tracking-wide text-blue-700 uppercase dark:text-blue-300">
                              Domanda utente
                            </p>
                            <p className="text-sm whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                              {item.questionText ?? "Domanda non disponibile"}
                            </p>
                          </div>
                          <div>
                            <p className="mb-1 text-[11px] font-semibold tracking-wide text-green-700 uppercase dark:text-green-300">
                              Risposta AIDA
                            </p>
                            <MarkdownRenderer
                              content={item.answerText}
                              className="prose-p:my-0 prose-p:text-sm"
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Nessun feedback positivo nel range selezionato
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
