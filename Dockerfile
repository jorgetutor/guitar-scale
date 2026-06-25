FROM node:24-alpine
WORKDIR /app
RUN corepack enable
EXPOSE 5173
