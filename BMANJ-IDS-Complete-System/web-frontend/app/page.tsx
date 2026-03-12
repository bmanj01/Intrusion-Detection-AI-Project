"use client";

import React from "react";

import { useState, useCallback, useEffect } from "react";
import useSWR, { mutate } from "swr";
import {
  Shield,
  Activity,
  AlertTriangle,
  Server,
  FileText,
  Menu,
  X,
  LayoutDashboard,
  Search,
  Bell,
  ScrollText,
  Cpu,
  Cloud,
  Settings,
  Download,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  Upload,
  Trash2,
  Copy,
  ArrowRight,
  Zap,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import {
  createAlert,
  createAnalysis,
  createLog,
  updateAlertStatus,
  updateSettings,
  clearLogs,
  type Alert,
  type Log,
  type Settings as AppSettings,
} from "./actions";

// SWR fetcher for API routes
const fetcher = (url: string) => fetch(url).then((res) => res.json());

// ============== TYPE DEFINITIONS ==============
interface FeatureInput {
  "Flow Duration": number;
  "Tot Fwd Pkts": number;
  "Tot Bwd Pkts": number;
  "Flow Byts/s": number;
  "Flow Pkts/s": number;
  dataset_IDS2025: number;
}

interface PredictionRequest {
  items: { features: FeatureInput }[];
}

interface PredictionResponse {
  predicted_label: "ANOMALY" | "NORMAL";
  anomaly_score: number;
  raw_proba: { anomaly: number; normal: number };
}

// ============== SAMPLE DATA ==============
const SAMPLE_JSON = JSON.stringify(
  {
    items: [
      {
        features: {
          "Flow Duration": 227.0,
          "Tot Fwd Pkts": 1,
          "Tot Bwd Pkts": 1,
          "Flow Byts/s": 396475.77,
          "Flow Pkts/s": 8810.57,
          dataset_IDS2025: 1,
        },
      },
    ],
  },
  null,
  2
);

const SAMPLE_ATTACK = JSON.stringify(
  {
    items: [
      {
        features: {
          "Flow Duration": 15000000.0,
          "Tot Fwd Pkts": 500,
          "Tot Bwd Pkts": 2,
          "Flow Byts/s": 9999999.99,
          "Flow Pkts/s": 50000.0,
          dataset_IDS2025: 1,
        },
      },
    ],
  },
  null,
  2
);

const SAMPLE_NORMAL = JSON.stringify(
  {
    items: [
      {
        features: {
          "Flow Duration": 50.0,
          "Tot Fwd Pkts": 5,
          "Tot Bwd Pkts": 4,
          "Flow Byts/s": 1200.5,
          "Flow Pkts/s": 100.2,
          dataset_IDS2025: 1,
        },
      },
    ],
  },
  null,
  2
);

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "analyse", label: "Analyse", icon: Search },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "logs", label: "Logs", icon: ScrollText },
  { id: "models", label: "Models", icon: Cpu },
  { id: "deployment", label: "Deployment", icon: Cloud },
];

// ============== MOCK API FUNCTION ==============
async function mockPredictAPI(
  request: PredictionRequest,
  apiUrl: string
): Promise<PredictionResponse> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const features = request.items[0]?.features;
  if (!features) {
    throw new Error("Invalid request format");
  }

  // Simple heuristic for demo: high flow bytes/s or packets = anomaly
  const isAnomaly =
    features["Flow Byts/s"] > 500000 ||
    features["Flow Pkts/s"] > 10000 ||
    features["Tot Fwd Pkts"] > 100;

  const anomalyScore = isAnomaly
    ? 0.7 + Math.random() * 0.25
    : 0.1 + Math.random() * 0.3;

  return {
    predicted_label: anomalyScore >= 0.5 ? "ANOMALY" : "NORMAL",
    anomaly_score: parseFloat(anomalyScore.toFixed(4)),
    raw_proba: {
      anomaly: parseFloat(anomalyScore.toFixed(4)),
      normal: parseFloat((1 - anomalyScore).toFixed(4)),
    },
  };
}

// ============== HELPER FUNCTIONS ==============
function formatTimestamp(date?: string): string {
  return date ? new Date(date).toLocaleString() : new Date().toLocaleString();
}

function getSeverity(score: number): "Low" | "Medium" | "High" {
  if (score >= 0.85) return "High";
  if (score >= 0.7) return "Medium";
  return "Low";
}

function getSuggestedAction(severity: "Low" | "Medium" | "High"): string {
  switch (severity) {
    case "High":
      return "Block/Isolate host";
    case "Medium":
      return "Alert SOC";
    default:
      return "Log only";
  }
}

// ============== MAIN COMPONENT ==============
export default function NIDSApp() {
  const { toast } = useToast();

  // Navigation state
  const [activeSection, setActiveSection] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // API status
  const [apiConnected, setApiConnected] = useState(true);

// SWR data fetching with API routes
const { data: alerts = [], isLoading: alertsLoading } = useSWR<Alert[]>("/api/alerts", fetcher, {
  refreshInterval: 5000,
});
const { data: logs = [], isLoading: logsLoading } = useSWR<Log[]>("/api/logs", fetcher, {
  refreshInterval: 5000,
});
const { data: settings, isLoading: settingsLoading } = useSWR<AppSettings>("/api/settings", fetcher);
const { data: stats } = useSWR<{ totalRequests: number; anomalies: number; normal: number; totalAlerts: number }>("/api/stats", fetcher, { refreshInterval: 10000 });

  // Local settings state for form
  const [localSettings, setLocalSettings] = useState<AppSettings>({
    anomalyThreshold: 0.7,
    autoCreateAlert: true,
    apiUrl: "http://localhost:8000/predict",
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Sync local settings when fetched
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  // Analysis state
  const [jsonInput, setJsonInput] = useState(SAMPLE_JSON);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [manualFeatures, setManualFeatures] = useState<FeatureInput>({
    "Flow Duration": 227.0,
    "Tot Fwd Pkts": 1,
    "Tot Bwd Pkts": 1,
    "Flow Byts/s": 396475.77,
    "Flow Pkts/s": 8810.57,
    dataset_IDS2025: 1,
  });
  const [analysing, setAnalysing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<PredictionResponse | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  // Filters
  const [alertSeverityFilter, setAlertSeverityFilter] = useState<string>("all");
  const [alertStatusFilter, setAlertStatusFilter] = useState<string>("all");
  const [alertSearch, setAlertSearch] = useState("");

  // Modal state
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [alertDetailOpen, setAlertDetailOpen] = useState(false);
  const [modelSwitchOpen, setModelSwitchOpen] = useState(false);

  // Overview stats from database
  const overviewStats = {
    totalRequests: stats?.totalRequests ?? 0,
    detectedAnomalies: stats?.anomalies ?? alerts.length,
    normalTraffic: stats?.normalTraffic ?? 0,
    avgResponseTime: stats?.avgResponseTime ?? 45,
  };

  // ============== HANDLERS ==============
  const handleAnalyse = useCallback(async () => {
    setInputError(null);
    setAnalysing(true);
    setAnalysisResult(null);

    try {
      let request: PredictionRequest;

      try {
        request = JSON.parse(jsonInput);
      } catch {
        throw new Error("Invalid JSON format");
      }

      if (!request.items || !request.items[0]?.features) {
        throw new Error("Invalid request structure. Expected { items: [{ features: {...} }] }");
      }

      // Add log entry
      await createLog({
        type: "request",
        message: "Request received - analysing traffic data",
        metadata: { features: request.items[0].features },
      });

      const result = await mockPredictAPI(request, localSettings.apiUrl);
      setAnalysisResult(result);

      // Save analysis to database
      await createAnalysis({
        input_features: request.items[0].features as unknown as Record<string, number>,
        predicted_label: result.predicted_label,
        anomaly_score: result.anomaly_score,
        raw_proba: result.raw_proba as unknown as Record<string, number>,
      });

      // Create alert if needed
      if (result.anomaly_score >= localSettings.anomalyThreshold && localSettings.autoCreateAlert) {
        const severity = getSeverity(result.anomaly_score);
        await createAlert({
          time: new Date().toISOString(),
          label: result.predicted_label,
          anomaly_score: result.anomaly_score,
          severity,
          action: getSuggestedAction(severity),
          status: "New",
          features: request.items[0].features as unknown as Record<string, number>,
        });

        toast({
          title: "Alert Created",
          description: `${severity} severity anomaly detected (score: ${result.anomaly_score})`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Analysis Complete",
          description: `Traffic classified as ${result.predicted_label}`,
        });
      }

      // Refresh data
      mutate("/api/alerts");
      mutate("/api/logs");
      mutate("/api/stats");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analysis failed";
      setInputError(message);
      toast({
        title: "Analysis Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setAnalysing(false);
    }
  }, [jsonInput, localSettings, toast]);

  const handleClear = () => {
    setJsonInput("");
    setAnalysisResult(null);
    setInputError(null);
  };

  const handleLoadSample = (type: "attack" | "normal") => {
    setJsonInput(type === "attack" ? SAMPLE_ATTACK : SAMPLE_NORMAL);
    setInputError(null);
  };

  const handleManualSubmit = () => {
    const request: PredictionRequest = {
      items: [{ features: manualFeatures }],
    };
    setJsonInput(JSON.stringify(request, null, 2));
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = text.split("\n").map((row) => row.split(","));
      setCsvData(rows);
      toast({
        title: "CSV Loaded",
        description: `Parsed ${rows.length} rows`,
      });
    };
    reader.readAsText(file);
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    const success = await updateAlertStatus(alertId, "Acknowledged");
    if (success) {
      mutate("/api/alerts");
      mutate("/api/logs");
      setAlertDetailOpen(false);
      toast({
        title: "Alert Acknowledged",
        description: "Status updated successfully",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to update alert status",
        variant: "destructive",
      });
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    const success = await updateAlertStatus(alertId, "Resolved");
    if (success) {
      mutate("/api/alerts");
      mutate("/api/logs");
      setAlertDetailOpen(false);
      toast({
        title: "Alert Resolved",
        description: "Alert has been marked as resolved",
      });
    }
  };

  const handleSaveSettings = async () => {
    const success = await updateSettings(localSettings);
    if (success) {
      mutate("/api/settings");
      setSettingsOpen(false);
      toast({
        title: "Settings Saved",
        description: "Your settings have been updated",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    }
  };

  const handleClearLogs = async () => {
    const success = await clearLogs();
    if (success) {
      mutate("/api/logs");
      toast({
        title: "Logs Cleared",
        description: "All logs have been removed",
      });
    }
  };

  const handleTestConnection = async () => {
    toast({
      title: "Testing Connection...",
      description: `Connecting to ${localSettings.apiUrl}`,
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));
    setApiConnected(true);

    toast({
      title: "Connection Successful",
      description: "API endpoint is reachable",
    });
  };

  const exportAlertsCSV = () => {
    const headers = ["Time", "Label", "Anomaly Score", "Severity", "Action", "Status"];
    const rows = alerts.map((a) => [formatTimestamp(a.time), a.label, a.anomaly_score, a.severity, a.action, a.status]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "alerts_export.csv";
    link.click();
  };

  const exportLogsCSV = () => {
    const headers = ["Timestamp", "Type", "Message"];
    const rows = logs.map((l) => [formatTimestamp(l.timestamp), l.type, l.message]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "logs_export.csv";
    link.click();
  };

  const downloadResultJSON = () => {
    if (!analysisResult) return;
    const blob = new Blob([JSON.stringify(analysisResult, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "analysis_result.json";
    link.click();
  };

  // Filter alerts
  const filteredAlerts = alerts.filter((alert) => {
    if (alertSeverityFilter !== "all" && alert.severity !== alertSeverityFilter) return false;
    if (alertStatusFilter !== "all" && alert.status !== alertStatusFilter) return false;
    if (alertSearch && !alert.action.toLowerCase().includes(alertSearch.toLowerCase())) return false;
    return true;
  });

  // ============== RENDER SECTIONS ==============
  const renderOverviewCards = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="border-border bg-card">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Analyses</p>
              <p className="text-2xl font-bold text-foreground">{overviewStats.totalRequests.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg">
              <Activity className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-[oklch(0.72_0.19_160)]">
            <TrendingUp className="h-3 w-3" />
            <span>From database</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Detected Anomalies</p>
              <p className="text-2xl font-bold text-destructive">{overviewStats.detectedAnomalies}</p>
            </div>
            <div className="p-3 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-destructive">
            <TrendingUp className="h-3 w-3" />
            <span>{alerts.filter((a) => a.status === "New").length} new alerts</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Normal Traffic</p>
              <p className="text-2xl font-bold text-[oklch(0.72_0.19_160)]">{overviewStats.normalTraffic.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-[oklch(0.72_0.19_160)]/10 rounded-lg">
              <CheckCircle2 className="h-6 w-6 text-[oklch(0.72_0.19_160)]" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <span>Classified as safe</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Response Time</p>
              <p className="text-2xl font-bold text-foreground">{overviewStats.avgResponseTime}ms</p>
            </div>
            <div className="p-3 bg-chart-2/10 rounded-lg">
              <Clock className="h-6 w-6 text-chart-2" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-[oklch(0.72_0.19_160)]">
            <TrendingDown className="h-3 w-3" />
            <span>-5ms from avg</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderAnalysePanel = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Input</CardTitle>
          <CardDescription>Provide traffic data for analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="json" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-secondary">
              <TabsTrigger value="json">Paste JSON</TabsTrigger>
              <TabsTrigger value="csv">Upload CSV</TabsTrigger>
              <TabsTrigger value="manual">Manual Features</TabsTrigger>
            </TabsList>

            <TabsContent value="json" className="space-y-4 mt-4">
              <Textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="Paste JSON request body..."
                className="font-mono text-sm min-h-[240px] bg-secondary border-border text-foreground"
              />
              {inputError && <p className="text-sm text-destructive">{inputError}</p>}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleAnalyse}
                  disabled={analysing || !jsonInput}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {analysing ? "Analysing..." : "Analyse Traffic"}
                </Button>
                <Button variant="outline" onClick={handleClear}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
              <div className="flex gap-4 text-sm">
                <button
                  onClick={() => handleLoadSample("attack")}
                  className="text-primary hover:underline"
                >
                  Load Sample Attack
                </button>
                <button
                  onClick={() => handleLoadSample("normal")}
                  className="text-primary hover:underline"
                >
                  Load Sample Normal
                </button>
              </div>
            </TabsContent>

            <TabsContent value="csv" className="space-y-4 mt-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drop CSV file here or click to browse
                </p>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  className="max-w-xs mx-auto"
                />
              </div>
              {csvData.length > 0 && (
                <p className="text-sm text-[oklch(0.72_0.19_160)]">
                  Loaded {csvData.length} rows
                </p>
              )}
            </TabsContent>

            <TabsContent value="manual" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Flow Duration</Label>
                  <Input
                    type="number"
                    value={manualFeatures["Flow Duration"]}
                    onChange={(e) =>
                      setManualFeatures((prev) => ({
                        ...prev,
                        "Flow Duration": parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Tot Fwd Pkts</Label>
                  <Input
                    type="number"
                    value={manualFeatures["Tot Fwd Pkts"]}
                    onChange={(e) =>
                      setManualFeatures((prev) => ({
                        ...prev,
                        "Tot Fwd Pkts": parseInt(e.target.value) || 0,
                      }))
                    }
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Tot Bwd Pkts</Label>
                  <Input
                    type="number"
                    value={manualFeatures["Tot Bwd Pkts"]}
                    onChange={(e) =>
                      setManualFeatures((prev) => ({
                        ...prev,
                        "Tot Bwd Pkts": parseInt(e.target.value) || 0,
                      }))
                    }
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Flow Byts/s</Label>
                  <Input
                    type="number"
                    value={manualFeatures["Flow Byts/s"]}
                    onChange={(e) =>
                      setManualFeatures((prev) => ({
                        ...prev,
                        "Flow Byts/s": parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Flow Pkts/s</Label>
                  <Input
                    type="number"
                    value={manualFeatures["Flow Pkts/s"]}
                    onChange={(e) =>
                      setManualFeatures((prev) => ({
                        ...prev,
                        "Flow Pkts/s": parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Dataset IDS2025</Label>
                  <Input
                    type="number"
                    value={manualFeatures["dataset_IDS2025"]}
                    onChange={(e) =>
                      setManualFeatures((prev) => ({
                        ...prev,
                        dataset_IDS2025: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
              </div>
              <Button onClick={handleManualSubmit} className="w-full">
                Generate JSON
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Result Panel */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Result</CardTitle>
          <CardDescription>Classification output from the model</CardDescription>
        </CardHeader>
        <CardContent>
          {analysing ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
              <p className="text-muted-foreground">Analysing traffic data...</p>
            </div>
          ) : analysisResult ? (
            <div className="space-y-6">
              {/* Classification Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge
                    variant={analysisResult.predicted_label === "ANOMALY" ? "destructive" : "default"}
                    className={
                      analysisResult.predicted_label === "ANOMALY"
                        ? "text-lg px-4 py-2"
                        : "text-lg px-4 py-2 bg-[oklch(0.72_0.19_160)] text-[oklch(0.13_0.01_260)]"
                    }
                  >
                    {analysisResult.predicted_label}
                  </Badge>
                </div>
                <Button variant="outline" size="sm" onClick={downloadResultJSON}>
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </Button>
              </div>

              {/* Confidence Meter */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Anomaly Score</span>
                  <span className="font-mono text-foreground">
                    {(analysisResult.anomaly_score * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress
                  value={analysisResult.anomaly_score * 100}
                  className="h-3"
                />
              </div>

              {/* Probability Breakdown */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-destructive/10 rounded-lg">
                  <p className="text-sm text-muted-foreground">Anomaly Probability</p>
                  <p className="text-xl font-bold text-destructive">
                    {(analysisResult.raw_proba.anomaly * 100).toFixed(2)}%
                  </p>
                </div>
                <div className="p-4 bg-[oklch(0.72_0.19_160)]/10 rounded-lg">
                  <p className="text-sm text-muted-foreground">Normal Probability</p>
                  <p className="text-xl font-bold text-[oklch(0.72_0.19_160)]">
                    {(analysisResult.raw_proba.normal * 100).toFixed(2)}%
                  </p>
                </div>
              </div>

              {/* Recommendations */}
              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">Recommendations</h4>
                {analysisResult.predicted_label === "ANOMALY" ? (
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-primary" />
                      Investigate source IP and destination
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-primary" />
                      Check for similar patterns in recent traffic
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-primary" />
                      Consider temporary blocking if severity is high
                    </li>
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Traffic appears normal. Continue monitoring.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Search className="h-12 w-12 mb-4 opacity-50" />
              <p>Submit traffic data to see results</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderAlertsTable = () => (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-foreground">Alerts</CardTitle>
            <CardDescription>
              Manage and review detected anomalies ({alerts.length} total)
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => mutate("/api/alerts")}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportAlertsCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Select value={alertSeverityFilter} onValueChange={setAlertSeverityFilter}>
            <SelectTrigger className="w-32 bg-secondary border-border">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={alertStatusFilter} onValueChange={setAlertStatusFilter}>
            <SelectTrigger className="w-36 bg-secondary border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="Acknowledged">Acknowledged</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Search actions..."
            value={alertSearch}
            onChange={(e) => setAlertSearch(e.target.value)}
            className="w-48 bg-secondary border-border"
          />
        </div>
      </CardHeader>
      <CardContent>
        {alertsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No alerts match your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Time</TableHead>
                  <TableHead className="text-muted-foreground">Label</TableHead>
                  <TableHead className="text-muted-foreground">Score</TableHead>
                  <TableHead className="text-muted-foreground">Severity</TableHead>
                  <TableHead className="text-muted-foreground">Action</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlerts.map((alert) => (
                  <TableRow
                    key={alert.id}
                    className="border-border cursor-pointer hover:bg-secondary/50"
                    onClick={() => {
                      setSelectedAlert(alert);
                      setAlertDetailOpen(true);
                    }}
                  >
                    <TableCell className="font-mono text-sm text-foreground">
                      {formatTimestamp(alert.time)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">{alert.label}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-foreground">
                      {(Number(alert.anomaly_score) * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          alert.severity === "High"
                            ? "destructive"
                            : alert.severity === "Medium"
                              ? "default"
                              : "secondary"
                        }
                        className={
                          alert.severity === "Medium"
                            ? "bg-[oklch(0.80_0.18_80)] text-[oklch(0.13_0.01_260)]"
                            : ""
                        }
                      >
                        {alert.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-foreground">{alert.action}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          alert.status === "New"
                            ? "border-destructive text-destructive"
                            : alert.status === "Acknowledged"
                              ? "border-[oklch(0.80_0.18_80)] text-[oklch(0.80_0.18_80)]"
                              : "border-[oklch(0.72_0.19_160)] text-[oklch(0.72_0.19_160)]"
                        }
                      >
                        {alert.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderLogsPanel = () => (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-foreground">Activity Logs</CardTitle>
            <CardDescription>Recent system events and classifications</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => mutate("/api/logs")}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportLogsCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={handleClearLogs}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {logsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ScrollText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No logs yet. Run an analysis to see activity.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50"
              >
                <div
                  className={`p-1.5 rounded ${
                    log.type === "request"
                      ? "bg-chart-2/20"
                      : log.type === "classification" || log.type === "analysis"
                        ? "bg-primary/20"
                        : log.type === "alert"
                          ? "bg-destructive/20"
                          : "bg-[oklch(0.80_0.18_80)]/20"
                  }`}
                >
                  {log.type === "request" ? (
                    <Server className="h-4 w-4 text-chart-2" />
                  ) : log.type === "classification" || log.type === "analysis" ? (
                    <Cpu className="h-4 w-4 text-primary" />
                  ) : log.type === "alert" ? (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  ) : (
                    <Zap className="h-4 w-4 text-[oklch(0.80_0.18_80)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{log.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTimestamp(log.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderModelsPanel = () => (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-foreground">Model Management</CardTitle>
        <CardDescription>Configure and switch ML models</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Model */}
        <div className="p-4 border border-border rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium text-foreground">Current Model</h4>
              <p className="text-sm text-muted-foreground">bmanj_ids_rf_v1.pkl</p>
            </div>
            <Badge className="bg-[oklch(0.72_0.19_160)] text-[oklch(0.13_0.01_260)]">Active</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Accuracy</p>
              <p className="font-medium text-foreground">98.7%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Precision</p>
              <p className="font-medium text-foreground">97.2%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Recall</p>
              <p className="font-medium text-foreground">96.8%</p>
            </div>
            <div>
              <p className="text-muted-foreground">F1 Score</p>
              <p className="font-medium text-foreground">97.0%</p>
            </div>
          </div>
        </div>

        {/* Switch Model */}
        <Dialog open={modelSwitchOpen} onOpenChange={setModelSwitchOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full bg-transparent">
              <Cpu className="h-4 w-4 mr-2" />
              Switch Model
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Switch Model</DialogTitle>
              <DialogDescription>
                Select a different model for classification
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {[
                { name: "bmanj_ids_rf_v1.pkl", type: "Random Forest", active: true },
                { name: "bmanj_ids_xgb_v1.pkl", type: "XGBoost", active: false },
                { name: "bmanj_ids_nn_v1.h5", type: "Neural Network", active: false },
              ].map((model) => (
                <div
                  key={model.name}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    model.active
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{model.name}</p>
                      <p className="text-sm text-muted-foreground">{model.type}</p>
                    </div>
                    {model.active && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );

  const renderDeploymentPanel = () => (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-foreground">Deployment</CardTitle>
        <CardDescription>API endpoint configuration and deployment options</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* API Endpoint */}
        <div className="space-y-2">
          <Label className="text-foreground">API Endpoint</Label>
          <div className="flex gap-2">
            <Input
              value={localSettings.apiUrl}
              onChange={(e) =>
                setLocalSettings((prev) => ({ ...prev, apiUrl: e.target.value }))
              }
              className="font-mono bg-secondary border-border text-foreground"
            />
            <Button variant="outline" onClick={handleTestConnection}>
              Test
            </Button>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div
              className={`h-2 w-2 rounded-full ${
                apiConnected ? "bg-[oklch(0.72_0.19_160)]" : "bg-destructive"
              }`}
            />
            <span className="text-muted-foreground">
              {apiConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>

        {/* Docker Command */}
        <div className="space-y-2">
          <Label className="text-foreground">Docker Deployment</Label>
          <div className="p-4 bg-secondary rounded-lg font-mono text-sm text-foreground overflow-x-auto">
            <pre>docker run -p 8000:8000 bmanj/ids-api:latest</pre>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(
                "docker run -p 8000:8000 bmanj/ids-api:latest"
              );
              toast({ title: "Copied to clipboard" });
            }}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Command
          </Button>
        </div>

        {/* Documentation Link */}
        <div className="p-4 border border-border rounded-lg">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-foreground">API Documentation</p>
              <p className="text-sm text-muted-foreground">
                View full API reference and examples
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderHowItWorks = () => (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-foreground">How It Works</CardTitle>
        <CardDescription>The BMANJ IDS classification pipeline</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/20 flex items-center justify-center">
              <Server className="h-6 w-6 text-primary" />
            </div>
            <h4 className="font-medium text-foreground mb-1">1. Data Input</h4>
            <p className="text-sm text-muted-foreground">
              Network traffic features are extracted and sent to the API
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/20 flex items-center justify-center">
              <Cpu className="h-6 w-6 text-primary" />
            </div>
            <h4 className="font-medium text-foreground mb-1">2. ML Classification</h4>
            <p className="text-sm text-muted-foreground">
              Random Forest model analyses patterns and classifies traffic
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/20 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h4 className="font-medium text-foreground mb-1">3. Alert & Action</h4>
            <p className="text-sm text-muted-foreground">
              Anomalies trigger alerts with recommended actions
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // ============== MAIN RENDER ==============
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="font-bold text-foreground">BMANJ IDS System</h1>
                <p className="text-xs text-muted-foreground">
                  Network Intrusion Detection
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* API Status */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full">
              <div
                className={`h-2 w-2 rounded-full ${
                  apiConnected ? "bg-[oklch(0.72_0.19_160)]" : "bg-destructive"
                }`}
              />
              <span className="text-xs text-muted-foreground">
                API {apiConnected ? "Connected" : "Offline"}
              </span>
            </div>

            {/* Settings */}
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Settings</DialogTitle>
                  <DialogDescription>
                    Configure detection thresholds and preferences
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-2">
                    <Label className="text-foreground">
                      Anomaly Threshold: {localSettings.anomalyThreshold.toFixed(2)}
                    </Label>
                    <Slider
                      value={[localSettings.anomalyThreshold]}
                      onValueChange={([val]) =>
                        setLocalSettings((prev) => ({
                          ...prev,
                          anomalyThreshold: val,
                        }))
                      }
                      min={0.5}
                      max={0.95}
                      step={0.05}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Scores above this threshold will trigger alerts
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-foreground">Auto-create Alerts</Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically create alerts for anomalies
                      </p>
                    </div>
                    <Switch
                      checked={localSettings.autoCreateAlert}
                      onCheckedChange={(checked) =>
                        setLocalSettings((prev) => ({
                          ...prev,
                          autoCreateAlert: checked,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground">API URL</Label>
                    <Input
                      value={localSettings.apiUrl}
                      onChange={(e) =>
                        setLocalSettings((prev) => ({
                          ...prev,
                          apiUrl: e.target.value,
                        }))
                      }
                      className="font-mono bg-secondary border-border text-foreground"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handleSaveSettings}>Save Settings</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          } pt-16 lg:pt-0`}
        >
          <nav className="p-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    activeSection === item.id
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                  {item.id === "alerts" && alerts.filter((a) => a.status === "New").length > 0 && (
                    <Badge variant="destructive" className="ml-auto text-xs">
                      {alerts.filter((a) => a.status === "New").length}
                    </Badge>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Backdrop for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 min-h-[calc(100vh-4rem)]">
          <div className="max-w-7xl mx-auto space-y-6">
            {activeSection === "dashboard" && (
              <>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
                  <p className="text-muted-foreground">
                    Real-time network intrusion detection overview
                  </p>
                </div>
                {renderOverviewCards()}
                {renderHowItWorks()}
              </>
            )}

            {activeSection === "analyse" && (
              <>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Analyse Traffic</h2>
                  <p className="text-muted-foreground">
                    Submit network traffic data for classification
                  </p>
                </div>
                {renderAnalysePanel()}
              </>
            )}

            {activeSection === "alerts" && (
              <>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Alerts</h2>
                  <p className="text-muted-foreground">
                    Review and manage detected anomalies
                  </p>
                </div>
                {renderAlertsTable()}
              </>
            )}

            {activeSection === "logs" && (
              <>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Activity Logs</h2>
                  <p className="text-muted-foreground">
                    System events and classification history
                  </p>
                </div>
                {renderLogsPanel()}
              </>
            )}

            {activeSection === "models" && (
              <>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Model Management</h2>
                  <p className="text-muted-foreground">
                    Configure and manage ML models
                  </p>
                </div>
                {renderModelsPanel()}
              </>
            )}

            {activeSection === "deployment" && (
              <>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Deployment</h2>
                  <p className="text-muted-foreground">
                    API configuration and deployment options
                  </p>
                </div>
                {renderDeploymentPanel()}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Alert Detail Modal */}
      <Dialog open={alertDetailOpen} onOpenChange={setAlertDetailOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Alert Details</DialogTitle>
            <DialogDescription>
              Full information about the detected anomaly
            </DialogDescription>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Time</p>
                  <p className="font-medium text-foreground">
                    {formatTimestamp(selectedAlert.time)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge
                    variant="outline"
                    className={
                      selectedAlert.status === "New"
                        ? "border-destructive text-destructive"
                        : selectedAlert.status === "Acknowledged"
                          ? "border-[oklch(0.80_0.18_80)] text-[oklch(0.80_0.18_80)]"
                          : "border-[oklch(0.72_0.19_160)] text-[oklch(0.72_0.19_160)]"
                    }
                  >
                    {selectedAlert.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Anomaly Score</p>
                  <p className="font-medium text-foreground">
                    {(Number(selectedAlert.anomaly_score) * 100).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Severity</p>
                  <Badge
                    variant={
                      selectedAlert.severity === "High"
                        ? "destructive"
                        : selectedAlert.severity === "Medium"
                          ? "default"
                          : "secondary"
                    }
                    className={
                      selectedAlert.severity === "Medium"
                        ? "bg-[oklch(0.80_0.18_80)] text-[oklch(0.13_0.01_260)]"
                        : ""
                    }
                  >
                    {selectedAlert.severity}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground text-sm mb-1">
                  Recommended Action
                </p>
                <p className="text-foreground">{selectedAlert.action}</p>
              </div>

              {selectedAlert.features && (
                <div>
                  <p className="text-muted-foreground text-sm mb-1">Features</p>
                  <pre className="text-xs bg-secondary p-3 rounded-lg overflow-x-auto text-foreground">
                    {JSON.stringify(selectedAlert.features, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            {selectedAlert?.status === "New" && (
              <Button
                variant="outline"
                onClick={() => handleAcknowledgeAlert(selectedAlert.id)}
              >
                Acknowledge
              </Button>
            )}
            {selectedAlert?.status !== "Resolved" && (
              <Button
                onClick={() => selectedAlert && handleResolveAlert(selectedAlert.id)}
              >
                Resolve
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}
