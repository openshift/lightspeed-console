import { listPage } from "../upstream/views/list-page";

export const Pages = {
  gotoPodsList: () => {
    cy.visit('/k8s/all-namespaces/core~v1~Pod');
    listPage.rows.shouldBeLoaded();
  }
}
