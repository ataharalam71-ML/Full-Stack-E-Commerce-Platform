import { useSite } from '../context/SiteContext';

// Affiliate programmes (Amazon Associates in particular) require a visible disclosure and
// working About/Privacy/Contact pages before they approve an account, so these ship with
// the site rather than being an afterthought.

export function About() {
  const { site } = useSite();
  return (
    <div className="prose">
      <h1>About {site.name}</h1>
      <p>
        {site.name} is a deals site. We watch prices on Amazon and Flipkart, and publish the drops
        that are genuinely worth your money — not every discount, just the ones we would buy
        ourselves.
      </p>

      <h2>How we pick deals</h2>
      <ul>
        <li>The discount is measured against the real recent price, not an inflated MRP.</li>
        <li>The seller is the retailer or a rated seller with a return window.</li>
        <li>Ratings and review counts are high enough to trust.</li>
      </ul>

      <h2>How we make money</h2>
      <p>
        When you click a "Buy on…" button we send you to the retailer with an affiliate tag. If you
        buy, the retailer pays us a small commission. You pay the same price either way, and the
        commission never changes which deals we feature. See our{' '}
        <a href="/affiliate-disclosure">affiliate disclosure</a> for the full detail.
      </p>
    </div>
  );
}

export function Disclosure() {
  const { site } = useSite();
  return (
    <div className="prose">
      <h1>Affiliate Disclosure</h1>
      <p>
        {site.name} participates in affiliate programmes run by Amazon and Flipkart, and in
        affiliate networks such as EarnKaro, INRDeals and Cuelinks.
      </p>

      <h2>What that means</h2>
      <ul>
        <li>Product links on this site are affiliate links.</li>
        <li>
          If you click one and buy something, we may earn a commission from the retailer. There is
          no extra cost to you.
        </li>
        <li>
          We do not sell products, take payments, hold stock or handle shipping. Your order,
          warranty, returns and support are entirely between you and the retailer.
        </li>
        <li>
          Prices and availability change constantly. The price on this page can be out of date — the
          price shown on the retailer's site at checkout is the one that applies.
        </li>
      </ul>

      <p>
        As an Amazon Associate we earn from qualifying purchases. Amazon, Flipkart and their logos
        are trademarks of their respective owners; this site is not endorsed by them.
      </p>
    </div>
  );
}

export function Privacy() {
  const { site } = useSite();
  return (
    <div className="prose">
      <h1>Privacy Policy</h1>
      <p>Short version: we do not ask you for personal data, and we do not sell any.</p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Click counts.</strong> When you click a deal we record which deal it was, the time,
          the page you came from and your browser's user-agent string. It tells us which deals are
          useful. It is not linked to a name, email or account.
        </li>
        <li>
          <strong>No accounts.</strong> Visitors cannot register, so we store no names, emails,
          addresses or payment details. Payments never touch this site.
        </li>
        <li>
          <strong>No advertising cookies</strong> are set by {site.name} itself.
        </li>
      </ul>

      <h2>Third parties</h2>
      <p>
        Clicking a deal takes you to Amazon, Flipkart or an affiliate network. They set their own
        cookies to attribute the sale, and their privacy policies apply once you leave this site.
      </p>

      <h2>Removing data</h2>
      <p>
        Click logs are aggregate and anonymous. If you have a question about them, use the{' '}
        <a href="/contact">contact page</a>.
      </p>
    </div>
  );
}

export function Contact() {
  const { site } = useSite();
  return (
    <div className="prose">
      <h1>Contact</h1>
      <p>
        Found a dead link, a wrong price, or a deal we should feature? Tell us — it keeps the site
        honest.
      </p>

      {site.contact_email ? (
        <p>
          Email: <a href={`mailto:${site.contact_email}`}>{site.contact_email}</a>
        </p>
      ) : (
        <p className="field-hint">
          Set a contact email in Admin → Settings and it will appear here.
        </p>
      )}

      <h2>What we cannot help with</h2>
      <p>
        We are not the seller. Order status, cancellations, refunds and warranty claims have to go
        through Amazon or Flipkart directly — we have no access to your order.
      </p>
    </div>
  );
}
