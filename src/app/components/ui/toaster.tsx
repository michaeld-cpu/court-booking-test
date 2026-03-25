import { Toaster as HotToaster } from 'react-hot-toast';

export function Toaster() {
  return (
    <HotToaster
      position="bottom-center"
      gutter={8}
      containerStyle={{
        bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px) + 8px)',
      }}
      toastOptions={{
        duration: 2000,
      }}
    />
  );
}
