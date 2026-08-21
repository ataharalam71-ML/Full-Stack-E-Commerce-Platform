import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api';

const FALLBACK = {
  site: { name: 'DealDost', tagline: 'Handpicked deals from Amazon & Flipkart', contact_email: '' },
  stores: [
    { key: 'amazon', label: 'Amazon', color: '#ff9900' },
    { key: 'flipkart', label: 'Flipkart', color: '#2874f0' },
  ],
};

const SiteContext = createContext(FALLBACK);

/** Site name/tagline/store list come from the API so Admin -> Settings edits show up everywhere. */
export function SiteProvider({ children }) {
  const [value, setValue] = useState(FALLBACK);

  useEffect(() => {
    let alive = true;
    api
      .get('/site')
      .then(({ data }) => {
        if (alive) setValue({ site: { ...FALLBACK.site, ...data.site }, stores: data.stores });
      })
      .catch(() => {
        /* API down: keep the fallback branding rather than blanking the page */
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    document.title = `${value.site.name} — ${value.site.tagline}`;
  }, [value.site.name, value.site.tagline]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export const useSite = () => useContext(SiteContext);
