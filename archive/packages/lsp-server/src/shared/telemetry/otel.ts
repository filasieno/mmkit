import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

let sdk: NodeSDK | undefined;
let loggerProvider: LoggerProvider | undefined;

/** OpenTelemetry is opt-in: set `MMKIT_OTEL_ENABLED=1` and `OTEL_EXPORTER_OTLP_ENDPOINT`. */
export function isOpenTelemetryEnabled(): boolean {
  return process.env.MMKIT_OTEL_ENABLED === "1" && process.env.MMKIT_OTEL_DISABLED !== "1";
}

function otlpBaseUrl(): string {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/$/, "");
  if (endpoint) return endpoint;
  return "http://127.0.0.1:4318";
}

export function initOpenTelemetry(): void {
  if (!isOpenTelemetryEnabled()) return;

  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    console.warn(
      "mmkit-lsp: MMKIT_OTEL_ENABLED=1 but OTEL_EXPORTER_OTLP_ENDPOINT is unset — skipping OpenTelemetry"
    );
    return;
  }

  const serviceName = process.env.OTEL_SERVICE_NAME ?? "mmkit-lsp";
  const resource = new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
    "service.namespace": "mmkit",
  });

  if (process.env.OTEL_LOG_LEVEL === "debug") {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const base = otlpBaseUrl();
  const traceExporter = new OTLPTraceExporter({ url: `${base}/v1/traces` });
  const metricExporter = new OTLPMetricExporter({ url: `${base}/v1/metrics` });
  const logExporter = new OTLPLogExporter({ url: `${base}/v1/logs` });

  loggerProvider = new LoggerProvider({ resource });
  loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(logExporter));
  logs.setGlobalLoggerProvider(loggerProvider);

  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 15_000,
    }),
  });

  sdk.start();
}

export async function shutdownOpenTelemetry(): Promise<void> {
  await loggerProvider?.shutdown();
  await sdk?.shutdown();
  sdk = undefined;
  loggerProvider = undefined;
}

export function otelLogger(name = "mmkit-lsp") {
  return logs.getLogger(name);
}
