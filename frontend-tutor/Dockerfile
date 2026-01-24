# Étape 1 : Construction 
FROM node:22-alpine AS build-stage

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
# Compile le code Vue vers le dossier /dist
RUN npm run build

# Étape 2 : Serveur Web 
FROM nginx:alpine AS production-stage


COPY --from=build-stage /app/dist /usr/share/nginx/html


COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]