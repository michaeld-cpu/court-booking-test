import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/app/lib/toast';

export function PaymentFailed() {
  const navigate = useNavigate();

  useEffect(() => {
    toast.error('Payment failed', {
      description: 'We could not process your payment. Please try again.',
    });
    navigate('/bookings', { replace: true });
  }, [navigate]);

  return null;
}
