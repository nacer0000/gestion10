import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Package, Store, Users, AlertTriangle, TrendingUp, DollarSign, Calendar } from 'lucide-react';
import { productsService, storesService, authService, stockService } from '../../services/api';
import { normalizeApiResponse } from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import { Produit, Stock, User } from '../../types';
import { safeNumber } from '../../utils/numbers';

// Fonction pour formater les nombres
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return num.toString();
};

export const ManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [magasinNom, setMagasinNom] = useState<string>('');
  const [stats, setStats] = useState({
    totalProduits: 0,
    totalEmployes: 0,
    alertesStock: 0,
    valeurTotaleStock: 0
  });
  const [stockData, setStockData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.magasin_id) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user?.magasin_id) return;

    try {
      setLoading(true);
      setError(null);
      
      const results = await Promise.allSettled([
        productsService.getProducts(),
        authService.getUsers(),
        stockService.getStocks(),
        storesService.getStores()
      ]);

      const produitsResponse = results[0].status === 'fulfilled' ? results[0].value : [];
      const utilisateursResponse = results[1].status === 'fulfilled' ? results[1].value : [];
      const stocksResponse = results[2].status === 'fulfilled' ? results[2].value : [];
      const magasinsResponse = results[3].status === 'fulfilled' ? results[3].value : [];

      // Récupérer le nom du magasin
      const magasins = normalizeApiResponse(magasinsResponse || []);
      const currentMagasin = magasins.find((m: any) => m.id.toString() === user.magasin_id?.toString());
      setMagasinNom(currentMagasin?.nom || 'Magasin inconnu');

      const produits = normalizeApiResponse(produitsResponse || []).map((item: any) => ({
        ...item,
        id: Number(item.id),
        prix_unitaire: safeNumber(item.prix_unitaire, 0),
        seuil_alerte: safeNumber(item.seuil_alerte, 0),
        createdAt: new Date(item.created_at || Date.now())
      })) as Produit[];

      const utilisateurs = normalizeApiResponse(utilisateursResponse || []).map((item: any) => ({
        ...item,
        id: Number(item.id),
        createdAt: new Date(item.date_joined || item.created_at || Date.now())
      })) as User[];

      const stocks = normalizeApiResponse(stocksResponse || []).map((item: any) => ({
        ...item,
        id: Number(item.id),
        quantite: safeNumber(item.quantite, 0),
        produit_id: Number(item.produit_id || item.product || item.produit),
        magasin_id: Number(item.magasin_id || item.magasin || item.store),
        updatedAt: new Date(item.updated_at || item.updatedAt || Date.now())
      })).filter(stock => 
        !isNaN(stock.produit_id) && 
        !isNaN(stock.magasin_id) && 
        stock.produit_id > 0 && 
        stock.magasin_id > 0 &&
        Number(stock.magasin_id) === Number(user.magasin_id)
      ) as Stock[];

      // Employés du magasin
      const employesDuMagasin = utilisateurs.filter(u => 
        u.role === 'employe' && u.magasin_id === user.magasin_id
      );

      let alertesCount = 0;
      let valeurTotale = 0;
      const stockDataMap = new Map<string, number>();

      const produitsMap = new Map(produits.map(p => [Number(p.id), p]));

      stocks.forEach((stock) => {
        const produit = produitsMap.get(Number(stock.produit_id));
        
        if (produit) {
          const quantite = safeNumber(stock.quantite, 0);
          const prixUnitaire = safeNumber(produit.prix_unitaire, 0);
          const seuilAlerte = safeNumber(produit.seuil_alerte, 0);
          
          if (quantite <= seuilAlerte) {
            alertesCount++;
          }
          
          const valeurStock = quantite * prixUnitaire;
          valeurTotale += valeurStock;
          
          const categorie = produit.categorie || 'Autre';
          const currentQuantite = stockDataMap.get(categorie) || 0;
          stockDataMap.set(categorie, currentQuantite + quantite);
        }
      });

      const stockChartData = Array.from(stockDataMap.entries())
        .map(([categorie, quantite]) => ({
          categorie,
          quantite: safeNumber(quantite, 0)
        }))
        .sort((a, b) => b.quantite - a.quantite);

      const finalStats = {
        totalProduits: stocks.length,
        totalEmployes: employesDuMagasin.length,
        alertesStock: alertesCount,
        valeurTotaleStock: safeNumber(valeurTotale, 0)
      };

      setStats(finalStats);
      setStockData(stockChartData);

    } catch (error) {
      console.error('❌ Erreur lors du chargement des données:', error);
      setError('Erreur lors du chargement des données. Veuillez rafraîchir la page.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        <div className="ml-4">
          <p className="text-lg font-medium text-gray-900">Chargement du dashboard...</p>
          <p className="text-sm text-gray-500">Récupération des données en cours</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <p className="text-lg font-medium text-red-900 mb-2">Erreur de chargement</p>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => fetchDashboardData()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Manager</h1>
          <p className="text-lg text-blue-600 font-medium mt-1">Magasin: {magasinNom}</p>
        </div>
        <div className="text-sm text-gray-500">
          Dernière mise à jour: {new Date().toLocaleString('fr-FR')}
        </div>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Produits en stock</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalProduits)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Employés</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalEmployes)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Alertes Stock</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.alertesStock)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Valeur Stock</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(stats.valeurTotaleStock)} MAD
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Stock par Catégorie
          </h3>
          {stockData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stockData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="categorie" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value) => [formatNumber(Number(value)), 'Quantité']}
                  labelFormatter={(label) => `Catégorie: ${label}`}
                />
                <Bar dataKey="quantite" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Aucune donnée de stock disponible</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Répartition des Stocks</h3>
          {stockData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stockData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ categorie, percent }) => `${categorie} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="quantite"
                >
                  {stockData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [formatNumber(Number(value)), 'Quantité']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Aucune donnée de stock disponible</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};