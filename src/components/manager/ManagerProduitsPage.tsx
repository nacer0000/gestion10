import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Edit, Trash2, Search, Package, AlertTriangle, Save, X, Upload } from 'lucide-react';
import { productsService, suppliersService, stockService } from '../../services/api';
import { normalizeApiResponse } from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import { Produit, Fournisseur } from '../../types';
import { ImageUpload } from '../ImageUpload';
import { DatasetImport } from './DatasetImport';
import toast from 'react-hot-toast';

export const ManagerProduitsPage: React.FC = () => {
  const { user } = useAuth();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDatasetModal, setShowDatasetModal] = useState(false);
  const [editingProduit, setEditingProduit] = useState<Produit | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    reference: '',
    categorie: '',
    prix_unitaire: 0,
    seuil_alerte: 0,

    fournisseur: '',
    image: null as File | null
  });

  // DEBUG : Afficher user à chaque rendu
  useEffect(() => {
    console.log('[ManagerProduitsPage] user:', user);
    if (user?.magasin_id) {
      fetchProduits();
      fetchFournisseurs();
    }
  }, [user]);

  const fetchProduits = async () => {
    try {
      setLoading(true);
      
      // Récupérer les données depuis l'API directement
      const data = await productsService.getProducts();
      const normalizedData = normalizeApiResponse(data);
      
      // Filtrer les produits du magasin du manager
      const produitsMagasin = normalizedData.filter((item: any) => {
        if (!user?.magasin_id) return false;
        return (
          item.magasin === user.magasin_id ||
          item.magasin === user.magasin ||
          item.magasin_id === user.magasin_id ||
          item.magasin_id === user.magasin
        );
      });

      const formattedProduits = produitsMagasin.map((item: any) => ({
        ...item,
        createdAt: item.created_at ? new Date(item.created_at) : new Date(),
        // S'assurer que tous les champs nécessaires sont présents
        id: item.id,
        nom: item.nom || '',
        reference: item.reference || '',
        categorie: item.categorie || '',
        prix_unitaire: parseFloat(item.prix_unitaire) || 0,
        seuil_alerte: parseInt(item.seuil_alerte) || 0,
        fournisseur_id: item.fournisseur_id || item.fournisseur || null,
        image_url: item.image_url || null
      }));

      setProduits(formattedProduits);
      
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
      toast.error('Erreur lors du chargement des produits');
      setProduits([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFournisseurs = async () => {
    try {
      const data = await suppliersService.getSuppliers();
      const normalizedData = normalizeApiResponse(data);
      // Filtrer les fournisseurs selon le magasin du manager
      const fournisseursMagasin = normalizedData.filter((item: any) => {
        return item.magasin_id?.toString() === user?.magasin_id?.toString();
      });
      setFournisseurs(fournisseursMagasin.map((item: any) => ({
        ...item,
        createdAt: item.created_at ? new Date(item.created_at) : new Date()
      })));
    } catch (error) {
      console.error('Erreur lors du chargement des fournisseurs:', error);
      toast.error('Erreur lors du chargement des fournisseurs');
    }
  };

  const clearCache = () => {
    // Fonction supprimée car on n'utilise plus le cache
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Ajout du magasin du manager connecté
      const produitData = {
        ...formData,
        magasin: user?.magasin_id || user?.magasin,
        image: formData.image
      };

      if (editingProduit) {
        await productsService.updateProduct(editingProduit.id, produitData);
        toast.success('Produit modifié avec succès');
      } else {
        await productsService.createProduct(produitData);
        toast.success('Produit ajouté avec succès');
      }

      // Vider le cache pour forcer le refresh
      clearCache();
      resetForm();
      
      // Recharger les données après ajout/modification
      await fetchProduits();
      
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde : ' + (error?.message || error));
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour recharger les données après import
  const handleDatasetImportComplete = async () => {
    setShowDatasetModal(false);
    await fetchProduits();
    await fetchFournisseurs();
  };

  const handleEdit = (produit: Produit) => {
    setEditingProduit(produit);
    setFormData({
      nom: produit.nom || '',
      reference: produit.reference || '',
      categorie: produit.categorie || '',
      prix_unitaire: produit.prix_unitaire || 0,
      seuil_alerte: produit.seuil_alerte || 0,
  
      fournisseur: produit.fournisseur_id || '',
      image: null
    });
    setShowModal(true);
  };

  const handleDelete = async (produit: Produit) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) return;

    try {
      await productsService.deleteProduct(produit.id);
      toast.success('Produit supprimé avec succès');
      
      // Recharger les données après suppression
      await fetchProduits();
      
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      reference: '',
      categorie: '',
      prix_unitaire: 0,
      seuil_alerte: 0,

      fournisseur: '',
      image: null
    });
    setEditingProduit(null);
    setShowModal(false);
  };

  const filteredProduits = Array.isArray(produits) ? produits.filter(produit =>
    (produit.nom || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (produit.reference || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (produit.categorie || '').toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  if (loading && produits.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion des Produits</h1>
          <p className="text-gray-600 mt-1">Gérez les produits de votre magasin</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Nouveau Produit</span>
          </button>
          <button
            onClick={() => setShowDatasetModal(true)}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2"
          >
            <Upload className="h-5 w-5" />
            <span>Charger Dataset</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Rechercher par nom, référence ou catégorie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProduits.map((produit) => {
          const fournisseur = fournisseurs.find(f => f.id === produit.fournisseur_id);
          return (
            <div key={produit.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
              {/* Image */}
              <div className="h-48 bg-gray-100 relative">
                {produit.image_url ? (
                  <img
                    src={`http://localhost:8000${produit.image_url}`}
                    alt={produit.nom}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`w-full h-full flex items-center justify-center ${produit.image_url ? 'hidden' : ''}`}>
                  <Package className="h-16 w-16 text-gray-400" />
                </div>
                
                <div className="absolute top-2 right-2 flex space-x-1">
                  <button
                    onClick={() => handleEdit(produit)}
                    className="p-2 bg-white rounded-full shadow-md hover:bg-gray-50 transition-colors duration-200"
                  >
                    <Edit className="h-4 w-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => handleDelete(produit)}
                    className="p-2 bg-white rounded-full shadow-md hover:bg-gray-50 transition-colors duration-200"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                </div>
                
                {produit.seuil_alerte > 0 && (
                  <div className="absolute top-2 left-2">
                    <div className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium flex items-center">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Seuil: {produit.seuil_alerte}
                    </div>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 text-lg mb-2">{produit.nom}</h3>
                <p className="text-sm text-gray-600 mb-3">Réf: {produit.reference}</p>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Catégorie:</span>
                    <span className="text-sm font-medium text-gray-900">{produit.categorie}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Prix:</span>
                    <span className="text-lg font-bold text-blue-600">
                      {(produit.prix_unitaire || 0).toLocaleString('fr-FR', {
                        style: 'currency',
                        currency: 'MAD'
                      })}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Seuil d'alerte:</span>
                    <span className="text-sm font-medium text-gray-900">{produit.seuil_alerte}</span>
                  </div>
                  
                  {fournisseur && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Fournisseur:</span>
                      <span className="text-sm font-medium text-gray-900">{fournisseur.nom}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredProduits.length === 0 && !loading && (
        <div className="text-center py-12">
          <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun produit trouvé</h3>
          <p className="text-gray-600">
            {searchTerm ? 'Aucun produit ne correspond à votre recherche.' : 'Commencez par ajouter votre premier produit.'}
          </p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingProduit ? 'Modifier le Produit' : 'Nouveau Produit'}
                </h2>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <ImageUpload
                  currentImage={editingProduit?.image_url ? `http://localhost:8000${editingProduit.image_url}` : undefined}
                  onImageChange={(file) => setFormData({ ...formData, image: file })}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nom du produit *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Référence *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.reference}
                      onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Catégorie *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.categorie}
                      onChange={(e) => setFormData({ ...formData, categorie: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Prix unitaire (MAD) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formData.prix_unitaire}
                      onChange={(e) => setFormData({ ...formData, prix_unitaire: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Seuil d'alerte
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.seuil_alerte}
                      onChange={(e) => setFormData({ ...formData, seuil_alerte: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>


                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fournisseur
                    </label>
                    <select
                      value={formData.fournisseur}
                      onChange={(e) => setFormData({ ...formData, fournisseur: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Sélectionner un fournisseur</option>
                      {fournisseurs.map((fournisseur) => (
                        <option key={fournisseur.id} value={fournisseur.id}>
                          {fournisseur.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200 flex items-center space-x-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>{editingProduit ? 'Modifier' : 'Ajouter'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Dataset Import Modal */}
      {showDatasetModal && (
        <DatasetImport onClose={handleDatasetImportComplete} />
      )}
    </div>
  );
};