import * as React from 'react';
import { useResolvedExtensions } from '@openshift-console/dynamic-plugin-sdk';
import type { CodeRef, Extension } from '@openshift-console/dynamic-plugin-sdk/lib/types';
import type { OlsToolUIComponent } from '../types';

type ToolUIExtensionProperties = {
  /** ID of the component (as referenced by the MCP tool) */
  id: string;
  /** The component to be rendered when the MCP tool matches. */
  component: CodeRef<OlsToolUIComponent>;
};

type ToolUIExtension = Extension<'ols.tool-ui', ToolUIExtensionProperties>;

const isToolUIExtension = (e: Extension): e is ToolUIExtension => e.type === 'ols.tool-ui';

const useToolUIExtensions = () => useResolvedExtensions(isToolUIExtension);

export const useToolUIMapping = (): [Record<string, OlsToolUIComponent>, boolean] => {
  const [extensions, resolved] = useToolUIExtensions();

  const mapping = React.useMemo(() => {
    const result: Record<string, OlsToolUIComponent> = {};
    extensions.forEach((extension) => {
      const { id, component } = extension.properties as {
        id: string;
        component: OlsToolUIComponent;
      };
      result[id] = component;
    });
    return result;
  }, [extensions]);

  return [mapping, resolved];
};
