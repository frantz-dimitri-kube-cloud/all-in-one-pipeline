# ==========================================
# Étape 1 : Build de l'application React
# ==========================================
FROM node:22-slim AS builder

WORKDIR /app

# Optimisation du cache des dépendances
COPY package*.json ./
RUN npm install

# Copie du code source et build de production
COPY . .
RUN npm run build

# ==========================================
# Étape 2 : Image d'exécution Nginx (légère)
# ==========================================
FROM nginx:alpine

# Copie de la configuration Nginx optimisée pour React Router (SPA)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copie des fichiers statiques générés lors du build
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
