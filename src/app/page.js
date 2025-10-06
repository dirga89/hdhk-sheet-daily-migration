'use client';

// import { useState } from 'react';
import GoogleSheetsViewer from '@/components/GoogleSheetsViewer';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Google Sheets Viewer
          </h1>
          <p className="text-lg text-gray-700">
            Enter a Google Sheets URL to view and explore your data
          </p>
        </div>
        
        <GoogleSheetsViewer />
      </div>
    </main>
  );
}
