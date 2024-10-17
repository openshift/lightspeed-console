import { project } from "../views/netobserv"

export const netflowPage = {
    visit: () => {
        cy.clearLocalStorage()
        cy.intercept('**/backend/api/loki/flow/metrics*').as('call1')
        cy.visit('/netflow-traffic')
        // wait for all calls to complete before checking due to bug
        cy.wait('@call1', { timeout: 60000 }).wait('@call1')

        netflowPage.clearAllFilters()

        // set the page to auto refresh
        netflowPage.setAutoRefresh()

        cy.byTestID('no-results-found').should('not.exist')
        cy.get('#overview-container').should('exist')
    },
    visitDeveloper: () => {
        cy.clearLocalStorage()
        cy.switchPerspective('Developer');
        cy.visit(`/dev-monitoring/ns/${project}/netflow-traffic`)
    },
    toggleFullScreen: () => {
        cy.byTestID(genSelectors.moreOpts).should('exist').click().then(moreOpts => {
            cy.get(genSelectors.expand).click()
        })
    },
    setAutoRefresh: () => {
        cy.byTestID(genSelectors.refreshDrop).then(btn => {
            expect(btn).to.exist
            cy.wrap(btn).click().then(drop => {
                cy.get('[data-test="15s"]').should('exist').click()
            })
        })
    },
    stopAutoRefresh: () => {
        cy.byTestID(genSelectors.refreshDrop).then(btn => {
            expect(btn).to.exist
            cy.wrap(btn).click().then(drop => {
                cy.get('[data-test="OFF_KEY"]').should('exist').click()
            })
        })
    },
    resetClearFilters: () => {
        cy.byTestID('chips-more-options-button').should('exist').then(moreOpts => {
            cy.wrap(moreOpts).click({ force: true })
            cy.byTestID("reset-filters-button").should('exist').click({ force: true })
        })
    },
    clearAllFilters: () => {
        cy.get('#chips-more-options-button').should('exist').click().then(moreOpts => {
            cy.contains("Clear all").should('exist').click()
        })
    },
    waitForLokiQuery: () => {
        cy.get("#refresh-button > span > svg").invoke('attr', 'style').should('contain', '0s linear 0s')
    },
    selectSourceNS: (project) => {
        cy.byTestID("column-filter-toggle").click().get('.pf-c-dropdown__menu').should('be.visible')
        // verify Source namespace filter
        cy.byTestID('group-0-toggle').should('exist').byTestID('src_namespace').click()
        cy.byTestID('autocomplete-search').type(project + '{enter}{enter}')
        cy.get('#filters div.custom-chip > p').should('contain.text', `${project}`)
    }
}

export const topologyPage = {
    selectScopeGroup: (scope: any, group: any) => {
        cy.contains('Display options').should('exist').click()
        if (scope) {
            cy.byTestID("scope-dropdown").click().byTestID(scope).click()
        }
        if (group) {
            cy.wait(5000)
            cy.byTestID("group-dropdown").click().byTestID(group).click()
        }
        cy.contains('Display options').should('exist').click()
    },
    isViewRendered: () => {
        cy.get('[data-surface="true"]').should('exist')
    }
}

export namespace genSelectors {
    export const timeDrop = "time-range-dropdown-dropdown"
    export const refreshDrop = "refresh-dropdown-dropdown"
    export const refreshBtn = 'refresh-button'
    export const moreOpts = 'more-options-button'
    export const FullScreen = 'fullscreen-button'
    export const expand = '[index="2"] > ul > li > .pf-c-dropdown__menu-item'
}

export namespace colSelectors {
    export const mColumns = '#view-options-dropdown > ul > section:nth-child(1) > ul > li > a'
    export const columnsModal = '.modal-content'
    export const save = 'columns-save-button'
    export const resetDefault = 'columns-reset-button'
    export const Mac = '[data-test=th-Mac] > .pf-c-table__button'
    export const gK8sOwner = '[data-test=th-K8S_OwnerObject] > .pf-c-table__button'
    export const gIPPort = '[data-test=th-AddrPort] > .pf-c-table__button'
    export const Protocol = '[data-test=th-Proto] > .pf-c-table__button'
    export const ICMPType = '[data-test=th-IcmpType] > .pf-c-table__button'
    export const ICMPCode = '[data-test=th-IcmpCode] > .pf-c-table__button'
    export const srcNodeIP = '[data-test=th-SrcK8S_HostIP] > .pf-c-table__button'
    export const srcNS = '[data-test=th-SrcK8S_Namespace] > .pf-c-table__button'
    export const dstNodeIP = '[data-test=th-DstK8S_HostIP] > .pf-c-table__button'
    export const direction = '[data-test=th-FlowDirection] > .pf-c-table__button'
    export const bytes = '[data-test=th-Bytes] > .pf-c-table__button'
    export const packets = '[data-test=th-Packets] > .pf-c-table__button'
    export const RecordType = '[data-test=th-RecordType] > .pf-c-table__button'
    export const conversationID = '[data-test=th-_HashId] > .pf-c-table__button'
    export const flowRTT = '[data-test=th-TimeFlowRttMs] > .pf-c-table__button'
    export const DSCP = '[data-test=th-Dscp] > .pf-c-table__button'
    export const DNSLatency = '[data-test=th-DNSLatency] > .pf-c-table__column-help > .pf-c-table__button'
    export const DNSResponseCode = '[data-test=th-DNSResponseCode] > .pf-c-table__column-help > .pf-c-table__button'
    export const DNSId = '[data-test=th-DNSId] > .pf-c-table__button'
    export const DNSError = '[data-test=th-DNSErrNo] > .pf-c-table__button'
    export const SrcZone = '[data-test=th-SrcZone] > .pf-c-table__button'
    export const DstZone = '[data-test=th-DstZone] > .pf-c-table__button'
    export const ClusterName = '[data-test=th-ClusterName] > .pf-c-table__button'
}

export namespace exportSelectors {
    export const overviewExport = '#view-options-dropdown > ul > section:nth-child(2) > ul > li > a'
    export const avgBytesRatesDropdown = '#top_avg_byte_rates div:nth-child(3) button'
    export const tableExport = '#view-options-dropdown > ul > section:nth-child(2) > ul > li > a'
    export const exportButton = '[data-test=export-button]'
    export const closeButton = '[data-test=export-close-button]'
    export const topologyExport = '#view-options-dropdown > ul > section:nth-child(1) > ul > li > a'
}

export namespace filterSelectors {
    export const filterGroupText = '.custom-chip > p'
}

export namespace querySumSelectors {
    export const queryStatsPanel = "#query-summary"
    export const flowsCount = "#flowsCount"
    export const bytesCount = "#bytesCount"
    export const packetsCount = "#packetsCount"
    export const bpsCount = "#bytesPerSecondsCount"
    export const avgRTT = "#rttAvg"
    export const dnsAvg = "#dnsAvg"
    export const droppedBytesCount = "#pktDropBytesCount"
    export const droppedBpsCount = "#pktDropBytesPerSecondsCount"
    export const droppedPacketsCount = "#pktDropPacketsCount"
    export const expandedQuerySummaryPanel = '.pf-c-drawer__panel-main'
}

export namespace topologySelectors {
    export const metricsDrop = 'metricFunction-dropdown'
    export const metricsList = '#metricFunction > ul > li'
    export const optsClose = '.pf-c-drawer__close > .pf-c-button'
    export const nGroups = '[data-layer-id="groups"] > g'
    export const group = 'g[data-type="group"]'
    export const node = 'g[data-kind="node"]:empty'
    export const edge = 'g[data-kind="edge"]'
    export const groupLayer = '[data-layer-id="groups"]'
    export const defaultLayer = '[data-layer-id="default"]'
    export const groupToggle = '[for="group-collapsed-switch"] > .pf-c-switch__toggle'
    export const edgeToggle = "#edges-switch"
    export const labelToggle = '#edges-tag-switch'
    export const badgeToggle = '#badge-switch'
}

export namespace overviewSelectors {
    export const mPanels = '#view-options-dropdown > ul > section:nth-child(1) > ul > li > a'
    export const panelsModal = '.modal-content'
    export const resetDefault = 'panels-reset-button'
    export const save = 'panels-save-button'
    export const cancel = 'panels-cancel-button'
    export const typeDrop = 'type-dropdown'
    export const scopeDrop = 'scope-dropdown'
    export const truncateDrop = 'truncate-dropdown'
    export const managePanelsList = ['Top X average bytes rates (donut)', 'Top X bytes rates stacked with total (bars and lines)', 'Top X average packets rates (donut)', 'Top X packets rates stacked with total (bars and lines)']
    export const managePacketDropPanelsList = ['Top X packet dropped state stacked with total (donut or bars and lines)', 'Top X packet dropped cause stacked with total (donut or bars and lines)', 'Top X average dropped bytes rates (donut)', 'Top X dropped bytes rates stacked with total (bars and lines)', 'Top X average dropped packets rates (donut)', 'Top X dropped packets rates stacked with total (bars and lines)']
    export const manageDNSTrackingPanelsList = ['Top X DNS response code with total (donut or bars and lines)', 'Top X average DNS latencies with overall (donut or lines)', 'Bottom X minimum DNS latencies with overall (donut or lines)', 'Top X maximum DNS latencies with overall (donut or lines)', 'Top X 90th percentile DNS latencies with overall (donut or lines)']
    export const manageFlowRTTPanelsList = ['Top X average TCP smoothed Round Trip Time with overall (donut or lines)', 'Bottom X minimum TCP smoothed Round Trip Time with overall (donut or lines)', 'Top X maximum TCP smoothed Round Trip Time with overall (donut or lines)', 'Top X 90th percentile TCP smoothed Round Trip Time with overall (donut or lines)', 'Top X 99th percentile TCP smoothed Round Trip Time with overall (donut or lines)']
    export const defaultPanels = ['Top 5 average bytes rates', 'Top 5 bytes rates stacked with total']
    export const defaultPacketDropPanels = ['Top 5 packet dropped state stacked with total', 'Top 5 packet dropped cause stacked with total', 'Top 5 average dropped packets rates', 'Top 5 dropped packets rates stacked with total']
    export const defaultDNSTrackingPanels = ['Top 5 DNS response code', 'Top 5 average DNS latencies with overall', 'Top 5 90th percentile DNS latencies']
    export const defaultFlowRTTPanels = ['Top 5 average TCP smoothed Round Trip Time with overall', 'Bottom 5 minimum TCP smoothed Round Trip Time', 'Top 5 90th percentile TCP smoothed Round Trip Time']
    export const allPanels = defaultPanels.concat(['Top 5 average packets rates', 'Top 5 packets rates'])
    export const allPacketDropPanels = defaultPacketDropPanels.concat(['Top 5 average dropped bytes rates', 'Top 5 dropped bytes rates stacked with total'])
    export const allDNSTrackingPanels = defaultDNSTrackingPanels.concat(['Bottom 5 minimum DNS latencies', 'Top 5 maximum DNS latencies'])
    export const allFlowRTTPanels = defaultFlowRTTPanels.concat(['Top 5 maximum TCP smoothed Round Trip Time', 'Top 5 99th percentile TCP smoothed Round Trip Time'])
}

export const loadTimes = {
    "overview": 8500,
    "table": 5000,
    "topology": 5000
}

export const memoryUsage = {
    "overview": 300,
    "table": 450,
    "topology": 360
}

export namespace histogramSelectors {
    export const timeRangeContainer = "#chart-histogram > div.pf-l-flex.pf-m-row.histogram-range-container"
    export const zoomin = timeRangeContainer + " > div:nth-child(5) > div > div:nth-child(2) > button"
    export const zoomout = timeRangeContainer + "> div:nth-child(5) > div > div:nth-child(1) > button"
    const forwardShift = timeRangeContainer + "> div:nth-child(4)"
    export const singleRightShift = forwardShift + "> button:nth-child(1)"
    export const doubleRightShift = forwardShift + "> button:nth-child(2)"
    const backwardShift = timeRangeContainer + "> div:nth-child(2)"
    export const singleLeftShift = backwardShift + "> button:nth-child(2)"
    export const doubleLeftShift = backwardShift + "> button:nth-child(1)"
}

Cypress.Commands.add('showAdvancedOptions', () => {
    cy.get('#show-view-options-button')
        .then(function ($button) {
            if ($button.text() === 'Hide advanced options') {
                return;
            } else {
                cy.get('#show-view-options-button').click();
            }
        })
});

Cypress.Commands.add('checkPanelsNum', (panels = 2) => {
    cy.get('#overview-flex').find('.overview-card').its('length').should('eq', panels);
});

Cypress.Commands.add('checkPanel', (panelName) => {
    for (let i = 0; i < panelName.length; i++) {
        cy.get('#overview-flex', { timeout: 60000 }).contains(panelName[i]);
        cy.get('[data-test-metrics]').its('length').should('gt', 0);
    }
});

Cypress.Commands.add('openPanelsModal', () => {
    cy.showAdvancedOptions();
    cy.get('#view-options-button').click();
    cy.get(overviewSelectors.mPanels).click().then(panel => {
        cy.get(overviewSelectors.panelsModal).should('exist')
    })
});

Cypress.Commands.add('checkPopupItems', (id, names) => {
    for (let i = 0; i < names.length; i++) {
        cy.get(id).contains(names[i])
            .closest('.pf-c-data-list__item-row').find('.pf-c-data-list__check');
    }
});

Cypress.Commands.add('selectPopupItems', (id, names) => {
    for (let i = 0; i < names.length; i++) {
        cy.get(id).contains(names[i])
            .closest('.pf-c-data-list__item-row').find('.pf-c-data-list__check').click();
    }
});

Cypress.Commands.add('checkQuerySummary', (metric) => {
    let warningExists = false
    let num = 0
    let metricStr: string
    cy.get(querySumSelectors.queryStatsPanel).should('exist').then(qrySum => {
        if (Cypress.$(querySumSelectors.queryStatsPanel + ' svg.query-summary-warning').length > 0) {
            warningExists = true
        }
    })
    if (warningExists) {
        metricStr = metric.text().split('+ ')[0]
        if (metricStr.includes('k')) {
            num = Number(metricStr.split('k')[0])
        }
        else {
            num = Number(metricStr)
        }
    }
    else {
        num = Number(metric.text().split(' ')[0])
    }
    expect(num).to.be.greaterThan(0)
});

Cypress.Commands.add('changeQueryOption', (name) => {
    cy.get('#filter-toolbar-search-filters').contains('Query options').click();
    cy.get('#query-options-dropdown').contains(name).click();
    cy.get('#filter-toolbar-search-filters').contains('Query options').click();
});

Cypress.Commands.add('visitNetflowTrafficTab', (page) => {
    cy.visit(page)
    cy.get('[role="gridcell"]').eq(0).should('exist').within(() => {
        cy.get('a').should('exist').click()
    })
    cy.byLegacyTestID('horizontal-link-Network Traffic').should('exist').click()

    // validate netflow-traffic page shows values
    cy.checkNetflowTraffic()
});

Cypress.Commands.add('checkNetflowTraffic', (loki = "Enabled") => {
    // overview panels
    cy.get('li.overviewTabButton').should('exist').click()
    netflowPage.setAutoRefresh()
    cy.wait(2000)
    cy.checkPanel(overviewSelectors.defaultPanels)

    // table view
    if (loki == "Disabled") {
        // verify netflow traffic page is disabled
        cy.get('li.tableTabButton > button').should('exist').should('have.class', 'pf-m-aria-disabled')
    }
    else if (loki == "Enabled") {
        cy.get('li.tableTabButton').should('exist').click()
        cy.wait(1000)
        cy.byTestID("table-composable", { timeout: 60000 }).should('exist')
    }

    // topology view
    cy.get('li.topologyTabButton').should('exist').click()
    cy.wait(2000)
    cy.get('#drawer', { timeout: 60000 }).should('not.be.empty')
});

declare global {
    namespace Cypress {
        interface Chainable {
            showAdvancedOptions(): Chainable<Element>
            checkPanelsNum(panels?: number): Chainable<Element>
            checkPanel(panelName: string[]): Chainable<Element>
            openPanelsModal(): Chainable<Element>
            selectPopupItems(id: string, names: string[]): Chainable<Element>
            checkPopupItems(id: string, names: string[]): Chainable<Element>
            checkQuerySummary(metric: JQuery<HTMLElement>): Chainable<Element>
            checkPerformance(page: string, loadTime: number, memoryUsage: number): Chainable<Element>
            changeQueryOption(name: string): Chainable<Element>
            visitNetflowTrafficTab(page: string): Chainable<Element>
            checkNetflowTraffic(loki?: string): Chainable<Element>
        }
    }
}
