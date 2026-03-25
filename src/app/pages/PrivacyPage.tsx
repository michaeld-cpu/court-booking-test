import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import React from 'react';

export function PrivacyPage() {
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
          <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
          <p className="text-sm text-gray-600 mb-8">Last updated: December 22, 2024</p>

          <div className="space-y-6 text-gray-700">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
              <p>
                Korte.ph ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we 
                collect, use, disclose, and safeguard your information when you use our court booking platform. Please read 
                this privacy policy carefully.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
              <p className="mb-2">We collect information that you provide directly to us, including:</p>
              
              <h3 className="font-semibold mt-4 mb-2">Personal Information</h3>
              <ul className="list-disc ml-6 space-y-1">
                <li>Name and contact information (email address, phone number)</li>
                <li>Payment-related details required by our third-party payment gateway</li>
                <li>Booking history and preferences</li>
                <li>Account credentials and profile information</li>
              </ul>

              <h3 className="font-semibold mt-4 mb-2">Automatically Collected Information</h3>
              <ul className="list-disc ml-6 space-y-1">
                <li>Device information (IP address, browser type, operating system)</li>
                <li>Usage data (pages visited, time spent on pages, links clicked)</li>
                <li>Location data (with your permission)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
              <p className="mb-2">We use the information we collect to:</p>
              <ul className="list-disc ml-6 space-y-1">
                <li>Process and manage your court bookings</li>
                <li>Send booking confirmations and updates</li>
                <li>Process payments through our third-party payment gateway (GCash, Maya, and major credit/debit cards)</li>
                <li>Provide customer support and respond to your inquiries</li>
                <li>Send you promotional communications (with your consent)</li>
                <li>Improve and personalize your experience on our platform</li>
                <li>Detect, prevent, and address technical issues and fraudulent activity</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. How We Share Your Information</h2>
              <p className="mb-2">We may share your information with:</p>
              
              <h3 className="font-semibold mt-4 mb-2">Court Operators</h3>
              <p>We share necessary booking information with court operators to fulfill your reservations.</p>

              <h3 className="font-semibold mt-4 mb-2">Payment Processors</h3>
              <p>We share payment information with our third-party payment gateway providers to process transactions securely, including support for GCash, Maya, and major credit/debit cards.</p>

              <h3 className="font-semibold mt-4 mb-2">Service Providers</h3>
              <p>We may share information with third-party service providers who perform services on our behalf, such as hosting, data analysis, and customer service.</p>

              <h3 className="font-semibold mt-4 mb-2">Legal Requirements</h3>
              <p>We may disclose your information if required by law or in response to valid requests by public authorities.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Data Security</h2>
              <p>
                We implement appropriate technical and organizational security measures to protect your personal information. 
                However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to 
                use commercially acceptable means to protect your information, we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Data Retention</h2>
              <p>
                We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy 
                Policy, unless a longer retention period is required or permitted by law. When we no longer need your information, 
                we will securely delete or anonymize it.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
              <p className="mb-2">You have the right to:</p>
              <ul className="list-disc ml-6 space-y-1">
                <li>Access and receive a copy of your personal information</li>
                <li>Correct inaccurate or incomplete information</li>
                <li>Request deletion of your personal information</li>
                <li>Object to or restrict certain processing of your information</li>
                <li>Withdraw consent for marketing communications</li>
                <li>Data portability (receive your information in a structured format)</li>
              </ul>
              <p className="mt-3">
                To exercise these rights, please contact us through our in-app support channels.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Cookies and Tracking Technologies</h2>
              <p>
                We use cookies and similar tracking technologies to track activity on our service and hold certain information. 
                Cookies are files with a small amount of data. You can instruct your browser to refuse all cookies or to indicate 
                when a cookie is being sent.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Third-Party Links</h2>
              <p>
                Our service may contain links to third-party websites. We are not responsible for the privacy practices or content 
                of these third-party sites. We encourage you to read the privacy policies of any third-party sites you visit.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Children's Privacy</h2>
              <p>
                Our service is not intended for children under 13 years of age. We do not knowingly collect personal information 
                from children under 13. If you are a parent or guardian and believe your child has provided us with personal 
                information, please contact us.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Changes to This Privacy Policy</h2>
              <p>
                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy 
                Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically 
                for any changes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">12. Contact Us</h2>
              <p className="mb-2">
                If you have any questions about this Privacy Policy, please contact us:
              </p>
              <p className="mt-2">
                Contact details will be available soon.<br />
                Address: Dumaguete City, Negros Oriental, Philippines
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">13. Data Protection Officer</h2>
              <p>
                For any privacy-related concerns or to exercise your data protection rights, you may contact our Data Protection 
                Officer through our in-app support channels.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
