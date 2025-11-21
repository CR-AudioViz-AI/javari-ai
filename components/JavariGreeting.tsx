import React from 'react';

const JavariGreeting: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md mx-4">
        <div className="text-center">
          <div className="mb-4">
            <span className="text-4xl">🤖</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Hello from Javari Autonomous Build
          </h1>
          <p className="text-gray-600 text-sm">
            Built autonomously with Next.js & Tailwind CSS
          </p>
          <div className="mt-6 inline-flex items-center px-4 py-2 bg-blue-100 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
            <span className="text-blue-800 text-xs font-medium">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JavariGreeting;