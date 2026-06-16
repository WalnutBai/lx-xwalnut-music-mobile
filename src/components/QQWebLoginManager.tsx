import { useEffect, useRef, useState } from 'react';
import QQWebLoginModal, { type QQWebLoginModalType } from './QQWebLoginModal';

export default () => {
  const modalRef = useRef<QQWebLoginModalType>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleShow = () => {
      if (visible) {
        modalRef.current?.show();
      } else {
        setVisible(true);
        requestAnimationFrame(() => {
          modalRef.current?.show();
        });
      }
    };

    global.app_event.on('showTxWebLogin', handleShow);
    return () => {
      global.app_event.off('showTxWebLogin', handleShow);
    };
  }, [visible]);

  return visible ? <QQWebLoginModal ref={modalRef} /> : null;
};
