import React from "react";

/**
 * Parse and render formatted text:
 * **bold**, *italic*, __underline__, ~~strikethrough~~
 * `inline code`, ```code block```, ||spoiler||
 * Also auto-links URLs
 */

interface FormattingProps {
  text: string;
  profileMap: Map<string, any>;
  navigate: (path: string) => void;
}

const URL_REGEX = /(https?:\/\/[^\s<]+)/g;
const MENTION_REGEX = /@(\w[\w\s]*?)(?=\s|$|[.,!?])/g;

// Render inline formatting for a text segment (no mentions/links yet)
const renderInlineFormatting = (text: string, key: string): React.ReactNode => {
  // Process in order: code blocks, inline code, bold, italic, underline, strikethrough, spoiler
  
  // Code blocks: ```text```
  const codeBlockParts = text.split(/```([\s\S]*?)```/);
  if (codeBlockParts.length > 1) {
    return (
      <span key={key}>
        {codeBlockParts.map((part, i) =>
          i % 2 === 1 ? (
            <pre key={`${key}-cb-${i}`} className="bg-secondary text-foreground rounded-lg px-3 py-2 my-1 text-xs font-mono overflow-x-auto block whitespace-pre-wrap">
              {part}
            </pre>
          ) : (
            <span key={`${key}-cb-${i}`}>{renderInlineFormatting(part, `${key}-cb-${i}`)}</span>
          )
        )}
      </span>
    );
  }

  // Inline code: `text`
  const inlineCodeParts = text.split(/`([^`]+)`/);
  if (inlineCodeParts.length > 1) {
    return (
      <span key={key}>
        {inlineCodeParts.map((part, i) =>
          i % 2 === 1 ? (
            <code key={`${key}-ic-${i}`} className="bg-secondary text-destructive px-1.5 py-0.5 rounded text-xs font-mono">{part}</code>
          ) : (
            <span key={`${key}-ic-${i}`}>{renderInlineFormatting(part, `${key}-ic-${i}`)}</span>
          )
        )}
      </span>
    );
  }

  // Spoiler: ||text||
  const spoilerParts = text.split(/\|\|([^|]+)\|\|/);
  if (spoilerParts.length > 1) {
    return (
      <span key={key}>
        {spoilerParts.map((part, i) =>
          i % 2 === 1 ? (
            <SpoilerText key={`${key}-sp-${i}`} text={part} />
          ) : (
            <span key={`${key}-sp-${i}`}>{renderInlineFormatting(part, `${key}-sp-${i}`)}</span>
          )
        )}
      </span>
    );
  }

  // Bold: **text**
  const boldParts = text.split(/\*\*(.+?)\*\*/);
  if (boldParts.length > 1) {
    return (
      <span key={key}>
        {boldParts.map((part, i) =>
          i % 2 === 1 ? (
            <strong key={`${key}-b-${i}`}>{renderInlineFormatting(part, `${key}-b-${i}`)}</strong>
          ) : (
            <span key={`${key}-b-${i}`}>{renderInlineFormatting(part, `${key}-b-${i}`)}</span>
          )
        )}
      </span>
    );
  }

  // Italic: *text*
  const italicParts = text.split(/\*(.+?)\*/);
  if (italicParts.length > 1) {
    return (
      <span key={key}>
        {italicParts.map((part, i) =>
          i % 2 === 1 ? (
            <em key={`${key}-i-${i}`}>{renderInlineFormatting(part, `${key}-i-${i}`)}</em>
          ) : (
            <span key={`${key}-i-${i}`}>{renderInlineFormatting(part, `${key}-i-${i}`)}</span>
          )
        )}
      </span>
    );
  }

  // Underline: __text__
  const underlineParts = text.split(/__(.+?)__/);
  if (underlineParts.length > 1) {
    return (
      <span key={key}>
        {underlineParts.map((part, i) =>
          i % 2 === 1 ? (
            <u key={`${key}-u-${i}`}>{part}</u>
          ) : (
            <span key={`${key}-u-${i}`}>{part}</span>
          )
        )}
      </span>
    );
  }

  // Strikethrough: ~~text~~
  const strikeParts = text.split(/~~(.+?)~~/);
  if (strikeParts.length > 1) {
    return (
      <span key={key}>
        {strikeParts.map((part, i) =>
          i % 2 === 1 ? (
            <s key={`${key}-s-${i}`} className="text-muted-foreground">{part}</s>
          ) : (
            <span key={`${key}-s-${i}`}>{part}</span>
          )
        )}
      </span>
    );
  }

  return text;
};

// Spoiler component that reveals on click
const SpoilerText = ({ text }: { text: string }) => {
  const [revealed, setRevealed] = React.useState(false);
  return (
    <span
      onClick={() => setRevealed(!revealed)}
      className={`cursor-pointer rounded px-1 transition-all ${
        revealed ? "bg-secondary/50 text-foreground" : "bg-muted-foreground text-transparent select-none"
      }`}
    >
      {text}
    </span>
  );
};

/**
 * Full message renderer: handles @mentions, URLs, and formatting
 */
export const renderFormattedMessage = (
  text: string,
  profileMap: Map<string, any>,
  navigate: (path: string) => void
): React.ReactNode => {
  if (!text) return text;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  // Combined regex for mentions and URLs
  const combinedRegex = /(@(\w[\w\s]*?)(?=\s|$|[.,!?]))|(https?:\/\/[^\s<]+)/g;

  while ((match = combinedRegex.exec(text)) !== null) {
    // Add text before match with formatting
    if (match.index > lastIndex) {
      const beforeText = text.slice(lastIndex, match.index);
      parts.push(renderInlineFormatting(beforeText, `pre-${match.index}`));
    }

    if (match[1]) {
      // It's a @mention
      const mentionName = match[2].trim();
      let foundProfile: any = null;
      profileMap.forEach((p) => {
        if (p.name?.toLowerCase() === mentionName.toLowerCase()) foundProfile = p;
      });
      if (foundProfile) {
        parts.push(
          <button
            key={`mention-${match.index}`}
            onClick={() => navigate(foundProfile.slug ? `/u/${foundProfile.slug}` : `/profile/${foundProfile.user_id}`)}
            className="text-primary font-semibold hover:underline bg-primary/10 px-1 rounded"
          >
            @{mentionName}
          </button>
        );
      } else {
        parts.push(
          <span key={`mention-${match.index}`} className="text-primary font-semibold bg-primary/10 px-1 rounded">
            @{mentionName}
          </span>
        );
      }
    } else if (match[3]) {
      // It's a URL
      const url = match[3];
      parts.push(
        <a
          key={`url-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline break-all"
        >
          {url.length > 50 ? url.slice(0, 50) + "…" : url}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(renderInlineFormatting(text.slice(lastIndex), `post-${lastIndex}`));
  }

  return parts.length > 0 ? <>{parts}</> : renderInlineFormatting(text, "full");
};

export default renderFormattedMessage;
