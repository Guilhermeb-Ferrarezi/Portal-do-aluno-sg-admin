# ---------- BUILD ----------
FROM node:22-alpine AS build

WORKDIR /app

# instala deps primeiro (cache)
COPY package.json package-lock.json ./
RUN npm ci

# copia o resto e builda
COPY . .
RUN npm run build


# ---------- RUN (NGINX) ----------
FROM nginx:alpine

# nginx SPA config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# copia build do Vite (dist)
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# health + roda nginx
CMD ["nginx", "-g", "daemon off;"]
