from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/products/', include('products.urls')),
    path('api/stores/', include('stores.urls')),
    path('api/suppliers/', include('suppliers.urls')),
    path('api/stock/', include('stock.urls')),
    path('api/attendance/', include('attendance.urls')),
    path('planning/', include('planning.urls')),
    path('api/planning/', include('planning.urls')),
    path('api/messaging/', include('messaging.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)