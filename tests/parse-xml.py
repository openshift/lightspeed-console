import defusedxml.minidom
import codecs

def generate_junit(inFile, outFile):
    """
    'inFile': original XML filename
    'outFile': new XML filename which is compatible in ReportPortal 
    """
    file = defusedxml.minidom.parse(inFile)
    # Original <testsuite> example, <testsuites failures="20" errors="0" tests="31" skipped="0">
    # Add 'name' property to top <testsuites>
    old_toplevel_test_suites = file.getElementsByTagName("testsuites")
    old_toplevel_test_suites[0].setAttribute('name', 'User_Interface_Cypress')

    # Create new XML document
    new_doc = defusedxml.minidom.Document()

    # Create new root element <testsuite>
    new_root_testsuite = new_doc.createElement("testsuite")

    # Set new root element <testsuite> with all attributes from <testsuites>
    for attrName, attrValue in old_toplevel_test_suites[0].attributes.items():
      new_root_testsuite.setAttribute(attrName, attrValue)
  
    # Parse <testcase>
    old_test_cases = file.getElementsByTagName("testcase")
    for tc in old_test_cases:
      # append all child nodes of testcase
      to_be_removed_textnode = []
      tc_classname = tc.attributes['classname'].value
      tc.removeAttribute('classname')
      tc.setAttribute('name', tc_classname)
      # if text node just contains \n then we remove it
      for child in tc.childNodes:
        if child.nodeType == 3 and '\n' in child.data:
          to_be_removed_textnode.append(child)
      for i in to_be_removed_textnode:
        tc.removeChild(i)
      # append updated testcase to new root
      new_root_testsuite.appendChild(tc.cloneNode(True))
  
    # add new root <testsuite> to document
    new_doc.appendChild(new_root_testsuite)
  
    # write new XML to file
    with open(outFile, 'wb+') as f:
      writer = codecs.lookup('utf-8')[3](f)
      new_doc.writexml(writer, encoding='utf-8')
    writer.close()

if __name__ == '__main__':
    generate_junit('combined.xml','console-cypress.xml')