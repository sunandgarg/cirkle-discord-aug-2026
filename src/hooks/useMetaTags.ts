import { useEffect } from "react";

interface MetaTagsConfig {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  canonicalUrl?: string;
  keywords?: string;
}

/**
 * Dynamically sets page meta tags for SEO.
 * Cleans up and restores defaults on unmount.
 */
export function useMetaTags(config: MetaTagsConfig) {
  useEffect(() => {
    const previousTitle = document.title;

    if (config.title) {
      document.title = config.title;
    }

    const setMeta = (name: string, content: string, isProperty = false) => {
      const attr = isProperty ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    if (config.description) setMeta("description", config.description);
    if (config.keywords) setMeta("keywords", config.keywords);
    if (config.ogTitle) setMeta("og:title", config.ogTitle, true);
    if (config.ogDescription) setMeta("og:description", config.ogDescription, true);
    if (config.ogImage) setMeta("og:image", config.ogImage, true);
    if (config.ogUrl) setMeta("og:url", config.ogUrl, true);

    // Twitter
    if (config.ogTitle) setMeta("twitter:title", config.ogTitle);
    if (config.ogDescription) setMeta("twitter:description", config.ogDescription);

    // Canonical
    if (config.canonicalUrl) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = config.canonicalUrl;
    }

    return () => {
      document.title = previousTitle;
    };
  }, [config.title, config.description, config.ogTitle, config.ogDescription, config.ogImage, config.ogUrl, config.canonicalUrl, config.keywords]);
}
