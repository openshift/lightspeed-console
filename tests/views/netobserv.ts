import { operatorHubPage } from "../views/operator-hub-page"
import { Pages } from "./pages"

export const project = "netobserv"

export namespace flowcollectorFormSelectors {
    export const ebpfPrivilegedToggle = '#root_spec_agent_ebpf_privileged_field > .pf-v5-c-switch > .pf-v5-c-switch__toggle'
    export const zonesToggle = '#root_spec_processor_addZone_field > .pf-v5-c-switch > .pf-v5-c-switch__toggle'
    export const multiClusterToggle = '#root_spec_processor_multiClusterDeployment_field > .pf-v5-c-switch > .pf-v5-c-switch__toggle'
    export const lokiEnableToggle = '#root_spec_loki_enable_field > .pf-v5-c-switch > .pf-v5-c-switch__toggle'
}

export const Operator = {
    name: () => {
        if (Cypress.env('noo_catalog_src') == "upstream") {
            return "NetObserv Operator"
        }
        else {
            return "Network Observability"
        }
    },
    install: (catalogSourceDisplayName: string) => {
        cy.visit(`/k8s/ns/openshift-netobserv-operator/operators.coreos.com~v1alpha1~ClusterServiceVersion`);
        // if user still does not have admin access
        // try few more times
        cy.contains("openshift-netobserv-operator").should('be.visible')
        cy.get("div.loading-box").should('be.visible').then(() => {
            for (let retries = 0; retries <= 15; retries++) {
                cy.get("div.loading-box").should('be.visible')
                if (Cypress.$('.co-disabled').length == 1) {
                    cy.log(`user does not have access ${retries}`)
                    cy.wait(5000)
                    cy.reload(true)
                }
                else {
                    break;
                }
            }
        })
        // don't install operator if its already installed
        cy.get("div.loading-box").should('be.visible').then(loading => {
            if (Cypress.$('td[role="gridcell"]').length == 0) {
                Pages.gotoOperatorHubPage();
                const catalogSourceSelectorCheckbox = `input[title="${catalogSourceDisplayName}"]`
                cy.get(catalogSourceSelectorCheckbox).check()
                operatorHubPage.install(Operator.name(), true)
            }
        })
    },
    enableAllMetrics: () => {
        // enable FLP metrics
        cy.get('#root_spec_processor_accordion-toggle').click()
        cy.get('#root_spec_processor_metrics_accordion-toggle').click()
        cy.get('#root_spec_processor_metrics_includeList_accordion-toggle').should('exist').click()
        cy.enableFLPMetrics([
            "node_flows_total",
            "node_ingress_bytes_total",
            "node_egress_bytes_total",
            "node_ingress_packets_total",
            "node_egress_packets_total",
            // enable all namespace metrics
            "namespace_flows_total",
            "namespace_ingress_bytes_total",
            "namespace_egress_bytes_total",
            "namespace_ingress_packets_total",
            "namespace_egress_packets_total",
            // enable all workload metrics
            "workload_flows_total",
            "workload_ingress_bytes_total",
            "workload_egress_bytes_total",
            "workload_ingress_packets_total",
            "workload_egress_packets_total"
        ]);
    },
    visitFlowcollector: () => {
        // this assumes Loki is already deployed in netobserv NS
        cy.visit('k8s/ns/openshift-netobserv-operator/operators.coreos.com~v1alpha1~ClusterServiceVersion')
        const selector = '[data-test-operator-row="' + Operator.name() + '"]'
        cy.get(selector).invoke('attr', 'href').then(href => {
            cy.visit(href)
        })

        cy.contains('Flow Collector').invoke('attr', 'href').then(href => {
            cy.visit(href)
        })
    },
    createFlowcollector: (namespace, parameters?: string) => {
        Operator.visitFlowcollector()
        cy.get('div.loading-box__loaded:nth-child(2)').should('exist')
        cy.wait(3000)
        cy.get("#yaml-create").should('exist').then(() => {
            if ((Cypress.$('td[role="gridcell"]').length > 0) && (parameters != null)) {
                Operator.deleteFlowCollector()
                // come back to flowcollector tab after deletion
                Operator.visitFlowcollector()
            }
        })
        // don't create flowcollector if already exists
        cy.get('div.loading-box:nth-child(1)').should('be.visible').then(() => {
            if (Cypress.$('td[role="gridcell"]').length == 0) {
                let cmd = `oc new-project ${namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} || oc project ${namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`
                cy.log(`Running command: ${cmd}`)
                cy.exec(cmd, { failOnNonZeroExit: false })
                // deploy loki
                cy.adminCLI(`oc apply -f ./fixtures/netobserv/loki.yaml -n ${namespace}`)
                cy.byTestID('item-create').should('exist').click()
                cy.get('#form').click() // bug in console where yaml view is default
                cy.get('#root_spec_agent_accordion-toggle').click()
                cy.get('#root_spec_agent_ebpf_accordion-toggle').click()

                if (parameters == "PacketDrop") {
                    Operator.enablePacketDrop()
                }
                if (parameters == "FlowRTT") {
                    Operator.enableFlowRTT()
                }
                if (parameters == "DNSTracking") {
                    Operator.enableDNSTracking()
                }
                if (parameters == "LokiDisabled") {
                    Operator.disableLoki()
                }
                if (parameters == "Conversations") {
                    Operator.enableConversations()
                }
                if (parameters == "ZonesAndMultiCluster") {
                    Operator.enableZonesAndMultiCluster()
                }
                if (parameters == "AllMetrics") {
                    Operator.enableAllMetrics()
                }
                if (parameters == "subnetLabels") {
                    Operator.enableSubnetLabels()
                }
                cy.get('#root_spec_agent_ebpf_sampling').clear().type('1')
                cy.get("#root_spec_agent_ebpf_accordion-content div.pf-v5-c-expandable-section > button").should('exist').click()
                cy.get("#root_spec_agent_ebpf_cacheActiveTimeout").should('exist').clear().type("15s")
                cy.byTestID('create-dynamic-form').click()
                cy.wait(5000)
                cy.byTestID('status-text').should('exist').should('contain.text', 'Ready')
                cy.byTestID('status-text').should('exist').should('contain.text', 'FLPMonolithReady')
                cy.byTestID('status-text').should('exist').should('contain.text', 'FLPParentReady')
                cy.byTestID('status-text').should('exist').should('contain.text', 'FlowCollectorLegacyReady')
                cy.byTestID('status-text').should('exist').should('contain.text', 'MonitoringReady')

                cy.byTestID('refresh-web-console', { timeout: 60000 }).should('exist')
                cy.reload(true)
            }
        })
    },
    enableEBPFFeature: (name: string) => {
        cy.get('#root_spec_agent_ebpf_features_accordion-toggle').click()
        cy.get('#root_spec_agent_ebpf_features_add-btn').click()
        cy.get('#root_spec_agent_ebpf_features_0').click().then(features => {
            cy.contains(name).should('exist')
            cy.get(`#${name}-link`).click()
        })
    },
    enablePacketDrop: () => {
        cy.get(flowcollectorFormSelectors.ebpfPrivilegedToggle).click()
        Operator.enableEBPFFeature("PacketDrop")
        // Deploy PacketDrop metrics to includeList
        cy.get('#root_spec_processor_accordion-toggle').click()
        cy.get('#root_spec_processor_metrics_accordion-toggle').click()
        cy.get('#root_spec_processor_metrics_includeList_accordion-toggle').should('exist').click()
        cy.enableFLPMetrics([
            "namespace_drop_bytes_total",
            "namespace_drop_packets_total",
            "node_drop_bytes_total",
            "node_drop_packets_total",
            "workload_drop_bytes_total",
            "workload_drop_packets_total"
        ]);
    },
    enableDNSTracking: () => {
        Operator.enableEBPFFeature("DNSTracking")
        // Deploy DNS metrics to includeList
        cy.get('#root_spec_processor_accordion-toggle').click()
        cy.get('#root_spec_processor_metrics_accordion-toggle').click()
        cy.get('#root_spec_processor_metrics_includeList_accordion-toggle').should('exist').click()
        cy.enableFLPMetrics([
            "namespace_dns_latency_seconds",
            "node_dns_latency_seconds",
            "workload_dns_latency_seconds"
        ]);
    },
    enableFlowRTT: () => {
        Operator.enableEBPFFeature("FlowRTT")
        // Deploy FlowRTT metrics to includeList
        cy.get('#root_spec_processor_accordion-toggle').click()
        cy.get('#root_spec_processor_metrics_accordion-toggle').click()
        cy.get('#root_spec_processor_metrics_includeList_accordion-toggle').should('exist').click()
        cy.enableFLPMetrics([
            "namespace_rtt_seconds",
            "node_rtt_seconds",
            "workload_rtt_seconds"
        ]);
    },
    disableLoki: () => {
        cy.get('#root_spec_loki_accordion-toggle').click()
        cy.get(flowcollectorFormSelectors.lokiEnableToggle).should('be.visible').click()
    },
    enableConversations: () => {
        cy.get('#root_spec_processor_accordion-toggle').click()
        cy.get('#root_spec_processor_logTypes').click().then(moreOpts => {
            cy.get('#All-link').click()
        })
    },
    enableSubnetLabels: () => {
        cy.get('#root_spec_processor_accordion-toggle').click()
        cy.get('#root_spec_processor_subnetLabels_accordion-toggle').click()
        cy.get('#root_spec_processor_subnetLabels_customLabels_accordion-toggle').click()
        cy.get('#root_spec_processor_subnetLabels_customLabels_add-btn').click()
        cy.get('#root_spec_processor_subnetLabels_customLabels_0_cidrs_accordion-toggle').click()
        cy.get('#root_spec_processor_subnetLabels_customLabels_0_cidrs_add-btn').click()
        cy.get('#root_spec_processor_subnetLabels_customLabels_0_cidrs_0').clear().type(`52.200.142.0/24`)
        cy.get('#root_spec_processor_subnetLabels_customLabels_0_name').clear().type(`testcustomlabel`)
    },
    enableZonesAndMultiCluster: () => {
        cy.get('#root_spec_processor_accordion-toggle').click()
        // Enable zones
        cy.get(flowcollectorFormSelectors.zonesToggle).click()
        // Enable multiCluster
        cy.get("#root_spec_processor_accordion-content div.pf-v5-c-expandable-section > button").should('exist').click()
        cy.get(flowcollectorFormSelectors.multiClusterToggle).click()
    },
    deleteFlowCollector: () => {
        cy.visit('k8s/all-namespaces/operators.coreos.com~v1alpha1~ClusterServiceVersion')
        cy.contains(Operator.name()).should('be.visible')
        cy.contains('Flow Collector').should('exist').invoke('attr', 'href').then(href => {
            cy.visit(href)
        })
        cy.byTestID('cluster').should('exist').invoke('attr', 'href').then(href => {
            cy.visit(href)
        })
        cy.byLegacyTestID('actions-menu-button').should('exist').click()
        cy.byTestActionID('Delete FlowCollector').should('exist').click()
        cy.byTestID('confirm-action').should('exist').click()
        cy.byTestID('refresh-web-console', { timeout: 60000 }).should('exist')
        cy.reload(true)
    },
    uninstall: () => {
        cy.visit('k8s/all-namespaces/operators.coreos.com~v1alpha1~ClusterServiceVersion')

        cy.contains(Operator.name()).should('exist').invoke('attr', 'href').then(href => {
            cy.visit(href)
        })
        cy.get('.co-actions-menu > .pf-c-dropdown__toggle').should('exist').click()
        cy.byTestActionID('Uninstall Operator').should('exist').click()
        cy.byTestID('confirm-action').should('exist').click()
    },
    deleteCatalogSource: (catalogSource: string) => {
        cy.visit('k8s/cluster/config.openshift.io~v1~OperatorHub/cluster/sources')
        cy.byTestID(catalogSource).should('exist').invoke('attr', 'href').then(href => {
            cy.visit(href)
        })
        cy.get('.co-actions-menu > .pf-c-dropdown__toggle').should('exist').click()
        cy.byTestActionID('Delete CatalogSource').should('exist').click()
        cy.byTestID('confirm-action').should('exist').click()
    }
}

Cypress.Commands.add('enableFLPMetrics', (tags: string[]) => {
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        cy.get('#root_spec_processor_metrics_includeList_add-btn').should('exist').click()
        cy.get(`#root_spec_processor_metrics_includeList_${i}`).should('exist').click().then(metrics => {
            cy.get(`#${tag}-link`).should('exist').click()
        })
    }
});

declare global {
    namespace Cypress {
        interface Chainable {
            enableFLPMetrics(tag: string[]): Chainable<Element>
        }
    }
}
