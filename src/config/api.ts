const API_BASE_URL = 'http://localhost:8000/api';

// Configuration de l'API
export const apiConfig = {
  baseURL: API_BASE_URL,
  timeout: 10000,
};

// Fonction utilitaire pour normaliser les réponses API
export const normalizeApiResponse = (response: any): any[] => {
  // Si c'est déjà un tableau, le retourner tel quel
  if (Array.isArray(response)) {
    return response;
  }
  
  // Si c'est une réponse paginée Django avec 'results'
  if (response && typeof response === 'object' && Array.isArray(response.results)) {
    return response.results;
  }
  
  // Si c'est un objet avec une propriété 'data' qui est un tableau
  if (response && typeof response === 'object' && Array.isArray(response.data)) {
    return response.data;
  }
  
  // Si c'est un objet unique, le mettre dans un tableau
  if (response && typeof response === 'object') {
    return [response];
  }
  
  // Par défaut, retourner un tableau vide
  return [];
};

// Helper pour les requêtes authentifiées
const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Helper pour les requêtes JSON
const getJsonHeaders = () => ({
  ...getAuthHeaders(),
  'Content-Type': 'application/json',
});

// Fonction pour rafraîchir le token
const refreshToken = async (): Promise<string | null> => {
  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh }),
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('access_token', data.access);
      return data.access;
    }
  } catch (error) {
    console.error('Erreur lors du rafraîchissement du token:', error);
  }

  return null;
};

// Fonction générique pour les requêtes API avec retry automatique
export const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const makeRequest = async (headers: Record<string, string>) => {
    const defaultOptions: RequestInit = {
      headers,
      ...options,
    };

    const response = await fetch(url, defaultOptions);
    
    if (response.status === 401) {
      // Essayer de rafraîchir le token
      const newToken = await refreshToken();
      if (newToken) {
        // Retry avec le nouveau token
        const newHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
        const retryResponse = await fetch(url, { ...defaultOptions, headers: newHeaders });
        
        if (retryResponse.status === 401) {
          // Token refresh a échoué, rediriger vers login
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
          throw new Error('Session expirée');
        }
        
        return retryResponse;
      } else {
        // Pas de refresh token, rediriger vers login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        throw new Error('Session expirée');
      }
    }
    
    return response;
  };

  try {
    const response = await makeRequest(getJsonHeaders());
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || errorData.detail || `Erreur HTTP: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return data;
    }
    
    return response;
  } catch (error) {
    console.error('Erreur API:', error);
    throw error;
  }
};

// API endpoints
export const endpoints = {
  // Auth
  login: '/auth/login/',
  logout: '/auth/logout/',
  refresh: '/auth/refresh/',
  currentUser: '/auth/me/',
  users: '/auth/users/',
  
  // Products
  products: '/products/',
  
  // Stores
  stores: '/stores/',
  
  // Suppliers
  suppliers: '/suppliers/',
  
  // Stock
  stocks: '/stock/stocks/',
  movements: '/stock/mouvements/',
  orders: '/stock/commandes/',
  
  // Attendance
  attendance: '/attendance/presences/',
  plannings: '/planning/plannings/',
  
  // Messaging
  messages: '/messaging/messages/',
  
  // Dataset import
  importDataset: '/products/import-dataset/',
};