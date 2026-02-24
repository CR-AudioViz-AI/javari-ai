/**
 * MULTI-AI CHAMBER
 * Route: /chamber
 * ChatGPT (Architect) + Claude (Builder) + Javari (Observer)
 */

import { Metadata } from 'next';
import JavariChamberUI from '@/components/JavariChamberUI';

export const metadata: Metadata = {
  title: 'Multi-AI Chamber | CR AudioViz AI',
  description: 'Build with ChatGPT (Architect) + Claude (Builder) + Javari (Observer)',
};

export default function ChamberPage() {
  return <JavariChamberUI />;
}
