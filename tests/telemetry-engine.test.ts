import telemetryEngine from "@/lib/telemetry-engine";

test("heartbeat emits without crashing", () => {
  telemetryEngine.emitHeartbeat("test", "ok");
});

test("modeChange emits", () => {
  telemetryEngine.emitModeChange("BUILD_MODE");
});

test("progress emits", () => {
  telemetryEngine.emitProgress("task1", 50);
});
