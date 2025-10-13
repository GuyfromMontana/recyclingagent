import { useState, useEffect } from 'react';
import API_BASE_URL from '../../utils/api';

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState({
    totalMaterials: 0,
    activeMaterials: 0,
    totalKnowledge: 0,
    activeKnowledge: 0,
    totalCalls: 0,
    resolvedCalls: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const headers = {
        'Authorization': `Bearer ${token}`
      };

      // Fetch material pricing stats
      const pricingRes = await fetch(`${API_BASE_URL}/pricing`, { headers });
      const pricingData = await pricingRes.json();
      
      // Fetch knowledge base stats
      const knowledgeRes = await fetch(`${API_BASE_URL}/recycle-knowledge`, { headers });
      const knowledgeData = await knowledgeRes.json();
      
      // Fetch call logs stats
      const callsRes = await fetch(`${API_BASE_URL}/conversations`, { headers });
      const callsData = await callsRes.json();

      setStats({
        totalMaterials: pricingData.length,
        activeMaterials: pricingData.filter(m => m.active).length,
        totalKnowledge: knowledgeData.length,
        activeKnowledge: knowledgeData.filter(k => k.is_active).length,
        totalCalls: callsData.length,
        resolvedCalls: callsData.filter(c => c.resolution_status === 'resolved').length
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  const StatCard = ({ icon, title, value, subtitle, bgColor }) => (
    <div className={`${bgColor} rounded-lg shadow p-6`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Dashboard Overview</h2>
        <p className="text-gray-600">Welcome to the Axmen Recycling admin interface</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          icon="💰"
          title="Material Pricing"
          value={stats.totalMaterials}
          subtitle={`${stats.activeMaterials} active`}
          bgColor="bg-blue-50"
        />
        <StatCard
          icon="📚"
          title="Knowledge Base"
          value={stats.totalKnowledge}
          subtitle={`${stats.activeKnowledge} active`}
          bgColor="bg-green-50"
        />
        <StatCard
          icon="📞"
          title="Total Calls"
          value={stats.totalCalls}
          subtitle={`${stats.resolvedCalls} resolved`}
          bgColor="bg-purple-50"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => onNavigate('pricing')}
            className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            <span>💰</span>
            <span>Edit Material Pricing</span>
          </button>
          <button
            onClick={() => onNavigate('knowledge')}
            className="flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            <span>📚</span>
            <span>Manage Knowledge Base</span>
          </button>
          <button
            onClick={() => onNavigate('call-logs')}
            className="flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            <span>📞</span>
            <span>View Call Logs</span>
          </button>
        </div>
      </div>

      {/* Business Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Business Information</h3>
        <div className="space-y-2 text-gray-600">
          <p><strong>Location:</strong> 9780 Summit Drive, Missoula, MT 59808</p>
          <p><strong>Phone:</strong> 406-543-1905</p>
          <p><strong>Summer Hours:</strong> Tuesday-Saturday, 8AM-4PM</p>
          <p><strong>Winter Hours:</strong> Tuesday-Saturday, 9AM-5PM</p>
        </div>
      </div>

      {/* Data Health */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Data Health</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm text-gray-600">Active Materials</span>
              <span className="text-sm font-medium text-gray-900">
                {Math.round((stats.activeMaterials / stats.totalMaterials) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${(stats.activeMaterials / stats.totalMaterials) * 100}%` }}
              ></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm text-gray-600">Active Knowledge Entries</span>
              <span className="text-sm font-medium text-gray-900">
                {Math.round((stats.activeKnowledge / stats.totalKnowledge) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full" 
                style={{ width: `${(stats.activeKnowledge / stats.totalKnowledge) * 100}%` }}
              ></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm text-gray-600">Resolved Calls</span>
              <span className="text-sm font-medium text-gray-900">
                {stats.totalCalls > 0 ? Math.round((stats.resolvedCalls / stats.totalCalls) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-600 h-2 rounded-full" 
                style={{ width: `${stats.totalCalls > 0 ? (stats.resolvedCalls / stats.totalCalls) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}