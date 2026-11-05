import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import SyntheticNote from '../components/SyntheticNote';

/**
 * 404 Not Found Page - Inner Peace Styling
 *
 * Rendered when a route or project does not exist.
 */
export default function NotFound() {
  useEffect(() => {
    document.title = '404 - Corridor Not Found | LandSentinel';
  }, []);

  return (
    <div className="max-w-xl mx-auto py-12 text-center space-y-6">
      <div className="peace-card p-8 space-y-5 bg-[#16100C] border border-[rgba(244,217,160,0.2)] shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-[#301C0D] border border-[#8A4A17] text-[#FDE68A] mx-auto flex items-center justify-center font-mono text-2xl font-bold">
          404
        </div>

        <div>
          <span className="text-[10px] font-mono text-[#F4D9A0] uppercase tracking-widest bg-[#2A1F18] px-2 py-0.5 rounded border border-[rgba(244,217,160,0.18)]">
            Corridor Route Unresolved
          </span>
          <h1 className="text-2xl font-bold font-headline text-[#F4D9A0] mt-2">
            Cadastral Record Not Found
          </h1>
          <p className="text-xs text-[#C4B5A5] mt-1 leading-relaxed">
            The requested institutional path or corridor identifier does not exist within the active LandSentinel state infrastructure registry.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
          <Link
            to="/overview"
            className="btn-amber text-xs font-semibold px-4 py-2"
          >
            &larr; Executive Overview
          </Link>
          <Link
            to="/projects"
            className="btn-mocha text-xs px-4 py-2"
          >
            Projects Registry
          </Link>
        </div>
      </div>

      <div className="flex justify-center">
        <SyntheticNote />
      </div>
    </div>
  );
}

