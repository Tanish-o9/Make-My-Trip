import React from 'react';
import { ArrowLeft, Shield, FileText, HelpCircle, Mail, Phone, MapPin, ChevronRight } from 'lucide-react';

interface LegalPageProps {
  page: 'privacy' | 'terms' | 'support';
  onNavigate: (path: string) => void;
}

function PageWrapper({ children, title, subtitle, icon: Icon, onNavigate }: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  onNavigate: (path: string) => void;
}) {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => onNavigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '6px 12px', borderRadius: 8, transition: 'all 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f59e0b'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,158,11,0.1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
          >
            <ArrowLeft size={16} />
            Back to Travel OS
          </button>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 13, color: '#64748b' }}>Last updated: August 2026</div>
        </div>
      </header>

      <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(16,185,129,0.08) 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '60px 20px 40px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 8px 24px rgba(245,158,11,0.3)' }}>
            <Icon size={28} color="#000" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-0.5px' }}>{title}</h1>
            <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 16 }}>{subtitle}</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px 80px' }}>
        {children}
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15,23,42,0.8)', padding: '24px 20px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
          {([['/', 'Home'], ['/privacy', 'Privacy Policy'], ['/terms', 'Terms of Service'], ['/support', 'Support']] as [string, string][]).map(([href, label]) => (
            <button key={href} onClick={() => onNavigate(href)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 13, padding: 0, transition: 'color 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f59e0b'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>&copy; 2026 Travel OS Inc. All rights reserved.</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid rgba(245,158,11,0.2)' }}>{title}</h2>
      <div style={{ color: '#cbd5e1', lineHeight: 1.75, fontSize: 15 }}>{children}</div>
    </div>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '0 0 14px' }}>{children}</p>;
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: '0 0 14px', paddingLeft: 20 }}>
      {items.map((item, i) => <li key={i} style={{ marginBottom: 6 }}>{item}</li>)}
    </ul>
  );
}

function PrivacyPolicy({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <PageWrapper title="Privacy Policy" subtitle="How Travel OS collects, uses, and protects your personal data" icon={Shield} onNavigate={onNavigate}>
      <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 36, fontSize: 14, color: '#fcd34d' }}>
        <strong>Summary:</strong> We collect only what is necessary to operate your travel bookings. We never sell your personal data. You have full control over your information.
      </div>
      <Section title="1. Information We Collect">
        <Para>We collect information you provide directly when you register, book travel, or contact support:</Para>
        <Ul items={[
          'Identity: Full name, date of birth, nationality, passport/ID number',
          'Contact: Email address, phone number, billing address',
          'Payment: Card details processed via PCI-DSS compliant providers — we do not store raw card data',
          'Travel preferences: Seat preferences, meal choices, frequent flyer numbers, special assistance requirements',
          'Usage data: Pages visited, search queries, booking history, device type, IP address',
        ]} />
      </Section>
      <Section title="2. How We Use Your Information">
        <Ul items={[
          'Process and manage your travel bookings across all verticals (flights, hotels, trains, cabs, car rentals, activities)',
          'Send booking confirmations, e-tickets, and travel itineraries',
          'Provide customer support and resolve disputes',
          'Detect and prevent fraud, unauthorized access, and abuse',
          'Personalise your experience and recommend relevant travel deals',
          'Comply with legal obligations (tax, anti-money-laundering, GDPR/DPDP Act)',
        ]} />
      </Section>
      <Section title="3. Sharing Your Information">
        <Ul items={[
          'Airlines, hotels, car rental companies, cab operators, and activity providers — to create your reservations',
          'GDS and aggregators (Amadeus, Duffel, etc.) — to search and book inventory',
          'Payment processors (Razorpay, Stripe) — for secure payment processing',
          'Notification providers (Resend, SendGrid) — to deliver transactional emails and SMS',
          'Infrastructure providers (Railway, Neon, Vercel) — for hosting and data storage',
          'Regulatory authorities — when required by law',
        ]} />
        <Para><strong style={{ color: '#fcd34d' }}>We never sell your personal data to advertisers or data brokers.</strong></Para>
      </Section>
      <Section title="4. Data Retention">
        <Para>We retain your personal data while your account is active or as required to provide services. Booking records are retained for 7 years for legal and tax compliance. You may request deletion of your account at any time; we will delete your data within 30 days except where retention is legally required.</Para>
      </Section>
      <Section title="5. Your Rights">
        <Ul items={[
          'Access the personal data we hold about you',
          'Correct inaccurate or incomplete data',
          'Request deletion ("right to be forgotten")',
          'Object to or restrict processing',
          'Data portability — receive your data in a machine-readable format',
          'Withdraw consent at any time',
          'Lodge a complaint with your national data protection authority',
        ]} />
        <Para>To exercise any right, contact us at <strong style={{ color: '#f59e0b' }}>privacy@travelos.com</strong>.</Para>
      </Section>
      <Section title="6. Security">
        <Para>We implement TLS 1.3 encryption in transit, AES-256 encryption at rest, JWT-based authentication with refresh token rotation, rate limiting, and regular security audits.</Para>
      </Section>
      <Section title="7. Cookies">
        <Para>We use strictly necessary cookies for session management and authentication only. We do not use third-party tracking or advertising cookies.</Para>
      </Section>
      <Section title="8. Contact">
        <Para>Privacy inquiries: <strong style={{ color: '#f59e0b' }}>privacy@travelos.com</strong></Para>
      </Section>
    </PageWrapper>
  );
}

function TermsOfService({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <PageWrapper title="Terms of Service" subtitle="The rules and guidelines for using the Travel OS platform" icon={FileText} onNavigate={onNavigate}>
      <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 36, fontSize: 14, color: '#93c5fd' }}>
        <strong>Important:</strong> By using Travel OS you agree to these terms. Please read them carefully.
      </div>
      <Section title="1. Acceptance of Terms">
        <Para>By accessing or using Travel OS you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, you must not use the Platform.</Para>
      </Section>
      <Section title="2. Eligibility">
        <Ul items={[
          'You must be at least 18 years of age to create an account and make bookings',
          'You must provide accurate and complete registration information',
          'You are responsible for maintaining the confidentiality of your account credentials',
          'You agree to notify us immediately of any unauthorized account access',
        ]} />
      </Section>
      <Section title="3. Booking Services">
        <Para>Travel OS acts as an intermediary between you and travel service providers. We do not operate any transport service or accommodation ourselves. By making a booking, you agree to the terms of the underlying service provider and confirm all traveller details are accurate.</Para>
      </Section>
      <Section title="4. Payments">
        <Para>All payments are processed via PCI-DSS compliant payment processors. Prices are inclusive of all applicable taxes and fees unless otherwise stated. In the event of a pricing error, we reserve the right to cancel a booking and issue a full refund.</Para>
      </Section>
      <Section title="5. Cancellations and Refunds">
        <Ul items={[
          'Refundable bookings: Refunds processed within 5–10 business days to the original payment method',
          'Non-refundable bookings: No monetary refund; credit may be issued at our discretion',
          'Airline-initiated cancellations entitle you to a full refund',
          'Refund eligibility is determined at the time of cancellation',
        ]} />
      </Section>
      <Section title="6. Prohibited Conduct">
        <Ul items={[
          'Using the Platform for fraudulent bookings or payments',
          'Attempting to circumvent pricing mechanisms or scrape data without authorization',
          'Sharing account credentials or making bookings on behalf of others without authorization',
          'Using automated scripts to make or cancel bookings without our written consent',
        ]} />
      </Section>
      <Section title="7. Limitation of Liability">
        <Para>Travel OS is not liable for delays, cancellations, or service failures by third-party providers. Our total liability for any claim shall not exceed the amount paid for the specific booking giving rise to the claim.</Para>
      </Section>
      <Section title="8. Governing Law">
        <Para>These terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of courts in Bangalore, Karnataka, India.</Para>
      </Section>
      <Section title="9. Contact">
        <Para>Legal inquiries: <strong style={{ color: '#f59e0b' }}>legal@travelos.com</strong></Para>
      </Section>
    </PageWrapper>
  );
}

function SupportPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const faqs = [
    { q: 'How do I cancel or change my booking?', a: 'Go to My Trips in the navigation bar, select your booking, and click "Cancel" or "Modify". Refund eligibility depends on the fare type selected at booking.' },
    { q: 'How long do refunds take?', a: 'Refunds are processed within 24–48 hours on our end. Depending on your bank or card issuer, funds may take 5–10 business days to appear in your account.' },
    { q: 'My payment was deducted but no confirmation email arrived.', a: 'Check your spam/junk folder first. If you still cannot find it, go to My Trips to verify booking status. Contact support if the booking does not appear within 2 hours.' },
    { q: 'Can I add extra baggage or seat selection after booking?', a: 'For flights, post-booking add-ons depend on the airline. Visit My Trips then Booking Details, or contact the airline directly using your PNR.' },
    { q: 'What happens if my flight is cancelled by the airline?', a: 'We will notify you via email and SMS. You are entitled to a full refund or rebooking at no extra charge, subject to the airline\'s rebooking policy.' },
    { q: 'How do I download my e-ticket or invoice?', a: 'Go to My Trips, select your booking, and click "Download Ticket" or "Download Invoice". Documents are also emailed at booking confirmation.' },
    { q: 'Is my payment information secure?', a: 'Yes. We use PCI-DSS compliant payment processors. We never store raw card numbers. All communication is encrypted via TLS 1.3.' },
    { q: 'Can I book for someone else?', a: 'Yes — enter their traveller details during checkout. Ensure their name exactly matches their government-issued ID.' },
  ];

  return (
    <PageWrapper title="Help &amp; Support" subtitle="Get answers, contact our team, and resolve issues quickly" icon={HelpCircle} onNavigate={onNavigate}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 48 }}>
        {([
          { icon: Mail, label: 'Email Support', value: 'support@travelos.com', sub: 'Response within 4–6 hours', color: '#f59e0b' },
          { icon: Phone, label: 'Phone Support', value: '+91 1800 123 4567', sub: 'Mon–Sun 6 AM – 11 PM IST', color: '#10b981' },
          { icon: MapPin, label: 'Office', value: 'Bangalore, Karnataka', sub: 'India – 560001', color: '#3b82f6' },
        ] as { icon: React.ElementType; label: string; value: string; sub: string; color: string }[]).map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '24px' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Icon size={22} color={color} />
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b', marginBottom: 16 }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {([
            ['My Trips', '/', 'View and manage bookings'],
            ['Download Ticket', '/', 'Get your e-ticket/invoice'],
            ['Profile Settings', '/profile', 'Update personal details'],
            ['Privacy Policy', '/privacy', 'Review our data practices'],
          ] as [string, string, string][]).map(([title, path, sub]) => (
            <button
              key={title}
              onClick={() => onNavigate(path)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 12, cursor: 'pointer', textAlign: 'left' as const, gap: 8 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,158,11,0.12)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,158,11,0.06)'; }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fcd34d', marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{sub}</div>
              </div>
              <ChevronRight size={16} color="#f59e0b" />
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b', marginBottom: 20 }}>Frequently Asked Questions</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {faqs.map(({ q, a }, i) => (
            <details key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
              <summary style={{ padding: '16px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 15, color: '#e2e8f0', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {q}
              </summary>
              <div style={{ padding: '14px 20px 16px', color: '#94a3b8', fontSize: 14, lineHeight: 1.7, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                {a}
              </div>
            </details>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 48, background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(220,38,38,0.05))', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: '24px 28px' }}>
        <h3 style={{ margin: '0 0 8px', color: '#f87171', fontSize: 18, fontWeight: 700 }}>Travel Emergency?</h3>
        <p style={{ margin: '0 0 16px', color: '#fca5a5', fontSize: 14 }}>
          For urgent travel emergencies (missed flights, medical issues abroad, lost passports), contact us immediately:
        </p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <a href="tel:+911800123999" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', fontWeight: 600, fontSize: 16, textDecoration: 'none' }}>
            <Phone size={18} /> +91 1800 123 9999 (24/7)
          </a>
          <a href="mailto:emergency@travelos.com" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
            <Mail size={16} /> emergency@travelos.com
          </a>
        </div>
      </div>
    </PageWrapper>
  );
}

export default function LegalPage({ page, onNavigate }: LegalPageProps) {
  if (page === 'privacy') return <PrivacyPolicy onNavigate={onNavigate} />;
  if (page === 'terms') return <TermsOfService onNavigate={onNavigate} />;
  return <SupportPage onNavigate={onNavigate} />;
}
