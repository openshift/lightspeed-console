FROM registry.access.redhat.com/ubi9/nodejs-20-minimal:latest AS build
USER root

ADD . /usr/src/app
WORKDIR /usr/src/app
RUN NODE_OPTIONS=--max-old-space-size=4096 npm ci --omit=dev --omit=optional --loglevel verbose --ignore-scripts --no-fund
RUN npm run build --loglevel verbose

FROM registry.access.redhat.com/ubi9/ubi-minimal:latest
USER 0

# Install nginx
RUN microdnf install -y nginx && microdnf clean all && rm -rf /var/cache/yum

COPY --from=build /usr/src/app/dist /usr/share/nginx/html

RUN mkdir -p /licenses
COPY --from=build /usr/src/app/LICENSE /licenses/LICENSE

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
