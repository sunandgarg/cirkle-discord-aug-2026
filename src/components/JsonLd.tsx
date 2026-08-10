import { useEffect } from "react";

interface JsonLdProps {
  data: Record<string, any>;
}

/**
 * Injects JSON-LD structured data into the page head.
 * Cleans up on unmount.
 */
export const JsonLd = ({ data }: JsonLdProps) => {
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify({ "@context": "https://schema.org", ...data });
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, [data]);

  return null;
};

// ─── Pre-built schemas ───

export const WebSiteSchema = (name: string, url: string) => ({
  "@type": "WebSite",
  name,
  url,
  potentialAction: {
    "@type": "SearchAction",
    target: `${url}/search?q={query}`,
    "query-input": "required name=query",
  },
});

export const OrganizationSchema = (iitName: string, url: string, description: string) => ({
  "@type": "Organization",
  name: `${iitName} Community`,
  description,
  url,
  memberOf: { "@type": "Organization", name: "IITs India" },
});

export const DiscussionPostSchema = (post: {
  title: string; content: string; author: string;
  datePublished: string; dateModified?: string;
  likes?: number; comments?: number;
}) => ({
  "@type": "DiscussionForumPosting",
  headline: post.title,
  text: post.content.slice(0, 500),
  author: { "@type": "Person", name: post.author },
  datePublished: post.datePublished,
  dateModified: post.dateModified || post.datePublished,
  interactionStatistic: [
    {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/LikeAction",
      userInteractionCount: post.likes || 0,
    },
    {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/CommentAction",
      userInteractionCount: post.comments || 0,
    },
  ],
});

export const JobPostingSchema = (job: {
  title: string; company: string; location: string;
  description: string; datePosted: string;
  salary?: string; jobType?: string;
}) => ({
  "@type": "JobPosting",
  title: job.title,
  hiringOrganization: {
    "@type": "Organization",
    name: job.company,
  },
  jobLocation: {
    "@type": "Place",
    address: { "@type": "PostalAddress", addressLocality: job.location, addressCountry: "IN" },
  },
  description: job.description,
  datePosted: job.datePosted,
  employmentType: job.jobType || "FULL_TIME",
});

export const EventSchema = (event: {
  name: string; startDate: string; endDate?: string;
  location?: string; description?: string; url?: string;
}) => ({
  "@type": "Event",
  name: event.name,
  startDate: event.startDate,
  endDate: event.endDate || event.startDate,
  location: event.location ? {
    "@type": "Place",
    name: event.location,
    address: { "@type": "PostalAddress", addressCountry: "IN" },
  } : undefined,
  description: event.description,
  url: event.url,
});

export const FAQSchema = (faqs: { question: string; answer: string }[]) => ({
  "@type": "FAQPage",
  mainEntity: faqs.map(faq => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
});

export default JsonLd;
