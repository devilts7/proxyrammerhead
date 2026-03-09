FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install dotenv-flow && npm install && npm run build

COPY . .

ENV HOST=0.0.0.0
ENV PORT=8080
ENV CROSS_PORT=8081
ENV WORKERS=1

EXPOSE 8080
EXPOSE 8081

CMD ["node", "run.js"]
