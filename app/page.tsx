export default function Page() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          MaxSam V4 Command Center
        </h1>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-cyan-500 rounded-lg p-6">
          <div className="text-white text-sm font-medium mb-2">Total Leads</div>
          <div className="text-white text-3xl font-bold">127</div>
        </div>
        
        <div className="bg-green-500 rounded-lg p-6">
          <div className="text-white text-sm font-medium mb-2">Active Deals</div>
          <div className="text-white text-3xl font-bold">23</div>
        </div>
        
        <div className="bg-purple-500 rounded-lg p-6">
          <div className="text-white text-sm font-medium mb-2">Conversion Rate</div>
          <div className="text-white text-3xl font-bold">18.1%</div>
        </div>
        
        <div className="bg-blue-500 rounded-lg p-6">
          <div className="text-white text-sm font-medium mb-2">Total Revenue</div>
          <div className="text-white text-3xl font-bold">$847,500</div>
        </div>
      </div>

      {/* AI Agents Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-4">AI Agents</h2>
        <div className="space-y-4">
          <div className="bg-zinc-900 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-white font-medium">Sam (Voice AI)</span>
              <span className="text-cyan-400">94% efficiency</span>
            </div>
            <div className="w-full bg-zinc-700 rounded-full h-2">
              <div className="bg-cyan-500 h-2 rounded-full" style={{ width: '94%' }}></div>
            </div>
          </div>
          
          <div className="bg-zinc-900 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-white font-medium">Eleanor (Lead Scoring)</span>
              <span className="text-purple-400">87% efficiency</span>
            </div>
            <div className="w-full bg-zinc-700 rounded-full h-2">
              <div className="bg-purple-500 h-2 rounded-full" style={{ width: '87%' }}></div>
            </div>
          </div>
          
          <div className="bg-zinc-900 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-white font-medium">Alex (Workflow)</span>
              <span className="text-blue-400">91% efficiency</span>
            </div>
            <div className="w-full bg-zinc-700 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: '91%' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Recent Activity</h2>
        <div className="bg-zinc-900 rounded-lg divide-y divide-zinc-800">
          <div className="flex justify-between p-4">
            <span className="text-zinc-300">New lead assigned: 123 Oak Street</span>
            <span className="text-zinc-500">2 min ago</span>
          </div>
          <div className="flex justify-between p-4">
            <span className="text-zinc-300">Contract generated for 456 Maple Ave</span>
            <span className="text-zinc-500">5 min ago</span>
          </div>
          <div className="flex justify-between p-4">
            <span className="text-zinc-300">Sam completed outreach call</span>
            <span className="text-zinc-500">12 min ago</span>
          </div>
          <div className="flex justify-between p-4">
            <span className="text-zinc-300">Eleanor scored new property</span>
            <span className="text-zinc-500">18 min ago</span>
          </div>
          <div className="flex justify-between p-4">
            <span className="text-zinc-300">Deal closed: $42,500 commission</span>
            <span className="text-zinc-500">1 hour ago</span>
          </div>
        </div>
      </div>
    </main>
  );
}