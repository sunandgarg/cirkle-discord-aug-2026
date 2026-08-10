/**
 * Core data structures for the platform.
 * Optimized for O(1) reads where possible.
 */

// ─── LRU Cache ───
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  constructor(private capacity: number) {}

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const val = this.cache.get(key)!;
    // Move to end (most recent)
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) this.cache.delete(key);
    else if (this.cache.size >= this.capacity) {
      // Evict oldest (first entry)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean { return this.cache.has(key); }
  delete(key: K): boolean { return this.cache.delete(key); }
  clear(): void { this.cache.clear(); }
  get size(): number { return this.cache.size; }
}

// ─── Post Feed Engine ───
export interface ScoredPost {
  id: string;
  score: number;
  createdAt: string;
}

export class PostFeedEngine {
  private postIndex = new Map<string, any>();
  private forumFeeds = new Map<string, ScoredPost[]>();
  private globalTrending: ScoredPost[] = [];
  private userFeedCache = new Map<string, { posts: string[]; generatedAt: number }>();
  private readonly TRENDING_CAP = 100;
  private readonly FEED_CACHE_TTL = 60_000; // 60s

  /** Calculate post score */
  static calcScore(post: any, isSameIIT: boolean = false): number {
    const upvotes = Object.values(post.reactions || {}).reduce<number>((s, c) => s + (typeof c === 'number' ? c : 0), 0);
    const comments = post.replyCount || 0;
    const hoursOld = (Date.now() - new Date(post.created_at).getTime()) / 3_600_000;
    const decayRate = isSameIIT ? 0.1 : 0.3;
    return (upvotes * 3) + (comments * 2) - (hoursOld * decayRate);
  }

  /** Index a post */
  indexPost(post: any, forumId: string): void {
    this.postIndex.set(post.id, post);
    const score = PostFeedEngine.calcScore(post);
    const entry: ScoredPost = { id: post.id, score, createdAt: post.created_at };

    // Add to forum feed
    let feed = this.forumFeeds.get(forumId) || [];
    feed = feed.filter(p => p.id !== post.id);
    feed.push(entry);
    feed.sort((a, b) => b.score - a.score);
    this.forumFeeds.set(forumId, feed);

    // Update global trending
    this.globalTrending = this.globalTrending.filter(p => p.id !== post.id);
    this.globalTrending.push(entry);
    this.globalTrending.sort((a, b) => b.score - a.score);
    if (this.globalTrending.length > this.TRENDING_CAP) {
      this.globalTrending = this.globalTrending.slice(0, this.TRENDING_CAP);
    }
  }

  /** Get posts for a forum, sorted by score */
  getForumFeed(forumId: string, limit = 20): any[] {
    const feed = this.forumFeeds.get(forumId) || [];
    return feed.slice(0, limit).map(e => this.postIndex.get(e.id)).filter(Boolean);
  }

  /** Get globally trending posts */
  getTrending(limit = 20): any[] {
    return this.globalTrending.slice(0, limit).map(e => this.postIndex.get(e.id)).filter(Boolean);
  }

  /** Get a post by ID - O(1) */
  getPost(id: string): any | undefined {
    return this.postIndex.get(id);
  }

  /** Generate personalized feed for a user */
  getUserFeed(userId: string, userIIT: string, followedForums: string[], limit = 20): any[] {
    const cached = this.userFeedCache.get(userId);
    if (cached && Date.now() - cached.generatedAt < this.FEED_CACHE_TTL) {
      return cached.posts.slice(0, limit).map(id => this.postIndex.get(id)).filter(Boolean);
    }

    // Merge: own IIT feed + followed + trending
    const seen = new Set<string>();
    const merged: ScoredPost[] = [];

    const addFeed = (forumId: string) => {
      (this.forumFeeds.get(forumId) || []).forEach(p => {
        if (!seen.has(p.id)) { seen.add(p.id); merged.push(p); }
      });
    };

    addFeed(userIIT);
    followedForums.forEach(addFeed);
    this.globalTrending.forEach(p => {
      if (!seen.has(p.id)) { seen.add(p.id); merged.push(p); }
    });

    merged.sort((a, b) => b.score - a.score);
    const postIds = merged.slice(0, limit).map(p => p.id);
    this.userFeedCache.set(userId, { posts: postIds, generatedAt: Date.now() });
    return postIds.map(id => this.postIndex.get(id)).filter(Boolean);
  }
}

// ─── Forum Tree ───
export interface ForumNode {
  id: string;
  type: "iit" | "dept" | "course" | "cohort" | "special";
  label: string;
  parentId: string | null;
  memberCount: number;
  postCount: number;
  lastActivityAt: string | null;
}

export class ForumTree {
  private nodes = new Map<string, ForumNode>();
  private children = new Map<string, Set<string>>();
  private parent = new Map<string, string>();
  private pathCache = new Map<string, string[]>();

  addNode(node: ForumNode): void {
    this.nodes.set(node.id, node);
    if (node.parentId) {
      this.parent.set(node.id, node.parentId);
      if (!this.children.has(node.parentId)) this.children.set(node.parentId, new Set());
      this.children.get(node.parentId)!.add(node.id);
    }
  }

  getNode(id: string): ForumNode | undefined { return this.nodes.get(id); }
  getChildren(id: string): ForumNode[] {
    const ids = this.children.get(id);
    if (!ids) return [];
    return Array.from(ids).map(cid => this.nodes.get(cid)).filter(Boolean) as ForumNode[];
  }

  /** Get path from root to node - cached after first computation */
  getPath(nodeId: string): string[] {
    if (this.pathCache.has(nodeId)) return this.pathCache.get(nodeId)!;
    const path: string[] = [];
    let current: string | undefined = nodeId;
    while (current) {
      path.unshift(current);
      current = this.parent.get(current);
    }
    this.pathCache.set(nodeId, path);
    return path;
  }

  /** Get all IIT root nodes */
  getIITs(): ForumNode[] {
    return Array.from(this.nodes.values()).filter(n => n.type === "iit");
  }

  get size(): number { return this.nodes.size; }

  /** Serialize for localStorage persistence */
  serialize(): string {
    return JSON.stringify(Array.from(this.nodes.values()));
  }

  static deserialize(json: string): ForumTree {
    const tree = new ForumTree();
    try {
      const nodes: ForumNode[] = JSON.parse(json);
      nodes.forEach(n => tree.addNode(n));
    } catch { /* ignore */ }
    return tree;
  }
}

// ─── Simple Search Engine (in-memory, main thread) ───
interface SearchDoc {
  id: string;
  type: "post" | "user" | "job" | "event" | "forum";
  title: string;
  body: string;
  iit?: string;
  createdAt?: string;
}

export class SearchEngine {
  private docs = new Map<string, SearchDoc>();
  private invertedIndex = new Map<string, Set<string>>();

  addDocument(doc: SearchDoc): void {
    this.docs.set(doc.id, doc);
    const terms = this.tokenize(doc.title + " " + doc.body);
    terms.forEach(term => {
      if (!this.invertedIndex.has(term)) this.invertedIndex.set(term, new Set());
      this.invertedIndex.get(term)!.add(doc.id);
    });
  }

  search(query: string, limit = 20, userIIT?: string): SearchDoc[] {
    const terms = this.tokenize(query);
    if (terms.length === 0) return [];

    // Score docs by number of matching terms
    const scores = new Map<string, number>();
    terms.forEach(term => {
      // Prefix matching
      for (const [indexTerm, docIds] of this.invertedIndex) {
        if (indexTerm.startsWith(term) || term.startsWith(indexTerm)) {
          docIds.forEach(id => {
            const current = scores.get(id) || 0;
            const doc = this.docs.get(id);
            const iitBoost = (doc?.iit && doc.iit === userIIT) ? 2 : 1;
            const recencyBoost = doc?.createdAt
              ? (Date.now() - new Date(doc.createdAt).getTime() < 86_400_000 ? 1.5 : 1)
              : 1;
            scores.set(id, current + (1 * iitBoost * recencyBoost));
          });
        }
      }
    });

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => this.docs.get(id)!)
      .filter(Boolean);
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(t => t.length >= 2);
  }

  get docCount(): number { return this.docs.size; }
}

// ─── Notification Engine ───
export interface AppNotification {
  id: string;
  type: string;
  priority: number; // 1-5
  title: string;
  message?: string;
  sourceId?: string;
  createdAt: string;
  isRead: boolean;
}

export class NotificationEngine {
  private notifications: AppNotification[] = [];
  private batchBuffer = new Map<string, { count: number; lastItem: AppNotification; timer: ReturnType<typeof setTimeout> }>();
  private readSet = new Set<string>();
  private readonly BATCH_WINDOW = 5 * 60_000; // 5 minutes

  static getPriority(type: string): number {
    const map: Record<string, number> = {
      direct_reply: 5, mention: 4, event_reminder: 4,
      upvote: 3, new_job: 3, forum_post: 2,
    };
    return map[type] || 2;
  }

  addNotification(notif: AppNotification): void {
    // Batch check - never batch direct replies
    if (notif.type !== "direct_reply" && notif.sourceId) {
      const batchKey = `${notif.type}:${notif.sourceId}`;
      const existing = this.batchBuffer.get(batchKey);
      if (existing) {
        existing.count++;
        existing.lastItem = notif;
        return;
      }
      const timer = setTimeout(() => this.flushBatch(batchKey), this.BATCH_WINDOW);
      this.batchBuffer.set(batchKey, { count: 1, lastItem: notif, timer });
      return;
    }
    this.notifications.push(notif);
    this.sortNotifications();
  }

  private flushBatch(key: string): void {
    const batch = this.batchBuffer.get(key);
    if (!batch) return;
    this.batchBuffer.delete(key);
    const batchedNotif: AppNotification = {
      ...batch.lastItem,
      message: batch.count > 1
        ? `${Math.min(batch.count, 99)}${batch.count > 99 ? "+" : ""} ${batch.lastItem.type}s`
        : batch.lastItem.message,
    };
    this.notifications.push(batchedNotif);
    this.sortNotifications();
  }

  markRead(id: string): void { this.readSet.add(id); }
  isRead(id: string): boolean { return this.readSet.has(id); }

  getUnreadCount(): number {
    return this.notifications.filter(n => !this.readSet.has(n.id)).length;
  }

  getAll(limit = 50): AppNotification[] {
    return this.notifications.slice(0, limit);
  }

  private sortNotifications(): void {
    this.notifications.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }
}

// ─── Request Deduplicator ───
export class RequestDeduplicator {
  private pending = new Map<string, Promise<any>>();
  private readonly DEDUP_WINDOW = 100; // ms

  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.pending.has(key)) return this.pending.get(key)! as Promise<T>;
    const promise = fn().finally(() => {
      setTimeout(() => this.pending.delete(key), this.DEDUP_WINDOW);
    });
    this.pending.set(key, promise);
    return promise;
  }
}

// ─── Singleton instances ───
export const postFeedEngine = new PostFeedEngine();
export const forumTree = new ForumTree();
export const searchEngine = new SearchEngine();
export const notificationEngine = new NotificationEngine();
export const requestDeduplicator = new RequestDeduplicator();
export const jobDetailCache = new LRUCache<string, any>(50);
