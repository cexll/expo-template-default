type TelemetryPayload = {
  event: string;
  properties?: Record<string, string | number | boolean | null>;
};

export async function trackEvent(payload: TelemetryPayload) {
  try {
    await fetch('/api/telemetry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Telemetry should not block the UI path.
  }
}
