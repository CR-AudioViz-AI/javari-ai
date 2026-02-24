/**
 * MULTI-AI CHAMBER PAGE
 * 
 * Route: /javari/chamber
 * Production UI for ChatGPT + Claude + Javari collaboration
 */

import { Metadata } from 'next';
import JavariChamberUI from '../../components/JavariChamberUI';

export const metadata: Metadata = {
  title: 'Multi-AI Chamber | Javari AI',
  description: 'ChatGPT (Architect) + Claude (Builder) + Javari (Observer) autonomous build system',
};

export default function ChamberPage() {
  return (
    <div className="chamber-page">
      <JavariChamberUI />
    </div>
  );
}
