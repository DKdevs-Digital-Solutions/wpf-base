FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/data/jobs/pending /app/data/jobs/processing /app/data/jobs/completed /app/data/jobs/failed

EXPOSE 3005

CMD ["npm", "start"]
