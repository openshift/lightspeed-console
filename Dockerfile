FROM registry.access.redhat.com/ubi9/nodejs-22-minimal:latest AS build
USER root

WORKDIR /usr/src/app

# Copy only package files first for better layer caching
COPY package.json package-lock.json ./

RUN NODE_OPTIONS=--max-old-space-size=4096 npm ci --omit=dev --omit=optional --ignore-scripts --no-fund

COPY console-extensions.json LICENSE tsconfig.json types.d.ts webpack.config.ts ./
COPY locales ./locales
COPY src ./src
RUN npm run build

FROM registry.access.redhat.com/ubi9/ubi-minimal:latest
USER 0

RUN microdnf install -y nginx && microdnf clean all

COPY --from=build /usr/src/app/dist /usr/share/nginx/html

RUN mkdir -p /licenses
COPY --from=build /usr/src/app/LICENSE /licenses/LICENSE

# Create nginx temp directory and set permissions for OpenShift
RUN mkdir -p /tmp/nginx && \
    chgrp -R 0 /var/log/nginx /var/lib/nginx /usr/share/nginx/html /tmp/nginx && \
    chmod -R g=u /var/log/nginx /var/lib/nginx /usr/share/nginx/html /tmp/nginx

LABEL name="openshift-lightspeed/lightspeed-console-plugin-rhel9" \
      cpe="cpe:/a:redhat:openshift_lightspeed:1::el9" \
      com.redhat.component="openshift-lightspeed" \
      io.k8s.display-name="OpenShift Lightspeed Console" \
      summary="OpenShift Lightspeed Console provides OCP console plugin for OpenShift Lightspeed Service" \
      description="OpenShift Lightspeed Console provides OCP console plugin for OpenShift Lightspeed Service" \
      io.k8s.description="OpenShift Lightspeed Console is a component of OpenShift Lightspeed" \
      io.openshift.tags="openshift-lightspeed,ols"

USER 1001

ENTRYPOINT ["nginx", "-g", "daemon off;", "-e", "stderr"]
