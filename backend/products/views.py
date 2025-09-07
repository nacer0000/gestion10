from rest_framework import generics, permissions, status
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.decorators import api_view, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
import pandas as pd
import io
from .models import Produit
from .serializers import ProduitSerializer
import logging

logger = logging.getLogger(__name__)

class ProduitListCreateView(generics.ListCreateAPIView):
    serializer_class = ProduitSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['categorie', 'fournisseur']
    search_fields = ['nom', 'reference', 'categorie']
    ordering_fields = ['nom', 'prix_unitaire', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        qs = Produit.objects.all()
        # Si le user est rattaché à un magasin (manager), filtrer
        if hasattr(user, 'magasin') and user.magasin is not None and not user.is_superuser:
            return qs.filter(magasin=user.magasin)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        magasin = None
        if hasattr(user, 'magasin') and user.magasin is not None and not user.is_superuser:
            magasin = user.magasin
        serializer.save(magasin=magasin)


class ProduitDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Produit.objects.all()
    serializer_class = ProduitSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def update(self, request, *args, **kwargs):
        try:
            partial = kwargs.pop('partial', False)
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            produit = serializer.save()
            logger.info(f"Produit modifié avec succès: {produit.nom}")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Erreur lors de la modification du produit: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def import_dataset(request):
    """
    Import de dataset CSV/Excel pour créer produits, fournisseurs et stocks
    """
    try:
        user = request.user
        if not hasattr(user, 'role') or user.role not in ['manager', 'admin']:
            return Response({'error': "Seuls les managers et admins peuvent importer des datasets."}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        if not hasattr(user, 'magasin') or not user.magasin:
            return Response({'error': "Utilisateur non assigné à un magasin."}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES.get('file')
        if not file:
            return Response({'error': "Aucun fichier fourni."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Lire le fichier selon son type
        try:
            if file.name.endswith('.csv'):
                df = pd.read_csv(io.StringIO(file.read().decode('utf-8')))
            elif file.name.endswith(('.xlsx', '.xls')):
                df = pd.read_excel(file)
            else:
                return Response({'error': "Format de fichier non supporté. Utilisez CSV ou Excel."}, 
                              status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f"Erreur lors de la lecture du fichier: {str(e)}"}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        # Vérifier les colonnes requises
        required_columns = ['nom', 'reference', 'categorie', 'prix', 'seuil_alerte', 'fournisseur', 'stock']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            return Response({'error': f"Colonnes manquantes: {', '.join(missing_columns)}"}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        # Statistiques d'import
        stats = {
            'produits_created': 0,
            'produits_updated': 0,
            'fournisseurs_created': 0,
            'stocks_created': 0,
            'stocks_updated': 0,
            'errors': []
        }
        
        from suppliers.models import Fournisseur
        from stock.models import Stock
        
        for index, row in df.iterrows():
            try:
                # 1. Gérer le fournisseur
                fournisseur_obj = None
                if pd.notna(row['fournisseur']) and row['fournisseur'].strip():
                    fournisseur_nom = row['fournisseur'].strip()
                    fournisseur_obj, created = Fournisseur.objects.get_or_create(
                        nom=fournisseur_nom,
                        magasin=user.magasin,
                        defaults={
                            'adresse': 'Adresse à compléter',
                            'contact': 'Contact à compléter'
                        }
                    )
                    if created:
                        stats['fournisseurs_created'] += 1
                
                # 2. Gérer le produit
                produit_data = {
                    'nom': row['nom'].strip(),
                    'reference': row['reference'].strip(),
                    'categorie': row['categorie'].strip(),
                    'prix_unitaire': float(row['prix']) if pd.notna(row['prix']) else 0,
                    'seuil_alerte': int(row['seuil_alerte']) if pd.notna(row['seuil_alerte']) else 0,
                    'fournisseur': fournisseur_obj,
                    'magasin': user.magasin
                }
                
                # Vérifier si le produit existe déjà
                existing_produit = Produit.objects.filter(
                    reference=produit_data['reference'],
                    magasin=user.magasin
                ).first()
                
                if existing_produit:
                    # Mettre à jour le produit existant
                    for key, value in produit_data.items():
                        if key != 'reference':  # Ne pas changer la référence
                            setattr(existing_produit, key, value)
                    existing_produit.save()
                    produit_obj = existing_produit
                    stats['produits_updated'] += 1
                else:
                    # Créer un nouveau produit
                    produit_obj = Produit.objects.create(**produit_data)
                    stats['produits_created'] += 1
                
                # 3. Gérer le stock
                if pd.notna(row['stock']) and int(row['stock']) > 0:
                    stock_quantity = int(row['stock'])
                    
                    existing_stock = Stock.objects.filter(
                        produit=produit_obj,
                        magasin=user.magasin
                    ).first()
                    
                    if existing_stock:
                        # Ajouter au stock existant
                        existing_stock.quantite += stock_quantity
                        existing_stock.save()
                        stats['stocks_updated'] += 1
                    else:
                        # Créer un nouveau stock
                        Stock.objects.create(
                            produit=produit_obj,
                            magasin=user.magasin,
                            quantite=stock_quantity
                        )
                        stats['stocks_created'] += 1
                
            except Exception as e:
                error_msg = f"Ligne {index + 2}: {str(e)}"
                stats['errors'].append(error_msg)
                logger.error(f"Erreur import ligne {index + 2}: {str(e)}")
        
        return Response({
            'message': 'Import terminé',
            'stats': stats
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Erreur import dataset: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)