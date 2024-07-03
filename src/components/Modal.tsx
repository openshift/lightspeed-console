import * as React from 'react';
import * as ReactModal from 'react-modal';

type Props = {
  body: React.ReactNode;
  header: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
};

const Modal: React.FC<Props> = ({ body, header, isOpen, onClose }) => (
  <ReactModal
    ariaHideApp={false}
    className="modal-dialog"
    isOpen={isOpen}
    onRequestClose={onClose}
    overlayClassName="co-overlay"
  >
    <div className="modal-header">{header}</div>
    <div className="modal-body">
      <div className="modal-body-content">{body}</div>
    </div>
  </ReactModal>
);

export default Modal;
