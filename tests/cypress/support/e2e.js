import '../../upstream/support/index'
import './commands'
import "../../views/netflow-page"

const registerCypressGrep = require('@cypress/grep')
registerCypressGrep()

// remove this when NETOBSERV-1450 is resolved
Cypress.on('uncaught:exception', (err, runnable) => {
    // we expect a different versions of MobX active error with 4.15 
    // and don't want to fail the test so we return false
    if (err.message.includes('different versions of MobX active')) {
        return false
    }
    if (err.message.includes('minified error nr: 35')) {
        return false
    }
    // we still want to ensure there are no other unexpected
    // errors, so we let them fail the test
})
