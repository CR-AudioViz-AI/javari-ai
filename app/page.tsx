export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-center font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">
          Javari AI
        </h1>
        <p className="text-center text-xl mb-4">
          Autonomous, Self-Healing AI Assistant
        </p>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-300 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">API Endpoints</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>/api/projects</li>
              <li>/api/subprojects</li>
              <li>/api/work/log</li>
              <li>/api/health</li>
            </ul>
          </div>
          <div className="border border-gray-300 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Features</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Project Management</li>
              <li>Chat Session Tracking</li>
              <li>Work Log Monitoring</li>
              <li>Build Health Tracking</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}
