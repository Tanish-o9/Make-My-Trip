# Stage 1: Build the React application
FROM node:20-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve the built assets with Nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
# Copy default nginx configuration if needed, or rely on standard Nginx serving
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
