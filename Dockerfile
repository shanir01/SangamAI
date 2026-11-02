FROM node:20-alpine
WORKDIR /app
COPY package.json router.config.json ./
COPY src ./src
COPY public ./public
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    STATE_FILE=/data/router.state.json \
    USERS_FILE=/data/users.json
EXPOSE 8787
# Mount a volume on /data to keep usage counters and user keys across restarts.
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
# The server refuses to start on 0.0.0.0 without MASTER_KEY:  docker run -e MASTER_KEY=... -e GROQ_API_KEY=... -p 8787:8787 freellm-router
CMD ["node", "src/server.js"]
