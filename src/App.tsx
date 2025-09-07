import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './components/LoginPage';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { MagasinsPage } from './components/admin/MagasinsPage';
import { UtilisateursPage } from './components/admin/UtilisateursPage';
import { PresencesPage } from './components/admin/PresencesPage';
import { ParametresPage } from './components/admin/ParametresPage';
import { ProduitsViewPage } from './components/admin/ProduitsViewPage';
import { StockManagementPage } from './components/admin/StockManagementPage';
import { ManagerDashboard } from './components/manager/ManagerDashboard';
import { ManagerProduitsPage } from './components/manager/ManagerProduitsPage';
import { ManagerStockPage } from './components/manager/ManagerStockPage';
import { ManagerFournisseursPage } from './components/manager/ManagerFournisseursPage';
import { ManagerPresencesPage } from './components/manager/ManagerPresencesPage';
import { ManagerUtilisateursPage } from './components/manager/ManagerUtilisateursPage';
import { PlanningPage } from './components/manager/PlanningPage';
import { EmployeDashboard } from './components/employe/EmployeDashboard';
import { StockPage } from './components/employe/StockPage';
import { PointagePage } from './components/employe/PointagePage';
import { PlanningViewPage } from './components/employe/PlanningViewPage';
import { MapPage } from './components/admin/MapPage';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Layout>
                  <Routes>
                    <Route path="dashboard" element={<AdminDashboard />} />
                    <Route path="magasins" element={<MagasinsPage />} />
                    <Route path="carte" element={<MapPage />} />
                    <Route path="utilisateurs" element={<UtilisateursPage />} />
                    <Route path="stocks" element={<StockManagementPage />} />
                    <Route path="presences" element={<PresencesPage />} />
                    <Route path="parametres" element={<ParametresPage />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/manager/*"
            element={
              <ProtectedRoute allowedRoles={['manager']}>
                <Layout>
                  <Routes>
                    <Route path="dashboard" element={<ManagerDashboard />} />
                    <Route path="produits" element={<ManagerProduitsPage />} />
                    <Route path="stocks" element={<ManagerStockPage />} />
                    <Route path="fournisseurs" element={<ManagerFournisseursPage />} />
                    <Route path="presences" element={<ManagerPresencesPage />} />
                    <Route path="utilisateurs" element={<ManagerUtilisateursPage />} />
                    <Route path="planning" element={<PlanningPage />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/employe/*"
            element={
              <ProtectedRoute allowedRoles={['employe']}>
                <Layout>
                  <Routes>
                    <Route path="dashboard" element={<EmployeDashboard />} />
                    <Route path="stock" element={<StockPage />} />
                    <Route path="pointage" element={<PointagePage />} />
                    <Route path="planning" element={<PlanningViewPage />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/"
            element={
              user ? (
                user.role === 'admin' ? (
                  <Navigate to="/admin/dashboard" replace />
                ) : (
                  user.role === 'manager' ? (
                    <Navigate to="/manager/dashboard" replace />
                  ) : (
                    <Navigate to="/employe/dashboard" replace />
                  )
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </Router>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10B981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#EF4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </>
  );
}

export default App;