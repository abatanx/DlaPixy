import { useEffect, useRef } from 'react';
import Modal from 'bootstrap/js/dist/modal';

type UseBootstrapModalOptions = {
  isOpen: boolean;
  onShown?: () => void;
  onHidden?: () => void;
};

// Bootstrap Modal の初期化と show/hide を React 側に寄せる。
export function useBootstrapModal({ isOpen, onShown, onHidden }: UseBootstrapModalOptions) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const modalInstanceRef = useRef<Modal | null>(null);
  const onShownRef = useRef(onShown);
  const onHiddenRef = useRef(onHidden);

  useEffect(() => {
    onShownRef.current = onShown;
    onHiddenRef.current = onHidden;
  }, [onHidden, onShown]);

  useEffect(() => {
    const modalElement = modalRef.current;
    if (!modalElement) {
      return;
    }

    const instance = new Modal(modalElement, {
      backdrop: 'static',
      keyboard: false
    });
    modalInstanceRef.current = instance;

    const handleShown = () => {
      onShownRef.current?.();
    };
    const handleHidden = () => {
      onHiddenRef.current?.();
    };

    modalElement.addEventListener('shown.bs.modal', handleShown);
    modalElement.addEventListener('hidden.bs.modal', handleHidden);

    return () => {
      modalElement.removeEventListener('shown.bs.modal', handleShown);
      modalElement.removeEventListener('hidden.bs.modal', handleHidden);
      instance.dispose();
      modalInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = modalInstanceRef.current;
    if (!instance) {
      return;
    }

    if (isOpen) {
      instance.show();
      return;
    }

    instance.hide();
  }, [isOpen]);

  return modalRef;
}
