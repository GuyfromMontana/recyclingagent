import { useState, useEffect } from 'react';

export default function PricingEditor() {
  const [materials, setMaterials] = useState([]);
  const [filteredMaterials, setFilteredMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    fetchMaterials();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredMaterials(materials);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = materials.filter(m =>
        m.intent.toLowerCase().includes(term) ||
        m.question.toLowerCase().includes(term) ||
        (m.category && m.category.toLowerCase().includes(term))
      );
      setFilteredMaterials(filtered);
    }
  }, [searchTerm, materials]);

  const fetchMaterials = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:4000/api/pricing', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setMaterials(data);
      setFilteredMaterials(data);
    } catch (error) {
      console.error('Error fetching materials:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (material) => {
    setEditingId(material.id);
    setEditForm(material);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:4000/api/pricing/${editingId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        await fetchMaterials();
        setEditingId(null);
        setEditForm({});
      } else {
        alert('Failed to update material');
      }
    } catch (error) {
      console.error('Error saving material:', error);
      alert('Error saving material');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading materials...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Material Pricing Editor</h2>
        <p className="text-gray-600">Manage pricing and information for recyclable materials</p>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <input
          type="text"
          placeholder="🔍 Search materials..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <div className="mt-2 text-sm text-gray-600">
          Showing {filteredMaterials.length} of {materials.length} materials
        </div>
      </div>

      <div className="space-y-4">
        {filteredMaterials.map((material) => (
          <div key={material.id} className="bg-white rounded-lg shadow">
            <div className="p-6">
              {editingId === material.id ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Material Name</label>
                      <input
                        type="text"
                        value={editForm.intent || ''}
                        onChange={(e) => setEditForm({ ...editForm, intent: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <input
                        type="text"
                        value={editForm.category || ''}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                    <input
                      type="text"
                      value={editForm.question || ''}
                      onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Detailed Answer</label>
                    <textarea
                      value={editForm.answer_long || ''}
                      onChange={(e) => setEditForm({ ...editForm, answer_long: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows="4"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Voice Answer</label>
                    <textarea
                      value={editForm.answer_voice || ''}
                      onChange={(e) => setEditForm({ ...editForm, answer_voice: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows="2"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                      <input
                        type="number"
                        value={editForm.priority || 0}
                        onChange={(e) => setEditForm({ ...editForm, priority: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={editForm.active ? 'true' : 'false'}
                        onChange={(e) => setEditForm({ ...editForm, active: e.target.value === 'true' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md"
                    >
                      💾 Save Changes
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-md"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">{material.intent}</h3>
                      <p className="text-sm text-gray-600">{material.category}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        material.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {material.active ? '✓ Active' : '✗ Inactive'}
                      </span>
                      <button
                        onClick={() => startEditing(material)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
                      >
                        ✏️ Edit
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Question:</span>
                      <p className="text-gray-900">{material.question}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Answer:</span>
                      <p className="text-gray-900">{material.answer_long}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                      <div>
                        <span className="font-medium text-gray-700">Priority:</span>
                        <span className="ml-2 text-gray-900">{material.priority}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Last Updated:</span>
                        <span className="ml-2 text-gray-900">
                          {new Date(material.last_updated).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}