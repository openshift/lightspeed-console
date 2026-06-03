FROM registry.access.redhat.com/ubi9/nodejs-22-minimal:latest AS build-pf5
USER root
WORKDIR /usr/src/app
COPY branches/pf5/package.json branches/pf5/package-lock.json ./
RUN NODE_OPTIONS=--max-old-space-size=4096 npm ci --omit=dev --omit=optional --ignore-scripts --no-fund
COPY branches/pf5/console-extensions.json branches/pf5/LICENSE branches/pf5/tsconfig.json branches/pf5/types.d.ts branches/pf5/webpack.config.ts ./
COPY branches/pf5/locales ./locales
COPY branches/pf5/src ./src
RUN npm run build

FROM registry.access.redhat.com/ubi9/nodejs-22-minimal:latest AS build-4-19
USER root
WORKDIR /usr/src/app
COPY branches/4-19/package.json branches/4-19/package-lock.json ./
RUN NODE_OPTIONS=--max-old-space-size=4096 npm ci --omit=dev --omit=optional --ignore-scripts --no-fund
COPY branches/4-19/console-extensions.json branches/4-19/LICENSE branches/4-19/tsconfig.json branches/4-19/types.d.ts branches/4-19/webpack.config.ts ./
COPY branches/4-19/locales ./locales
COPY branches/4-19/src ./src
RUN npm run build

FROM registry.access.redhat.com/ubi9/nodejs-22-minimal:latest AS build-main
USER root
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN NODE_OPTIONS=--max-old-space-size=4096 npm ci --omit=dev --omit=optional --ignore-scripts --no-fund
COPY console-extensions.json LICENSE tsconfig.json types.d.ts webpack.config.ts ./
COPY locales ./locales
COPY src ./src
RUN npm run build

FROM registry.access.redhat.com/ubi9-minimal@sha256:83006d535923fcf1345067873524a3980316f51794f01d8655be55d6e9387183
USER 0

RUN microdnf install -y nginx && microdnf clean all

COPY --from=build-pf5 /usr/src/app/dist /builds/pf5
COPY --from=build-4-19 /usr/src/app/dist /builds/4-19
COPY --from=build-main /usr/src/app/dist /builds/main

RUN mkdir -p /licenses
COPY --from=build-main /usr/src/app/LICENSE /licenses/LICENSE

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN rm -rf /usr/share/nginx/html && \
    mkdir -p /tmp/nginx && \
    chgrp -R 0 /var/log/nginx /var/lib/nginx /tmp/nginx /builds && \
    chmod -R g=u /var/log/nginx /var/lib/nginx /tmp/nginx /builds && \
    chgrp 0 /usr/share/nginx && chmod g=u /usr/share/nginx

LABEL name="openshift-lightspeed/lightspeed-console-plugin-rhel9" \
      cpe="cpe:/a:redhat:openshift_lightspeed:1::el9" \
      com.redhat.component="openshift-lightspeed" \
      io.k8s.display-name="OpenShift Lightspeed Console" \
      summary="OpenShift Lightspeed Console provides OCP console plugin for OpenShift Lightspeed Service" \
      description="OpenShift Lightspeed Console provides OCP console plugin for OpenShift Lightspeed Service" \
      io.k8s.description="OpenShift Lightspeed Console is a component of OpenShift Lightspeed" \
      io.openshift.tags="openshift-lightspeed,ols" \
      konflux.additional-tags="latest"

USER 1001

ENTRYPOINT ["/entrypoint.sh"]
