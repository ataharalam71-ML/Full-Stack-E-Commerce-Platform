/**
 * The "Add to DealDost" bookmarklet.
 *
 * Amazon and Meesho will not serve their pages to a server, so the server cannot read them.
 * The admin's browser can: it is a real browser on a real connection, already showing the
 * page. This script runs there, reads the product the admin is looking at, and hands it to
 * the admin panel. No request is ever made to the store on our behalf.
 *
 * It is built as a source string so it can be minified into a single `javascript:` URL that
 * drags onto the bookmarks bar. Keep it dependency-free and defensive — it runs inside a
 * page whose markup we do not control, and it must never leave the admin looking at a
 * broken store page.
 */

/* eslint-disable no-useless-escape */
const SOURCE = `
(function () {
  var TARGET = '__ORIGIN__';

  function txt(sel) {
    var el = document.querySelector(sel);
    return el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : '';
  }
  function attr(sel, name) {
    var el = document.querySelector(sel);
    return el ? el.getAttribute(name) || '' : '';
  }
  function meta(name) {
    return (
      attr('meta[property="' + name + '"]', 'content') ||
      attr('meta[name="' + name + '"]', 'content')
    );
  }
  /* "₹1,299.00" -> 1299 . Rejects anything that is not a positive amount. */
  function money(v) {
    if (v === null || v === undefined) return null;
    var d = String(v).replace(/[^\\d.]/g, '');
    if (!d) return null;
    var n = Number(d.split('.').slice(0, 2).join('.'));
    return isFinite(n) && n > 0 ? n : null;
  }
  function rating(v) {
    var m = String(v == null ? '' : v).match(/(\\d(?:\\.\\d)?)/);
    if (!m) return null;
    var n = Number(m[1]);
    return n >= 0 && n <= 5 ? n : null;
  }

  /* ---- 1. schema.org Product, if the page publishes one (Flipkart does) ---- */
  function fromJsonLd() {
    var nodes = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < nodes.length; i++) {
      var data;
      try { data = JSON.parse(nodes[i].textContent); } catch (e) { continue; }
      var queue = [data];
      while (queue.length) {
        var n = queue.shift();
        if (!n || typeof n !== 'object') continue;
        if (Array.isArray(n)) { queue = queue.concat(n); continue; }
        if (n['@graph']) queue = queue.concat(n['@graph']);
        var types = [].concat(n['@type'] || []).join(' ').toLowerCase();
        if (types.indexOf('product') === -1) continue;

        var offers = [].concat(n.offers || []);
        var offer = null;
        for (var j = 0; j < offers.length; j++) {
          if (offers[j] && (offers[j].price || offers[j].lowPrice)) { offer = offers[j]; break; }
        }
        var price = offer ? money(offer.price || offer.lowPrice) : null;
        if (!price) continue;

        var img = n.image;
        if (Array.isArray(img)) img = img[0];
        if (img && typeof img === 'object') img = img.url;
        var brand = n.brand;
        if (brand && typeof brand === 'object') brand = brand.name;

        return {
          title: typeof n.name === 'string' ? n.name : '',
          price: price,
          mrp: money(n.highPrice || (offer && offer.highPrice)),
          image_url: typeof img === 'string' ? img : '',
          brand: typeof brand === 'string' ? brand : '',
          rating: n.aggregateRating ? rating(n.aggregateRating.ratingValue) : null
        };
      }
    }
    return null;
  }

  /* ---- 2. Per-store DOM, for the pages that publish no structured data ---- */
  function fromAmazon() {
    var price = money(
      txt('#corePriceDisplay_desktop_feature_div .a-price .a-offscreen') ||
      txt('.priceToPay .a-offscreen') ||
      txt('#corePrice_feature_div .a-price .a-offscreen') ||
      txt('.a-price .a-offscreen')
    );
    if (!price) return null;
    return {
      title: txt('#productTitle'),
      price: price,
      /* The struck-through "M.R.P." lives in its own row. */
      mrp: money(txt('.basisPrice .a-offscreen') || txt('[data-a-strike="true"] .a-offscreen')),
      image_url: attr('#landingImage', 'data-old-hires') || attr('#landingImage', 'src'),
      brand: txt('#bylineInfo').replace(/^(Visit the |Brand: )/i, '').replace(/ Store$/i, ''),
      rating: rating(attr('#acrPopover', 'title') || txt('#acrPopover .a-icon-alt'))
    };
  }

  function fromMeesho() {
    /* Meesho renders client-side, so by the time a human is looking at it the price is in
       the DOM even though a server would have received an empty shell. */
    var price = null;
    var nodes = document.querySelectorAll('h4, h5, span, div');
    for (var i = 0; i < nodes.length && !price; i++) {
      var t = (nodes[i].textContent || '').trim();
      if (/^₹\\s?[\\d,]+$/.test(t) && !nodes[i].children.length) price = money(t);
    }
    if (!price) return null;
    return {
      title: txt('h1') || meta('og:title'),
      price: price,
      mrp: null,
      image_url: meta('og:image') || attr('img[src*="mymeesho"]', 'src') || attr('img', 'src'),
      brand: '',
      rating: null
    };
  }

  function fromGeneric() {
    var price = money(meta('product:price:amount') || meta('og:price:amount'));
    if (!price) {
      var m = (document.body.innerText || '').match(/₹\\s?(?:\\d{1,3}(?:,\\d{2,3})+|\\d+)/);
      if (m) price = money(m[0]);
    }
    if (!price) return null;
    return {
      title: meta('og:title') || txt('h1') || document.title,
      price: price,
      mrp: null,
      image_url: meta('og:image'),
      brand: meta('og:brand') || '',
      rating: null
    };
  }

  var host = location.hostname.replace(/^www\\./, '');
  var isAmazon = /(^|\\.)(amazon\\.in|amazon\\.com)$/.test(host);
  var isMeesho = /(^|\\.)meesho\\.(com|in)$/.test(host);
  var isFlipkart = /(^|\\.)flipkart\\.com$/.test(host);

  if (!isAmazon && !isMeesho && !isFlipkart) {
    alert('Open an Amazon, Flipkart or Meesho product page first, then click this.');
    return;
  }

  /* Structured data first, then the store-specific reader, then the generic one. */
  var found = fromJsonLd();
  if (!found || !found.price) found = isAmazon ? fromAmazon() : isMeesho ? fromMeesho() : null;
  if (!found || !found.price) found = fromGeneric();

  if (!found || !found.price || !found.title) {
    alert(
      'Could not read a product from this page.\\n\\n' +
      'Make sure you are on the product page itself (not a search or category page) ' +
      'and that the price is visible, then try again.'
    );
    return;
  }

  /* A clean canonical link beats the current URL, which is full of tracking parameters. */
  var link = attr('link[rel="canonical"]', 'href') || location.href;
  if (isAmazon) {
    var asin = (location.pathname.match(/\\/(?:dp|gp\\/product)\\/([A-Z0-9]{10})/i) || [])[1];
    if (asin) link = 'https://www.amazon.in/dp/' + asin;
  }

  var item = {
    title: String(found.title).slice(0, 200),
    url: link,
    store: isAmazon ? 'amazon' : isMeesho ? 'meesho' : 'flipkart',
    price: found.price,
    mrp: found.mrp || null,
    brand: found.brand ? String(found.brand).slice(0, 80) : null,
    rating: found.rating || null,
    image_url: found.image_url || null,
    description: null
  };

  /* A named window means clicking this on ten products reuses one tab and collects them
     all, instead of burying the admin under ten tabs. */
  window.open(
    TARGET + '/admin?import=' + encodeURIComponent(JSON.stringify(item)),
    'dealdost_import'
  );
})();
`;

/** Squeezes the source into something short enough to live in a bookmark. */
function minify(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .split('\n')
    .map((line) => line.replace(/^\s+/, '').replace(/\s+$/, ''))
    .filter(Boolean)
    .join(' ')
    .replace(/\s{2,}/g, ' ');
}

/**
 * The `javascript:` URL to hang on the bookmarks bar. `origin` is this site's own origin,
 * so the bookmarklet always points back at wherever the panel is being served from.
 */
export function bookmarkletHref(origin) {
  return `javascript:${encodeURIComponent(minify(SOURCE).replace('__ORIGIN__', origin))}`;
}

export default bookmarkletHref;
