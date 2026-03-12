// lib/javari/providers/BaseProvider.ts
// Self-healing base provider — never throws on missing key at construction.
// Missing keys are caught at first generateStream() call, enabling graceful
// fallback in the provider chain.
// Timestamp: 2026-02-19 09:40 EST
import { AIProvider, RouterOptions } from '../router/types';
export interface ExtendedRouterOptions extends RouterOptions {
// Legacy alias — some files import this name
export type ExtendedExtendedRouterOptions = ExtendedRouterOptions;
    // Graceful degradation: store key even if empty.
    // generateStream() will throw with a clear message if key is missing,
    // allowing the router fallback chain to try the next provider.
export default {}
