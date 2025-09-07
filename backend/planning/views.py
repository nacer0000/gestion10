from rest_framework import generics, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Planning
from .serializers import PlanningSerializer

class PlanningListCreateView(generics.ListCreateAPIView):
    serializer_class = PlanningSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['user', 'date', 'magasin']
    ordering = ['-date', 'heure_debut']
    queryset = Planning.objects.all()

    def get_queryset(self):
        user = self.request.user
        
        # Admins peuvent voir tous les plannings
        if user.role == 'admin':
            return Planning.objects.all()
        
        # Managers peuvent voir les plannings de leur magasin
        elif user.role == 'manager':
            if user.magasin_id:
                return Planning.objects.filter(magasin_id=user.magasin_id)
            return Planning.objects.none()
        
        # Employés peuvent voir leurs propres plannings
        elif user.role == 'employe':
            return Planning.objects.filter(user=user)
        
        # Par défaut, aucun accès
        return Planning.objects.none()
    
    def perform_create(self, serializer):
        # Seuls les managers et admins peuvent créer des plannings
        user = self.request.user
        if user.role not in ['manager', 'admin']:
            raise PermissionError("Seuls les managers et admins peuvent créer des plannings")
        serializer.save(created_by=self.request.user)

class PlanningDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PlanningSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Planning.objects.all()
