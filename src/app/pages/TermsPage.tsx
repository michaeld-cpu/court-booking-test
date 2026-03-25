import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import React from 'react';

export function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        <div className="bg-white rounded-lg shadow-md p-8 md:p-12">
          <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
          <p className="text-sm text-gray-600 mb-8">Last updated: December 22, 2024</p>

          <div className="space-y-6 text-gray-700">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing and using Korte.ph, you accept and agree to be bound by the terms and provision of this agreement. 
                If you do not agree to these terms, please do not use our service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Use of Service</h2>
              <p className="mb-2">
                Korte.ph provides a platform for booking sports courts in Dumaguete City and surrounding areas. 
                You agree to use the service only for lawful purposes and in accordance with these Terms.
              </p>
              <p>You agree not to:</p>
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>Use the service in any way that violates any applicable national or international law or regulation</li>
                <li>Impersonate or attempt to impersonate Korte.ph, a Korte.ph employee, another user, or any other person or entity</li>
                <li>Engage in any conduct that restricts or inhibits anyone's use or enjoyment of the service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Bookings and Payments</h2>
              <p className="mb-2">
                All bookings are subject to availability and confirmation by the court operator. Payments are processed through a third-party payment gateway that supports GCash, Maya, and major credit/debit cards.
              </p>
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>Prices are listed in Philippine Peso (₱) and are subject to change</li>
                <li>You are responsible for ensuring your booking details are correct before confirming payment</li>
                <li>Cancellation policies vary by court operator and will be clearly displayed during booking</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. User Accounts</h2>
              <p>
                When you create an account with us, you must provide accurate, complete, and current information. 
                Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Cancellations and Refunds</h2>
              <p className="mb-2">
                Cancellation and refund policies are set by individual court operators. General guidelines:
              </p>
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>Cancellations made 24 hours or more before the booking time may be eligible for a full refund</li>
                <li>Cancellations made less than 24 hours before may incur a cancellation fee</li>
                <li>No-shows will not receive a refund</li>
                <li>Refunds will be processed within 5-7 business days</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Limitation of Liability</h2>
              <p>
                Korte.ph acts as a booking platform and is not responsible for the quality, safety, or condition of the courts. 
                We are not liable for any injuries, damages, or losses incurred while using court facilities.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Intellectual Property</h2>
              <p>
                The service and its original content, features, and functionality are owned by Korte.ph and are protected by 
                international copyright, trademark, patent, trade secret, and other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Changes to Terms</h2>
              <p>
                We reserve the right to modify or replace these Terms at any time. We will provide notice of any significant 
                changes by posting the new Terms on this page and updating the "Last updated" date.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Contact Information</h2>
              <p>
                If you have any questions about these Terms, please contact us at:
              </p>
              <p className="mt-2">
                Contact details will be available soon.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Governing Law</h2>
              <p>
                These Terms shall be governed and construed in accordance with the laws of the Republic of the Philippines, 
                without regard to its conflict of law provisions.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
