import { useState, useEffect } from 'react';
import API_BASE_URL from '../../utils/api';

export default function KnowledgeEditor() {
  const [knowledge, setKnowledge] = useState([]);
  const [filteredKnowledge, setFilteredKnowledge] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchKnowledge();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredKnowledge(knowledge);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = knowledge.filter(k => 
        k.question.toLowerCase().includes(term) ||
        k.answer_long.toLowerCase().includes(term) ||
        k.category.toLowerCase().includes(term) ||
        (k.keywords && k.keywords.toLowerCase().includes(term))
      );
      setFilteredKnowledge(filtered);
    }
  }, [searchTerm, knowledge]);

  const fetchKnowledge = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/recycle-knowledge`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setKnowledge(data);
      setFilteredKnowledge(data);
    } catch (error) {
      console.error('Error fetching knowledge:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/recycle-knowledge/${editingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        const updatedItem = await response.json();
        setKnowledge(knowledge.map(k => k.id === editingId ? updatedItem : k));
        setEditingId(null);
        setEditForm({});
      } else {
        alert('Failed to save changes');
      }
    } catch (error) {
      console.error('Error saving knowledge:', error);
      alert('Error saving changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading knowledge base...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Knowledge Base Editor</h2>
        <p className="text-gray-600">Manage Q&A content for the voice agent</p>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <input
            type="text"
            placeholder="🔍 Search questions, answers, categories, or keywords..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <div className="mt-2 text-sm text-gray-600">
          Showing {filteredKnowledge.length} of {knowledge.length} entries
        </div>
      </div>

      {/* Knowledge List */}
      <div className="space-y-4">
        {filteredKnowledge.map((item) => (
          <div key={item.id} className="bg-white rounded-lg shadow p-6">
            {editingId === item.id ? (
              // Edit Mode
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Intent
                  </label>
                  <input
                    type="text"
                    value={editForm.intent || ''}
                    onChange={(e) => setEditForm({...editForm, intent: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Question
                  </label>
                  <textarea
                    value={editForm.question || ''}
                    onChange={(e) => setEditForm({...editForm, question: e.target.value})}
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Detailed Answer
                  </label>
                  <textarea
                    value={editForm.answer_long || ''}
                    onChange={(e) => setEditForm({...editForm, answer_long: e.target.value})}
                    rows="4"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Voice Response
                  </label>
                  <textarea
                    value={editForm.answer_voice || ''}
                    onChange={(e) => setEditForm({...editForm, answer_voice: e.target.value})}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={editForm.category || ''}
                      onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <input
                      type="number"
                      value={editForm.priority || 0}
                      onChange={(e) => setEditForm({...editForm, priority: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Keywords (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={editForm.keywords || ''}
                    onChange={(e) => setEditForm({...editForm, keywords: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    placeholder="keyword1, keyword2, keyword3"
                  />
                </div>

                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={editForm.is_active || false}
                      onChange={(e) => setEditForm({...editForm, is_active: e.target.checked})}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                </div>

                <div className="flex space-x-2 pt-4 border-t">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:bg-gray-400"
                  >
                    {saving ? '💾 Saving...' : '💾 Save Changes'}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-md transition-colors"
                  >
                    ❌ Cancel
                  </button>
                </div>
              </div>
            ) : (
              // View Mode
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{item.intent}</h3>
                    <p className="text-sm text-gray-500 mt-1">Category: {item.category}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {item.is_active ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                        ✓ Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded">
                        Inactive
                      </span>
                    )}
                    <button
                      onClick={() => handleEdit(item)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      ✏️ Edit
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Question:</p>
                    <p className="text-gray-600">{item.question}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">Detailed Answer:</p>
                    <p className="text-gray-600">{item.answer_long}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">Voice Response:</p>
                    <p className="text-gray-600">{item.answer_voice}</p>
                  </div>

                  {item.keywords && (
                    <div>
                      <p className="text-sm font-medium text-gray-700">Keywords:</p>
                      <p className="text-gray-600">{item.keywords}</p>
                    </div>
                  )}

                  <div className="flex space-x-4 text-sm text-gray-500 pt-2 border-t">
                    <span>Priority: {item.priority}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredKnowledge.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-gray-600">No knowledge entries found matching your search.</p>
        </div>
      )}
    </div>
  );
}