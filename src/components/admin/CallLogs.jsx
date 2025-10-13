import { useState, useEffect } from 'react';
import API_BASE_URL from '../../utils/api';

export default function CallLogs() {
  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCall, setSelectedCall] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, [statusFilter]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredConversations(conversations);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = conversations.filter(c => 
        c.phone_number && c.phone_number.includes(term) ||
        (c.issue_category && c.issue_category.toLowerCase().includes(term))
      );
      setFilteredConversations(filtered);
    }
  }, [searchTerm, conversations]);

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const url = statusFilter === 'all' 
        ? `${API_BASE_URL}/conversations`
        : `${API_BASE_URL}/conversations?status=${statusFilter}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }
      
      const data = await response.json();
      
      if (Array.isArray(data)) {
        setConversations(data);
        setFilteredConversations(data);
      } else {
        console.error('API returned non-array data:', data);
        setConversations([]);
        setFilteredConversations([]);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setConversations([]);
      setFilteredConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const viewCallDetails = async (callId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/conversations/${callId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setSelectedCall(data);
      setShowModal(true);
    } catch (error) {
      console.error('Error fetching call details:', error);
      alert('Error loading call details');
    }
  };

  const maskPhoneNumber = (phone) => {
    if (!phone || phone.length < 4) return phone;
    const lastFour = phone.slice(-4);
    return `***-***-${lastFour}`;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'escalated':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const stats = {
    total: conversations.length,
    resolved: conversations.filter(c => c.resolution_status === 'resolved').length,
    pending: conversations.filter(c => c.resolution_status === 'pending').length,
    avgDuration: conversations.length > 0
      ? Math.round(conversations.reduce((sum, c) => sum + (c.call_duration || 0), 0) / conversations.length)
      : 0
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading call logs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Call Logs</h2>
        <p className="text-gray-600">View and analyze customer call history</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 mb-1">Total Calls</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 mb-1">Resolved</p>
          <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 mb-1">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 mb-1">Avg Duration</p>
          <p className="text-2xl font-bold text-blue-600">{formatDuration(stats.avgDuration)}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <input
              type="text"
              placeholder="🔍 Search by phone or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="resolved">Resolved</option>
              <option value="pending">Pending</option>
              <option value="escalated">Escalated</option>
            </select>
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-600">
          Showing {filteredConversations.length} of {conversations.length} calls
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date/Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredConversations.map((call) => (
                <tr key={call.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(call.start_time).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {maskPhoneNumber(call.phone_number)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDuration(call.call_duration)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(call.resolution_status)}`}>
                      {call.resolution_status || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {call.issue_category || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {call.satisfaction_score ? `${call.satisfaction_score}/5 ⭐` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => viewCallDetails(call.id)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredConversations.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📞</div>
            <p className="text-gray-600">No calls found matching your filters.</p>
          </div>
        )}
      </div>

      {showModal && selectedCall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">Call Details</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Phone Number</p>
                  <p className="text-gray-900">{maskPhoneNumber(selectedCall.phone_number)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Status</p>
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${getStatusColor(selectedCall.resolution_status)}`}>
                    {selectedCall.resolution_status}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Start Time</p>
                  <p className="text-gray-900">{new Date(selectedCall.start_time).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Duration</p>
                  <p className="text-gray-900">{formatDuration(selectedCall.call_duration)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Category</p>
                  <p className="text-gray-900">{selectedCall.issue_category || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Satisfaction Score</p>
                  <p className="text-gray-900">{selectedCall.satisfaction_score ? `${selectedCall.satisfaction_score}/5 ⭐` : 'N/A'}</p>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Conversation Transcript</h4>
                <div className="space-y-3">
                  {selectedCall.messages && selectedCall.messages.length > 0 ? (
                    selectedCall.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-4 rounded-lg ${
                          msg.sender === 'user' ? 'bg-blue-50 ml-8' : msg.sender === 'agent' ? 'bg-green-50 mr-8' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">
                            {msg.sender === 'user' ? '👤 Customer' : msg.sender === 'agent' ? '🤖 Agent' : '⚙️ System'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(msg.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-gray-800">{msg.content}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No messages available</p>
                  )}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowModal(false)}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}