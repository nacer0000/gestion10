import React, { useState } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertTriangle, Package, Truck, Boxes } from 'lucide-react';
import { productsService, suppliersService, stockService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

interface DatasetRow {
  nom: string;
  reference: string;
  categorie: string;
  prix: number;
  seuil_alerte: number;
  fournisseur: string;
  stock: number;
}

interface ImportResult {
  produitsCreated: number;
  produitsUpdated: number;
  fournisseursCreated: number;
  stocksCreated: number;
  stocksUpdated: number;
  errors: string[];
}

export const DatasetImport: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState<DatasetRow[]>([]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Vérifier le type de fichier
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];

    if (!allowedTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(xlsx?|csv)$/i)) {
      toast.error('Veuillez sélectionner un fichier Excel (.xlsx, .xls) ou CSV');
      return;
    }

    setFile(selectedFile);
    parseFile(selectedFile);
  };

  const parseFile = async (file: File) => {
    try {
      setLoading(true);
      
      if (file.name.endsWith('.csv')) {
        await parseCSV(file);
      } else {
        await parseExcel(file);
      }
    } catch (error) {
      console.error('Erreur lors de l\'analyse du fichier:', error);
      toast.error('Erreur lors de l\'analyse du fichier');
    } finally {
      setLoading(false);
    }
  };

  const parseCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      toast.error('Le fichier CSV doit contenir au moins une ligne d\'en-tête et une ligne de données');
      return;
    }

    // Ignorer la première ligne (en-têtes)
    const dataLines = lines.slice(1);
    const parsedData: DatasetRow[] = [];

    dataLines.forEach((line, index) => {
      const columns = line.split(',').map(col => col.trim().replace(/"/g, ''));
      
      if (columns.length >= 7) {
        parsedData.push({
          nom: columns[0],
          reference: columns[1],
          categorie: columns[2],
          prix: parseFloat(columns[3]) || 0,
          seuil_alerte: parseInt(columns[4]) || 0,
          fournisseur: columns[5],
          stock: parseInt(columns[6]) || 0
        });
      }
    });

    setPreview(parsedData.slice(0, 5)); // Aperçu des 5 premiers
  };

  const parseExcel = async (file: File) => {
    // Pour Excel, on va utiliser une approche simplifiée
    // En production, vous pourriez utiliser une bibliothèque comme xlsx
    toast.info('Pour les fichiers Excel, veuillez les convertir en CSV pour le moment');
  };

  const processImport = async () => {
    if (!file || !user?.magasin_id) return;

    setLoading(true);
    const result: ImportResult = {
      produitsCreated: 0,
      produitsUpdated: 0,
      fournisseursCreated: 0,
      stocksCreated: 0,
      stocksUpdated: 0,
      errors: []
    };

    try {
      // Récupérer les données existantes
      const [existingProducts, existingSuppliers, existingStocks] = await Promise.all([
        productsService.getProducts(),
        suppliersService.getSuppliers(),
        stockService.getStocks()
      ]);

      // Parser le fichier complet
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const dataLines = lines.slice(1);

      for (const [index, line] of dataLines.entries()) {
        try {
          const columns = line.split(',').map(col => col.trim().replace(/"/g, ''));
          
          if (columns.length < 7) {
            result.errors.push(`Ligne ${index + 2}: Données incomplètes`);
            continue;
          }

          const rowData: DatasetRow = {
            nom: columns[0],
            reference: columns[1],
            categorie: columns[2],
            prix: parseFloat(columns[3]) || 0,
            seuil_alerte: parseInt(columns[4]) || 0,
            fournisseur: columns[5],
            stock: parseInt(columns[6]) || 0
          };

          // Validation des données
          if (!rowData.nom || !rowData.reference) {
            result.errors.push(`Ligne ${index + 2}: Nom et référence requis`);
            continue;
          }

          // 1. Gérer le fournisseur
          let fournisseurId = null;
          if (rowData.fournisseur) {
            const existingFournisseur = existingSuppliers.find(f => 
              f.nom.toLowerCase() === rowData.fournisseur.toLowerCase()
            );

            if (existingFournisseur) {
              fournisseurId = existingFournisseur.id;
            } else {
              // Créer le nouveau fournisseur
              try {
                const newFournisseur = await suppliersService.createSupplier({
                  nom: rowData.fournisseur,
                  adresse: 'Adresse à compléter',
                  contact: 'Contact à compléter',
                  magasin: user.magasin_id
                });
                fournisseurId = newFournisseur.id;
                existingSuppliers.push(newFournisseur);
                result.fournisseursCreated++;
              } catch (error) {
                result.errors.push(`Ligne ${index + 2}: Erreur création fournisseur - ${error.message}`);
                continue;
              }
            }
          }

          // 2. Gérer le produit
          const existingProduct = existingProducts.find(p => 
            p.reference.toLowerCase() === rowData.reference.toLowerCase()
          );

          let produitId = null;
          if (existingProduct) {
            // Mettre à jour le produit existant
            try {
              const updatedProduct = await productsService.updateProduct(existingProduct.id, {
                nom: rowData.nom,
                reference: rowData.reference,
                categorie: rowData.categorie,
                prix_unitaire: rowData.prix,
                seuil_alerte: rowData.seuil_alerte,
                fournisseur: fournisseurId,
                magasin: user.magasin_id
              });
              produitId = updatedProduct.id;
              result.produitsUpdated++;
            } catch (error) {
              result.errors.push(`Ligne ${index + 2}: Erreur mise à jour produit - ${error.message}`);
              continue;
            }
          } else {
            // Créer le nouveau produit
            try {
              const newProduct = await productsService.createProduct({
                nom: rowData.nom,
                reference: rowData.reference,
                categorie: rowData.categorie,
                prix_unitaire: rowData.prix,
                seuil_alerte: rowData.seuil_alerte,
                fournisseur: fournisseurId,
                magasin: user.magasin_id
              });
              produitId = newProduct.id;
              existingProducts.push(newProduct);
              result.produitsCreated++;
            } catch (error) {
              result.errors.push(`Ligne ${index + 2}: Erreur création produit - ${error.message}`);
              continue;
            }
          }

          // 3. Gérer le stock
          if (produitId && rowData.stock > 0) {
            try {
              const existingStock = existingStocks.find(s => 
                s.produit_id.toString() === produitId.toString() && 
                s.magasin_id.toString() === user.magasin_id.toString()
              );

              if (existingStock) {
                // Ajouter au stock existant
                const newQuantity = existingStock.quantite + rowData.stock;
                await stockService.updateStock(existingStock.id, {
                  produit: produitId,
                  magasin: user.magasin_id,
                  quantite: newQuantity
                });
                result.stocksUpdated++;
              } else {
                // Créer un nouveau stock
                await stockService.createStock({
                  produit: produitId,
                  magasin: user.magasin_id,
                  quantite: rowData.stock
                });
      console.log('Début de l\'import du dataset...');
      const response = await productsService.importDataset(file);
      console.log('Réponse de l\'import:', response);
      
      const result: ImportResult = {
        produitsCreated: response.stats?.produits_created || 0,
        produitsUpdated: response.stats?.produits_updated || 0,
        fournisseursCreated: response.stats?.fournisseurs_created || 0,
        stocksCreated: response.stats?.stocks_created || 0,
        stocksUpdated: response.stats?.stocks_updated || 0,
        errors: response.stats?.errors || []
      };

      setResult(result);
      
      if (result.errors.length === 0) {
        toast.success('Import terminé avec succès !');
      } else {
        toast.warning(`Import terminé avec ${result.errors.length} erreur(s)`);
      }

    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      toast.error('Erreur lors de l\'import du dataset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Charger Dataset</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {!result ? (
            <>
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-medium text-blue-800 mb-2">Format du fichier CSV</h3>
                <p className="text-blue-600 mb-3">
                  Votre fichier CSV doit contenir les colonnes suivantes dans cet ordre :
                </p>
                <div className="bg-white rounded p-3 font-mono text-sm">
                  <div className="grid grid-cols-7 gap-2 text-center font-bold border-b pb-2">
                    <span>Nom</span>
                    <span>Référence</span>
                    <span>Catégorie</span>
                    <span>Prix</span>
                    <span>Seuil Alerte</span>
                    <span>Fournisseur</span>
                    <span>Stock</span>
                  </div>
                  <div className="grid grid-cols-7 gap-2 text-center text-gray-600 pt-2">
                    <span>Produit A</span>
                    <span>REF001</span>
                    <span>Électronique</span>
                    <span>29.99</span>
                    <span>10</span>
                    <span>Fournisseur X</span>
                    <span>50</span>
                  </div>
                </div>
              </div>

              {/* Upload Area */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6">
                {file ? (
                  <div className="space-y-4">
                    <FileSpreadsheet className="h-16 w-16 text-green-600 mx-auto" />
                    <div>
                      <p className="text-lg font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setFile(null);
                        setPreview([]);
                      }}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Changer de fichier
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-900 mb-2">
                      Sélectionnez votre fichier dataset
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      Formats supportés: CSV (.csv)
                    </p>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="dataset-upload"
                    />
                    <label
                      htmlFor="dataset-upload"
                      className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Choisir un fichier
                    </label>
                  </div>
                )}
              </div>

              {/* Preview */}
              {preview.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">
                    Aperçu des données (5 premiers éléments)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Référence</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prix</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Seuil</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fournisseur</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {preview.map((row, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm text-gray-900">{row.nom}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{row.reference}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{row.categorie}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{row.prix} MAD</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{row.seuil_alerte}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{row.fournisseur}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{row.stock}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-4">
                <button
                  onClick={onClose}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                >
                  Annuler
                </button>
                <button
                  onClick={processImport}
                  disabled={!file || loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Import en cours...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Importer les données</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* Résultats de l'import */
            <div className="space-y-6">
              <div className="text-center">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Import terminé !</h3>
              </div>

              {/* Statistiques */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <Package className="h-8 w-8 text-blue-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-blue-600">Produits</p>
                      <p className="text-lg font-bold text-blue-900">
                        {result.produitsCreated} créés, {result.produitsUpdated} mis à jour
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <Truck className="h-8 w-8 text-orange-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-orange-600">Fournisseurs</p>
                      <p className="text-lg font-bold text-orange-900">
                        {result.fournisseursCreated} créés
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <Boxes className="h-8 w-8 text-green-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-600">Stocks</p>
                      <p className="text-lg font-bold text-green-900">
                        {result.stocksCreated} créés, {result.stocksUpdated} mis à jour
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Erreurs */}
              {result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                    <h4 className="text-lg font-medium text-red-800">
                      Erreurs rencontrées ({result.errors.length})
                    </h4>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {result.errors.map((error, index) => (
                      <p key={index} className="text-sm text-red-600 mb-1">
                        • {error}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};