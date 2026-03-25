import { toast as hotToast, type ToastOptions as HotToastOptions } from 'react-hot-toast';
import type { ReactNode } from 'react';
import { CheckCircle2, CircleAlert, CircleX, Info } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

type ToastOptions = Omit<HotToastOptions, 'style' | 'iconTheme'> & {
  description?: ReactNode;
};

const variantStyles: Record<
  ToastVariant,
  {
    bg: string;
    text: string;
    descText: string;
    border: string;
    icon: React.ReactElement;
    iconPrimary: string;
    iconSecondary: string;
  }
> = {
  success: {
    bg: '#ecfdf3',
    text: '#14532d',
    descText: '#052e16',
    border: '#86efac',
    icon: <CheckCircle2 className="size-4" />,
    iconPrimary: '#166534',
    iconSecondary: '#dcfce7',
  },
  error: {
    bg: '#fef2f2',
    text: '#7f1d1d',
    descText: '#450a0a',
    border: '#fecaca',
    icon: <CircleX className="size-4" />,
    iconPrimary: '#b91c1c',
    iconSecondary: '#fee2e2',
  },
  warning: {
    bg: '#fffbeb',
    text: '#78350f',
    descText: '#451a03',
    border: '#fde68a',
    icon: <CircleAlert className="size-4" />,
    iconPrimary: '#b45309',
    iconSecondary: '#fef3c7',
  },
  info: {
    bg: '#eff6ff',
    text: '#1e3a8a',
    descText: '#172554',
    border: '#bfdbfe',
    icon: <Info className="size-4" />,
    iconPrimary: '#1d4ed8',
    iconSecondary: '#dbeafe',
  },
};

function show(variant: ToastVariant, message: ReactNode, options?: ToastOptions) {
  const { description, ...rest } = options ?? {};
  const palette = variantStyles[variant];

  const content = description ? (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium leading-tight">{message}</span>
      <span className="text-sm leading-tight" style={{ color: palette.descText }}>
        {description}
      </span>
    </div>
  ) : (
    message
  );

  return hotToast(content as React.ReactElement, {
    duration: 2000,
    icon: palette.icon,
    ...rest,
    style: {
      background: palette.bg,
      color: palette.text,
      border: `1px solid ${palette.border}`,
      borderRadius: '10px',
      padding: '10px 12px',
      maxWidth: 'min(92vw, 420px)',
    },
    iconTheme: {
      primary: palette.iconPrimary,
      secondary: palette.iconSecondary,
    },
  });
}

export const toast = {
  success: (message: ReactNode, options?: ToastOptions) => show('success', message, options),
  error: (message: ReactNode, options?: ToastOptions) => show('error', message, options),
  warning: (message: ReactNode, options?: ToastOptions) => show('warning', message, options),
  info: (message: ReactNode, options?: ToastOptions) => show('info', message, options),
  dismiss: hotToast.dismiss,
};
