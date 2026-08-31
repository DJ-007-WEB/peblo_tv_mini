FROM node:22-alpine AS build
WORKDIR /app
COPY viewer/package*.json ./
RUN npm ci
COPY viewer/ ./
ARG VITE_API_BASE=http://localhost:8000
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
