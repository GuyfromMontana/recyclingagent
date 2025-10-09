import { useState, useEffect } from 'react';
import Dashboard from './components/admin/Dashboard';
import PricingEditor from './components/admin/PricingEditor';
import KnowledgeEditor from './components/admin/KnowledgeEditor';
import CallLogs from './components/admin/CallLogs';
import Login from './components/admin/Login';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      // Verify the token is still valid
      fetch('http://localhost:4000/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => {
          if (res.ok) {
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userEmail');
          }
        })
        .catch(() => {
          localStorage.removeItem('authToken');
          localStorage.removeItem('userEmail');
        })
        .finally(() => {
          setIsCheckingAuth(false);
        });
    } else {
      setIsCheckingAuth(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    setIsAuthenticated(false);
    setCurrentPage('dashboard');
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">♻️</div>
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Render the main app if authenticated
  const renderPage = () => {
    switch (currentPage) {
      case 'pricing':
        return <PricingEditor />;
      case 'knowledge':
        return <KnowledgeEditor />;
      case 'call-logs':
        return <CallLogs />;
      default:
        return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  const userEmail = localStorage.getItem('userEmail');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-gray-800">
                ♻️ Axmen Recycling Admin
              </h1>
              
              <div className="hidden md:flex space-x-1">
                <button
                  onClick={() => setCurrentPage('dashboard')}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    currentPage === 'dashboard'
                      ? 'bg-green-100 text-green-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  📊 Dashboard
                </button>
                <button
                  onClick={() => setCurrentPage('pricing')}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    currentPage === 'pricing'
                      ? 'bg-green-100 text-green-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  💰 Material Pricing
                </button>
                <button
                  onClick={() => setCurrentPage('knowledge')}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    currentPage === 'knowledge'
                      ? 'bg-green-100 text-green-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  📚 Knowledge Base
                </button>
                <button
                  onClick={() => setCurrentPage('call-logs')}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    currentPage === 'call-logs'
                      ? 'bg-green-100 text-green-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  📞 Call Logs
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                👤 {userEmail}
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm font-medium"
              >
                🚪 Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="md:hidden bg-white border-b border-gray-200 px-4 py-2">
        <select
          value={currentPage}
          onChange={(e) => setCurrentPage(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="dashboard">📊 Dashboard</option>
          <option value="pricing">💰 Material Pricing</option>
          <option value="knowledge">📚 Knowledge Base</option>
          <option value="call-logs">📞 Call Logs</option>
        </select>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderPage()}
      </main>
    </div>
  );
}
