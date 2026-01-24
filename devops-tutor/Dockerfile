# Étape 1 : Build
FROM node:18-alpine AS builder

WORKDIR /app


COPY package*.json ./
RUN npm install


COPY . .
RUN npm run build

# Étape 2 : Run 
FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./

# Le backend écoute sur le port 3000
EXPOSE 3000

# Commande de démarrage en production
CMD ["npm", "run", "start:prod"]