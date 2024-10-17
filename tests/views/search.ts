export const searchPage = {
  navToSearchPage: () => cy.visit('/search/all-namespaces'),
  chooseResourceType: (resource_type) => {
    cy.get('button[aria-label="Options menu"]').click();
    cy.get('input[type="search"]').clear().type(`${resource_type}`);
    cy.get(`input[id$="~${resource_type}"]`).click();
  },
  checkNoMachineResources: () => {
    searchPage.navToSearchPage();
    cy.get('button[class*=c-select__toggle]').click();
    cy.get('[placeholder="Select Resource"]').type("machine");
    const machineResources = ['MMachine','MAMachineAutoscaler','MCMachineConfig','MCPMachineConfigPool','MHCMachineHealthCheck','MSMachineSet'];
    machineResources.forEach((machineResource) => {
      cy.get(`[data-filter-text=${machineResource}]`).should('not.exist');
    });
  },
  clearAllFilters: () => {
    cy.byButtonText('Clear all filters').click({force: true});
  },
  searchMethodValues: (method, value) => {
    cy.get('button[id="toggle-id"]').click();
    cy.get(`button[name="${method}"]`).click();
    cy.get('input[id="search-filter-input"]').clear().type(`${value}`);
  },
  searchBy: (text) => {
    cy.get('input[data-test-id="item-filter"]').clear().type(`${text}`)
  },
}
