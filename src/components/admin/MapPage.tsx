import React, { useState, useEffect } from 'react';
import { MapPin, Store, Navigation, Eye, AlertCircle } from 'lucide-react';
import { storesService } from '../../services/api';
import { Magasin } from '../../types';
import toast from 'react-hot-toast';

// Composant de carte interactive avec tous les magasins
const StoresMap: React.FC<{
  stores: Magasin[];
  selectedStore: Magasin | null;
  onStoreSelect: (store: Magasin) => void;
}> = ({ stores, selectedStore, onStoreSelect }) => {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);

  useEffect(() => {
    if (!mapRef.current) return;

    const L = (window as any).L;
    if (!L) {
      console.error('Leaflet n\'est pas chargé');
      return;
    }

    // Calculer le centre de la carte basé sur tous les magasins
    let centerLat = 33.5731; // Casablanca par défaut
    let centerLng = -7.5898;
    
    if (stores.length > 0) {
      const avgLat = stores.reduce((sum, store) => sum + store.latitude, 0) / stores.length;
      const avgLng = stores.reduce((sum, store) => sum + store.longitude, 0) / stores.length;
      centerLat = avgLat;
      centerLng = avgLng;
    }

    console.log('🗺️ Initialisation carte avec centre:', { centerLat, centerLng });

    const mapInstance = L.map(mapRef.current, {
      center: [centerLat, centerLng],
      zoom: stores.length > 1 ? 10 : 15,
      zoomControl: true,
      attributionControl: true
    });

    // Ajout des tuiles OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(mapInstance);

    setMap(mapInstance);

    // Cleanup
    return () => {
      if (mapInstance) {
        mapInstance.remove();
      }
    };
  }, []);

  // Gestion des marqueurs
  useEffect(() => {
    if (!map) return;

    const L = (window as any).L;
    
    // Supprimer les anciens marqueurs
    markers.forEach(marker => {
      map.removeLayer(marker);
    });

    // Ajouter les nouveaux marqueurs
    const newMarkers: any[] = [];
    
    stores.forEach((store) => {
      const isSelected = selectedStore?.id === store.id;
      
      // Créer une icône personnalisée
      const icon = L.divIcon({
        html: `
          <div class="relative">
            <div class="w-8 h-8 ${isSelected ? 'bg-red-500' : 'bg-blue-500'} rounded-full border-2 border-white shadow-lg flex items-center justify-center">
              <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"></path>
              </svg>
            </div>
            ${isSelected ? '<div class="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-red-500"></div>' : ''}
          </div>
        `,
        className: 'custom-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      });

      const marker = L.marker([store.latitude, store.longitude], { icon })
        .addTo(map)
        .bindPopup(`
          <div class="p-2">
            <h3 class="font-bold text-lg mb-2">${store.nom}</h3>
            <p class="text-sm text-gray-600 mb-2">${store.adresse}</p>
            <div class="text-xs text-gray-500">
              <p>Lat: ${store.latitude.toFixed(6)}</p>
              <p>Lng: ${store.longitude.toFixed(6)}</p>
            </div>
          </div>
        `);

      marker.on('click', () => {
        onStoreSelect(store);
      });

      newMarkers.push(marker);
    });

    setMarkers(newMarkers);

    // Ajuster la vue pour inclure tous les marqueurs
    if (stores.length > 1) {
      const group = new L.featureGroup(newMarkers);
      map.fitBounds(group.getBounds().pad(0.1));
    }

  }, [map, stores, selectedStore, onStoreSelect]);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-full rounded-lg"
      style={{ minHeight: '500px' }}
    />
  );
};

export const MapPage: React.FC = () => {
  const [stores, setStores] = useState<Magasin[]>([]);
  const [selectedStore, setSelectedStore] = useState<Magasin | null>(null);
  const [loading, setLoading] = useState(true);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // Chargement de Leaflet
  useEffect(() => {
    if ((window as any).L) {
      setLeafletLoaded(true);
      return;
    }

    const loadLeaflet = () => {
      // CSS
      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(cssLink);

      // JavaScript
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => {
        console.log('✅ Leaflet chargé');
        setLeafletLoaded(true);
      };
      document.head.appendChild(script);
    };

    loadLeaflet();
  }, []);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const data = await storesService.getStores();
      const formattedStores = data.map((item: any) => ({
        ...item,
        createdAt: new Date(item.created_at)
      }));
      setStores(formattedStores);
      
      // Sélectionner le premier magasin par défaut
      if (formattedStores.length > 0) {
        setSelectedStore(formattedStores[0]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des magasins:', error);
      toast.error('Erreur lors du chargement des magasins');
    } finally {
      setLoading(false);
    }
  };

  const handleStoreSelect = (store: Magasin) => {
    setSelectedStore(store);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Carte des Magasins</h1>
        <p className="text-gray-600 mt-1">Vue d'ensemble géographique de tous vos magasins</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Store className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Magasins</p>
              <p className="text-2xl font-bold text-gray-900">{stores.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <MapPin className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Magasin Sélectionné</p>
              <p className="text-lg font-bold text-gray-900">
                {selectedStore?.nom || 'Aucun'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Navigation className="h-8 w-8 text-purple-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Coordonnées</p>
              <p className="text-sm font-bold text-gray-900">
                {selectedStore ? `${selectedStore.latitude.toFixed(4)}, ${selectedStore.longitude.toFixed(4)}` : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Liste des magasins */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Store className="h-5 w-5 mr-2" />
              Liste des Magasins ({stores.length})
            </h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {stores.length > 0 ? (
              stores.map((store) => (
                <button
                  key={store.id}
                  onClick={() => handleStoreSelect(store)}
                  className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200 ${
                    selectedStore?.id === store.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {store.image_url ? (
                        <img
                          src={`http://localhost:8000${store.image_url}`}
                          alt={store.nom}
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Store className="h-6 w-6 text-blue-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {store.nom}
                      </h4>
                      <p className="text-xs text-gray-500 truncate">
                        {store.adresse}
                      </p>
                      <div className="flex items-center mt-1">
                        <MapPin className="h-3 w-3 text-gray-400 mr-1" />
                        <span className="text-xs text-gray-400">
                          {store.latitude.toFixed(4)}, {store.longitude.toFixed(4)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-8 text-center">
                <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Aucun magasin disponible</p>
                <p className="text-xs text-gray-400 mt-1">Ajoutez des magasins pour les voir sur la carte</p>
              </div>
            )}
          </div>
        </div>

        {/* Carte */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <MapPin className="h-5 w-5 mr-2" />
              Carte Interactive
            </h3>
          </div>
          <div className="h-[500px] relative">
            {leafletLoaded && stores.length > 0 ? (
              <StoresMap
                stores={stores}
                selectedStore={selectedStore}
                onStoreSelect={handleStoreSelect}
              />
            ) : leafletLoaded && stores.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <div className="text-center">
                  <Store className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">Aucun magasin à afficher</p>
                  <p className="text-sm text-gray-500 mt-2">Ajoutez des magasins pour les voir sur la carte</p>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-gray-600">Chargement de la carte...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Détails du magasin sélectionné */}
      {selectedStore && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-medium text-gray-900 flex items-center">
                <Eye className="h-6 w-6 mr-2 text-blue-600" />
                Détails du Magasin
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Image et informations de base */}
              <div className="space-y-4">
                <div className="h-48 bg-gray-100 rounded-lg overflow-hidden">
                  {selectedStore.image_url ? (
                    <img
                      src={`http://localhost:8000${selectedStore.image_url}`}
                      alt={selectedStore.nom}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Store className="h-16 w-16 text-gray-400" />
                    </div>
                  )}
                </div>
                
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">{selectedStore.nom}</h4>
                  <div className="flex items-start space-x-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <p className="text-sm text-gray-600">{selectedStore.adresse}</p>
                  </div>
                </div>
              </div>

              {/* Informations techniques */}
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-gray-900 mb-3">Coordonnées GPS</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Latitude:</span>
                      <span className="text-sm font-mono text-gray-900">{selectedStore.latitude.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Longitude:</span>
                      <span className="text-sm font-mono text-gray-900">{selectedStore.longitude.toFixed(6)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-gray-900 mb-3">Informations</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Date de création:</span>
                      <span className="text-sm text-gray-900">
                        {selectedStore.createdAt.toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">ID:</span>
                      <span className="text-sm font-mono text-gray-900">{selectedStore.id}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      const url = `https://www.google.com/maps?q=${selectedStore.latitude},${selectedStore.longitude}`;
                      window.open(url, '_blank');
                    }}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center space-x-2"
                  >
                    <Navigation className="h-4 w-4" />
                    <span>Ouvrir dans Google Maps</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {stores.length === 0 && !loading && (
        <div className="text-center py-12">
          <Store className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun magasin disponible</h3>
          <p className="text-gray-600">
            Ajoutez des magasins dans la section "Magasins" pour les voir apparaître sur la carte.
          </p>
        </div>
      )}
    </div>
  );
};