import { helperfuncs } from '../views/utils';
import { listPage } from "../upstream/views/list-page";
import { Pages } from "./pages";
export const installedOperators = {
  clickCSVName: (csv_name) => {
    cy.get(`a[data-test-operator-row*="${csv_name}"]`).click();
  }
}

export const operatorHubPage = {
  getAllTileLabels: () => {
    return cy.get('.pf-v5-c-badge')
  },
  checkCustomCatalog: (name: string) => {
    cy.get('form[data-test-group-name="source"]')
      .find(`[data-test="source-${name}"]`)
  },
  checkSourceCheckBox: (name: string) => {
    cy.get('form[data-test-group-name="source"]', {timeout: 60000})
      .find(`[data-test="source-${name}"]`)
      .find('[type="checkbox"]').check()
  },
  uncheckSourceCheckBox: (name: string) => {
    cy.get('form[data-test-group-name="source"]', {timeout: 60000})
      .find(`[data-test="source-${name}"]`)
      .find('[type="checkbox"]').uncheck()
  },
  checkInstallStateCheckBox: (state: string) => {
    cy.get('form[data-test-group-name="installState"]')
      .find(`[data-test="installState-${state}"]`)
      .find('[type="checkbox"]')
      .check();
  },
  checkInfraFeaturesCheckbox: (name: string) => {
    cy.get('form[data-test-group-name="infraFeatures"]')
      .then($btn => {
        const hasMoreButton = $btn.find('button:contains("more")').length > 0;
        if (hasMoreButton) {
          cy.wrap($btn).find('button').contains('more').click();
        }
        cy.wrap($btn).find(`[data-test="infraFeatures-${name}"] [type="checkbox"]`).check();
      })
  },
  clickOperatorTile: (operator_name) => {
    cy.get(`label[for*="${operator_name}"]`).first().click();
  },
  clickOperatorInstall: () => {
    cy.get('[data-test="install-operator"]').click();
  },
  filter: (name: string) => {
    cy.get('[data-test="search-operatorhub"]').within(() => {
      cy.get('input[type="text"]')
      .clear()
      .type(name)
    })
  },
  // pass operator name that matches the Title on UI
  install: (name: string, metrics: boolean = false) => {
    cy.get('input[type="text"]').type(name + "{enter}")
    cy.get('[role="gridcell"]').first().within(noo => {
      cy.contains(name).should('exist').click()
    })
    // ignore warning pop up for community operators
    cy.get('body').then(body => {
      if (body.find('.modal-content').length) {
        cy.byTestID('confirm-action').click()
      }
    })
    cy.get('[data-test-id="operator-install-btn"]').should('exist').click({ force: true });
    if(metrics){
      cy.get('#enable-monitoring-checkbox').should('exist').check()
    }
    cy.byTestID('Enable-radio-input').click()
    cy.byTestID('install-operator').trigger('click')
    cy.get('#operator-install-page').should('exist')
    Pages.gotoInstalledOperatorPage();

    cy.contains(name).parents('tr').within(() => {
      cy.byTestID("status-text", { timeout: 30000 }).should('have.text', "Succeeded")
    })
  },
  installOperator: (operatorName, csName, installNamespace?) => {
    cy.visit(`/operatorhub/subscribe?pkg=${operatorName}&catalog=${csName}&catalogNamespace=openshift-marketplace&targetNamespace=undefined`);
    cy.get('body').should('be.visible');
    if (installNamespace) {
      cy.get('[data-test="A specific namespace on the cluster-radio-input"]').click();
      helperfuncs.clickIfExist('input[data-test="Select a Namespace-radio-input"]');
      cy.get('button#dropdown-selectbox').click();
      cy.contains('span', `${installNamespace}`).click();
    }
    cy.get('[data-test="install-operator"]').click();
  },
  installOperatorWithRecomendNamespace: (operatorName, csName) => {
    cy.visit(`/operatorhub/subscribe?pkg=${operatorName}&catalog=${csName}&catalogNamespace=openshift-marketplace&targetNamespace=undefined`);
    cy.get('body').should('be.visible');
    cy.get('[data-test="Operator recommended Namespace:-radio-input"]').click();
    cy.get('[data-test="enable-monitoring"]').click();
    cy.get('[data-test="install-operator"]').click();
  },
  checkOperatorStatus: (csvName, csvStatus) => {
    cy.get('input[data-test="name-filter-input"]').clear().type(`${csvName}`);
    cy.get(`[data-test-operator-row="${csvName}"]`, { timeout: 120000 })
      .parents('tr')
      .children()
      .contains(`${csvStatus}`, { timeout: 120000 });
  },
  removeOperator: (csvName) => {
    listPage.rows.clickKebabAction(`${csvName}`, "Uninstall Operator");
    cy.get('#confirm-action').click();
    cy.get(`[data-test-operator-row="${csvName}"]`).should('not.exist');
  },
  checkDeprecationIcon: () => {
    return cy.get('svg[class*="yellow-exclamation-icon"]')
  },
  checkDeprecationLabel: (criteria: string) => {
    cy.get('span').contains('Deprecated').should(criteria);
  },
  checkDeprecationMsg: (message: string) => {
    cy.get('div').contains(message).should('exist');
  },
  checkWarningInfo: (warningInfo) => {
    cy.get('[class*="alert__title"]').should('contain', `${warningInfo}`);
  },
  checkSTSWarningOnOperator: (operatorName, catalogSource, warningInfo, installNamespace, clusterType) => {
    //Check STS/WIFI warning message on operator details and installation page
    cy.visit(`/operatorhub/all-namespaces?keyword=${operatorName}&source=%5B"${catalogSource}"%5D`);
    cy.get('.co-catalog-tile').click();
    operatorHubPage.checkWarningInfo(warningInfo);
    cy.get('a[data-test-id="operator-install-btn"]').click({force: true});
    operatorHubPage.checkWarningInfo(warningInfo);
    // Check manual installation Mode is subscribe by default
    cy.get('input[value="Manual"]').should('have.attr', 'data-checked-state', 'true');
    // Check&Input specific inputs based on cluster type
    switch (clusterType) {
      case 'aws':
        cy.get('input[aria-label="role ARN"]').clear().type('testrolearn');
        break;
      case 'azure':
        cy.get('input[aria-label="Azure Client ID"]').clear().type('testazureclientid');
        cy.get('input[aria-label="Azure Tenant ID"]').clear().type('testazuretenantid');
        cy.get('input[aria-label="Azure Subscription ID"]').clear().type('testazuresubscriptionid');
        break;
      case 'gcp':
        cy.get('input[aria-label="GCP Project Number"]').clear().type('testgcpprojectid');
        cy.get('input[aria-label="GCP Pool ID"]').clear().type('testgcppoolid');
        cy.get('input[aria-label="GCP Provider ID"]').clear().type('testgcpproviderid');
        cy.get('input[aria-label="GCP Service Account Email"]').clear().type('testgcpemail');
        break;
      default:
        break;
    }
    // Install the operator into the selected namespace
    if (installNamespace) {
      cy.get('[data-test="A specific namespace on the cluster-radio-input"]').click();
      cy.get('button#dropdown-selectbox').click();
      cy.contains('span', `${installNamespace}`).click();
    }
    cy.get('[data-test="install-operator"]').click();
    cy.contains('Approve', {timeout: 240000}).click();
  },
  cancel: () => {
    cy.get('button').contains('Cancel').click({force: true});
  }
};

export const operatorHubModal = {
  clickInstall: () => {
    cy.get('[data-test-id="operator-install-btn"]').click({force: true});
  },
  selectChannel: (channel) => {
    cy.get('h5').contains('Channel').parent('div').within(() => {
      // click on button instead of div
      cy.get('button[id*="select-toggle"]').click({force: true});
      cy.get(`li[id="${channel}"] button`).click({force: true});
    })
  },
  selectVersion: (version) => {
    cy.get('h5').contains('Version').parent('div').within(() => {
      cy.get('button[id*="select-toggle"]').click({force: true});
      cy.get(`li[id="${version}"] button`).click({force: true});
    })
  },
};

export namespace OperatorHubSelector {
  export const SOURCE_MAP = new Map([
    ["certified", "Certified"],
    ["community", "Community"],
    ["red-hat", "Red Hat"],
    ["marketplace", "Marketplace"],
    ["custom-auto-source", "Custom-Auto-Source"]
  ]);
  export const CUSTOM_CATALOG = "custom-auto-source"
}

export const Operand = {
  switchToFormView: () => {
    cy.get('#form').scrollIntoView().click();
  },
  switchToYAMLView: () => {
    cy.get('#yaml').scrollIntoView().click();
  },
  submitCreation: () => {
    cy.byTestID("create-dynamic-form").scrollIntoView().click();
  },
  expandSpec: (id: string) => {
    cy.get(`#${id}`)
      .scrollIntoView()
      .should('have.attr', 'aria-expanded', 'false')
      .click();
  },
  collapseSpec: (id: string) => {
    cy.get(`#${id}`)
      .scrollIntoView()
      .should('have.attr', 'aria-expanded', 'true')
      .click();
  },
  clickAddNodeConfigAdvanced: () => {
    cy.get('#root_spec_nodeConfigAdvanced_add-btn')
      .scrollIntoView()
      .click();
    // this will expand 'Advanced configuration' where we set all affinities
    cy.get('#root_spec_nodeConfigAdvanced_accordion-content')
      .within(() => {
        cy.get('button.pf-v5-c-expandable-section__toggle')
          .first()
          .click()
      })
  },
  setRandomType: () => {
    cy.get('#root_spec_nodeConfigAdvanced_0_type').click();
    cy.get('#all-link').click()
  },
  expandNodeConfigAdvanced: () => {
    Operand.expandSpec('root_spec_nodeConfigAdvanced_accordion-toggle')
  },
  expandNodeAffinity: () => {
    Operand.expandSpec('root_spec_nodeConfigAdvanced_0_nodeAffinity_accordion-toggle')
  },
  expandPodAffinity: () => {
    Operand.expandSpec('root_spec_nodeConfigAdvanced_0_podAffinity_accordion-toggle')
  },
  expandPodAntiAffinity: () => {
    Operand.expandSpec('root_spec_nodeConfigAdvanced_0_podAntiAffinity_accordion-toggle')
  },
  collapseNodeAffinity: () => {
    Operand.collapseSpec('root_spec_nodeConfigAdvanced_0_nodeAffinity_accordion-toggle')
  },
  collapsePodAffinity: () => {
    Operand.collapseSpec('root_spec_nodeConfigAdvanced_0_podAffinity_accordion-toggle')
  },
  collapsePodAntiAffinity: () => {
    Operand.collapseSpec('root_spec_nodeConfigAdvanced_0_podAntiAffinity_accordion-toggle')
  },
  nodeAffinityAddRequired: (key: string, operator: string, value: string) => {
    cy.get('#root_spec_nodeConfigAdvanced_0_nodeAffinity_accordion-content')
      .within(() => {
        cy.byButtonText('Add required').click();
      })
    cy.get('.co-affinity-term')
      .last()
      .within(() => {
        cy.byButtonText('Add expression').click();
        Operand.addExpression(key, operator, value);
      })
  },
  nodeAffinityAddPreferred: (weight: string, key: string, operator: string, value: string) => {
    cy.get('#root_spec_nodeConfigAdvanced_0_nodeAffinity_accordion-content')
      .within(() => {
        cy.byButtonText('Add preferred').click()
      });
    cy.get('.co-affinity-term')
      .last()
      .within(() => {
        Operand.setWeight(weight);
        cy.byButtonText('Add expression').click();
        Operand.addExpression(key, operator, value);
      })
  },
  podAffinityAddRequired: (tpkey: string, key: string, operator: string, value: string) => {
    cy.get('#root_spec_nodeConfigAdvanced_0_podAffinity_accordion-content')
      .within(() => {
        cy.byButtonText('Add required').click()
      })
    cy.get('.co-affinity-term')
      .last()
      .within(() => {
        Operand.setTopologyKey(tpkey);
        cy.byButtonText('Add expression').click();
        Operand.addExpression(key, operator, value);
      })
  },
  podAntiAffinityAddPreferred: (weight: string, tpkey: string, key: string, operator: string, value: string) => {
    cy.get('#root_spec_nodeConfigAdvanced_0_podAntiAffinity_accordion-content')
      .within(() => {
        cy.byButtonText('Add preferred').click()
      })
    cy.get('.co-affinity-term')
      .last()
      .within(() => {
        Operand.setWeight(weight);
        Operand.setTopologyKey(tpkey);
        cy.byButtonText('Add expression').click();
        Operand.addExpression(key, operator, value);
      })
  },
  setWeight: (weight: string) => {
    cy.get('.co-affinity-term__weight-input')
      .last()
      .within(() => {
        cy.get('input').clear().type(weight)
      })
  },
  setTopologyKey: (key: string) => {
    cy.get('#topology-undefined').last().clear().type(key);
  },
  addExpression: (key: string, operator: string, value?: string) => {
    cy.get('.key-operator-value__name-field')
      .last()
      .within(() => {
        cy.get('input').clear().type(key)
      })
    cy.get('.key-operator-value__operator-field')
      .last()
      .within(() => {
        cy.byLegacyTestID('dropdown-button').click();
        cy.get(`button[data-test-dropdown-menu="${operator}"]`).click();
      })
    if (value) {
      cy.get('.key-operator-value__value-field')
        .last()
        .within(() => {
          cy.get('input').clear().type(value)
        })
    }
  },
  sortAndVerifyColumn(columnName) {
    const columnSelectors = {
      Name: {
        header: '[data-label="Name"]',
        rowsinfo: '[data-test-rows="resource-row"] td span a',
      },
      Status: {
        header: '[data-label="Status"]',
        rowsinfo: '[data-test="status-text"]',
      },
      Created: {
        header: '[data-label="Created"]',
        rowsinfo: '[data-test="timestamp"]'
      },
      Kind: {
        header: '[data-label="Kind"]',
        rowsinfo: '[data-test-rows="resource-row"] [class*="-screen-reader"]'
      }
    };

    const { header, rowsinfo } = columnSelectors[columnName] || {};
    if (!header || ! rowsinfo) {
      throw new Error(`Invalid column name: ${columnName}, it is not define in columnSelectors`);
    }

    cy.get(header)
      .click()
      .then(($el) => {
        if ($el.attr('aria-sort') !== 'descending') {
          cy.get(header).click().should('have.attr', 'aria-sort', 'descending');
        }
      });
    cy.get(rowsinfo)
      .then($names => {
        const namesArray = $names.toArray().map(name => name.innerText.trim());
        const sortedNames = [...namesArray].sort((a, b) => b.localeCompare(a));
        cy.wrap(namesArray).should('deep.equal', sortedNames);
      });
  }
}
