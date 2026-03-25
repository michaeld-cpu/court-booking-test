import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/app/lib/toast';

export function PaymentCancelled() {
  const navigate = useNavigate();

  useEffect(() => {
    toast.warning('Payment cancelled', {
      description: 'You cancelled the payment. Complete it from your bookings anytime.',
    });
    navigate('/bookings', { replace: true });
  }, [navigate]);

  return null;
}
