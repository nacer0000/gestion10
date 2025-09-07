from django.urls import path
from . import views

urlpatterns = [
    path('', views.ProduitListCreateView.as_view(), name='produit_list_create'),
    path('<int:pk>/', views.ProduitDetailView.as_view(), name='produit_detail'),
    path('import-dataset/', views.import_dataset, name='import_dataset'),
]