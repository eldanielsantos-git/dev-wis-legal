import React from 'react';

interface FooterProps {
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
}

export function Footer({ onNavigateToTerms, onNavigateToPrivacy, onNavigateToCookies }: FooterProps = {}) {
  return (
    <footer className="bg-wis-dark text-white py-6 mt-auto font-body">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium">Wis Legal • Legal transcription and forensic analysis</p>
          <p className="text-xs text-gray-400">Copyright © 2025 all rights reserved</p>
          <div className="flex items-center justify-center space-x-4 text-xs text-gray-400">
            <button onClick={onNavigateToTerms} className="hover:text-white transition-colors">Terms of Use</button>
            <span>|</span>
            <button onClick={onNavigateToPrivacy} className="hover:text-white transition-colors">Privacy Policy</button>
            <span>|</span>
            <button onClick={onNavigateToCookies} className="hover:text-white transition-colors">Use of Cookies</button>
          </div>
        </div>
      </div>
    </footer>
  );
}
