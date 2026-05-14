# 1. Subimos a Node 22 para cumplir con readdirp@5.0.0 (requiere >= 20.19.0)
FROM node:22-alpine

# 2. Instalamos herramientas de compilación (evita errores de better-sqlite3 y otros)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 3. Copiamos dependencias e instalamos
COPY package*.json ./
RUN npm install

# 4. Copiamos el resto del código
COPY . .

EXPOSE 3001

CMD ["npm", "start"]
