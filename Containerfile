FROM quay.io/sclorg/nodejs-20-minimal-c9s:latest AS builder

USER root

COPY . /opt/app-root/src

RUN npm install --prefix /opt/app-root/src && \
    npm run build --prefix /opt/app-root/src && \
    npm run setup

FROM quay.io/sclorg/nodejs-20-minimal-c9s:latest

COPY --from=builder /opt/app-root/src/node_modules /opt/app-root/src/node_modules
COPY --from=builder /opt/app-root/src/dist /opt/app-root/src/dist
COPY --from=builder /opt/app-root/src/assets /opt/app-root/src/assets
COPY --from=builder /opt/app-root/src/package.json /opt/app-root/src/package.json

CMD ["node", "/opt/app-root/src/dist/bundle/start.js"]