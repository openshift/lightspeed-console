export const getEditorContent = () =>
  cy.window().then((win: any) => win.monaco.editor.getModels()[0].getValue()); // eslint-disable-line @typescript-eslint/no-explicit-any

export const setEditorContent = (text: string) =>
  cy.window().then((win: any) => win.monaco.editor.getModels()[0].setValue(text)); // eslint-disable-line @typescript-eslint/no-explicit-any

// Initially yamlEditor loads with all grey text, finished loading when editor is color coded
// class='mtk26' is the light blue color of property such as 'apiVersion'
export const isLoaded = () => cy.get("[class='mtk26']").should('exist');
// Since yaml editor class mtk26 is a font class it doesn't work on an import page with no text
// adding a check for the 1st line number, AND providing a wait allowed the load of the full component
export const isImportLoaded = () => {
  cy.wait(5000);
  cy.get('.monaco-editor textarea:first').should('exist');
};
export const clickSaveCreateButton = () => cy.byTestID('save-changes').click();
export const clickCancelButton = () => cy.byTestID('cancel').click();
export const clickReloadButton = () => cy.byTestID('reload-object').click();

export const listPage = {
  filter: {
    byName: (name: string) => {
      cy.byTestID('name-filter-input').clear().type(name);
    },
  },
  rows: {
    clickFirst: () => {
      cy.get('a.co-resource-item__resource-name').eq(0).click();
    },
    countShouldBe: (count: number) => {
      cy.get('[data-test-rows="resource-row"]').should('have.length', count);
    },
    countShouldBeWithin: (min: number, max: number) => {
      cy.get('[data-test-rows="resource-row"]').should('have.length.within', min, max);
    },
    shouldBeLoaded: () => {
      cy.get('[data-test-rows="resource-row"]').should('be.visible');
    },
    shouldExist: (resourceName: string) => {
      cy.get('[data-test-rows="resource-row"]').contains(resourceName);
    },
  },
};

export const pages = {
  goToPodDetails: (ns, podName) => {
    pages.goToPodsList(ns);
    listPage.filter.byName(podName);
    listPage.rows.countShouldBeWithin(1, 3);
    listPage.rows.clickFirst();
  },
  goToPodsList: (ns: string | null = null) => {
    cy.visit(ns ? `/k8s/ns/${ns}/pods` : '/k8s/all-namespaces/pods');
    listPage.rows.shouldBeLoaded();
  },
};
