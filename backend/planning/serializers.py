from rest_framework import serializers
from .models import Planning

class PlanningSerializer(serializers.ModelSerializer):
    user_email = serializers.SerializerMethodField()
    user_nom = serializers.SerializerMethodField()
    user_prenom = serializers.SerializerMethodField()
    magasin_nom = serializers.SerializerMethodField()
    created_by_email = serializers.SerializerMethodField()

    class Meta:
        model = Planning
        fields = [
            'id', 'user', 'user_email', 'user_nom', 'user_prenom', 'magasin', 'magasin_nom', 
            'date', 'heure_debut', 'heure_fin', 'tache', 'notes', 'created_by', 
            'created_by_email', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at', 'created_by_email', 
                           'user_email', 'user_nom', 'user_prenom', 'magasin_nom']

    def get_user_email(self, obj):
        return obj.user.email if obj.user else None
    
    def get_user_nom(self, obj):
        return obj.user.nom if obj.user else None
    
    def get_user_prenom(self, obj):
        return obj.user.prenom if obj.user else None
    
    def get_magasin_nom(self, obj):
        return obj.magasin.nom if obj.magasin else None

    def get_created_by_email(self, obj):
        return obj.created_by.email if obj.created_by else None
