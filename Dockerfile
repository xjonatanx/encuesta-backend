# 1. Usamos Node 22 para evitar errores de "Unsupported engine"
FROM node:22-alpine

# 2. Instalamos herramientas de compilación necesarias para módulos nativos (C++)
# better-sqlite3 y node-gyp necesitan python3, make y g++
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 3. Copiamos archivos de dependencias
COPY package*.json ./

# 4. Instalamos dependencias (ahora con herramientas de compilación disponibles)
RUN npm install

# 5. Copiamos el resto del código
COPY . .

# 6. Exponemos el puerto del backend
EXPOSE 3001

# 7. Comando de inicio
CMD ["npm", "start"]
