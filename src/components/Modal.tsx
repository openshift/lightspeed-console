import * as React from 'react';
import * as ReactModal from 'react-modal';
import { Title } from '@patternfly/react-core';

import CloseButton from './CloseButton';

type Props = {
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
};

const Modal: React.FC<Props> = ({ children, className, isOpen, onClose, title }) => (
  <ReactModal
    ariaHideApp={false}
    className={`modal-dialog ols-plugin__modal${className ? ` ${className}` : ''}`}
    isOpen={isOpen}
    onRequestClose={onClose}
    overlayClassName="co-overlay"
  >
    <div className="modal-header">
      <CloseButton onClose={onClose} />
      <Title headingLevel="h2">{title}</Title>
    </div>
    <div className="modal-body">
      <div className="modal-body-content">{children}</div>
    </div>
  </ReactModal>
);

export default Modal;
