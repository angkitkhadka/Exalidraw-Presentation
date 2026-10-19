import type { SlideTransition } from "./slides";

/**
 * The content of the built-in demo deck: a hundred slides on how the web
 * works, from a typed address to pixels on screen.
 *
 * The shapes are deliberately plain so the layouts can be reused: every slide
 * is one of the kinds in `demoDeck.ts`.
 */

type SlideBase = {
  /** the part of the deck this slide belongs to, shown in the footer */
  section?: string;
  transition?: SlideTransition;
  /** speaker notes */
  notes?: string;
  /** reveal the content one bullet at a time */
  reveal?: boolean;
};

export type DemoSlideSpec = SlideBase &
  (
    | {
        kind: "cover";
        title: string;
        subtitle: string;
        badge?: string;
      }
    | {
        kind: "agenda";
        eyebrow?: string;
        title: string;
        items: { label: string; detail: string }[];
      }
    | {
        kind: "section";
        number: string;
        title: string;
        summary: string;
      }
    | {
        kind: "bullets";
        eyebrow?: string;
        title: string;
        bullets: { text: string; detail?: string }[];
        note?: string;
      }
    | {
        kind: "columns";
        eyebrow?: string;
        title: string;
        columns: { heading: string; bullets: string[] }[];
      }
    | {
        kind: "cards";
        eyebrow?: string;
        title: string;
        cards: { title: string; body: string }[];
      }
    | {
        kind: "stats";
        eyebrow?: string;
        title: string;
        stats: { value: string; label: string }[];
        note?: string;
      }
    | {
        kind: "flow";
        eyebrow?: string;
        title: string;
        steps: string[];
        note?: string;
      }
    | {
        kind: "steps";
        eyebrow?: string;
        title: string;
        steps: { title: string; body: string }[];
      }
    | {
        kind: "quote";
        quote: string;
        cite: string;
      }
    | {
        kind: "compare";
        eyebrow?: string;
        title: string;
        left: { heading: string; bullets: string[] };
        right: { heading: string; bullets: string[] };
      }
    | {
        kind: "code";
        eyebrow?: string;
        title: string;
        language: string;
        code: string;
      }
    | {
        kind: "table";
        eyebrow?: string;
        title: string;
        headers: string[];
        rows: string[][];
      }
    | {
        kind: "takeaway";
        eyebrow?: string;
        title: string;
        body: string;
        points?: string[];
      }
    | {
        kind: "end";
        title: string;
        subtitle: string;
        links: { label: string; detail: string }[];
      }
  );

export const DEMO_TITLE = "How the Web Works";

const PART_1 = "Name resolution";
const PART_2 = "The connection";
const PART_3 = "The request";
const PART_4 = "The response";
const PART_5 = "The rendering";
const PART_6 = "The runtime";
const PART_7 = "Measuring";
const PART_8 = "The modern web";

export const DEMO_SLIDES: DemoSlideSpec[] = [
  // ---------------------------------------------------------------- opening
  {
    kind: "cover",
    title: "How the Web Works",
    subtitle: "From a typed address to pixels on screen",
    badge: "Start the tour",
    notes:
      "This deck is the demo that ships with the app. Press F5 at any point to present it, and R to replay the draw-in on a slide.",
  },
  {
    kind: "agenda",
    eyebrow: "Contents",
    title: "Eight parts, one journey",
    items: [
      { label: PART_1, detail: "Turning a name into an address" },
      { label: PART_2, detail: "A reliable, private channel" },
      { label: PART_3, detail: "Asking for something" },
      { label: PART_4, detail: "Answering, and caching the answer" },
      { label: PART_5, detail: "Turning bytes into a picture" },
      { label: PART_6, detail: "The loop that keeps it alive" },
      { label: PART_7, detail: "Measuring what the user feels" },
      { label: PART_8, detail: "Where the platform is heading" },
    ],
    notes:
      "The eight parts follow the order a single request actually takes. Each one is short on purpose.",
  },
  {
    kind: "bullets",
    eyebrow: "The short version",
    title: "What happens when you press Enter",
    bullets: [
      {
        text: "The browser checks its own caches first",
        detail:
          "Memory, disk, and the service worker, before any network work at all",
      },
      {
        text: "It resolves the name to an address",
        detail:
          "A resolver walks the DNS hierarchy and answers with an IP address",
      },
      {
        text: "It opens a connection and secures it",
        detail:
          "A TCP handshake, then a TLS handshake that produces session keys",
      },
      {
        text: "It sends a request and reads a response",
        detail: "One request line, a set of headers, and a body of bytes",
      },
      {
        text: "The browser turns bytes into pixels",
        detail: "Parse, style, lay out, paint, composite, then run the page",
      },
    ],
    reveal: true,
    notes:
      "Ask the room which of these they could explain. The point is that most of the perceived speed lives in the first and last steps.",
  },
  {
    kind: "flow",
    eyebrow: "The journey",
    title: "One request, six phases",
    steps: ["Resolve", "Connect", "Secure", "Request", "Render", "Run"],
    note: "Each phase has its own budget, its own failure modes, and its own place in the waterfall.",
    notes: "Keep this slide up while you talk about the other parts.",
  },
  {
    kind: "stats",
    eyebrow: "The budget",
    title: "Where the time usually goes",
    stats: [
      { value: "0.05s", label: "name resolution, when it is warm" },
      { value: "0.15s", label: "the connection and the handshake" },
      { value: "0.60s", label: "waiting for the first byte" },
    ],
    note: "Medians from a cold navigation on a fast connection. Your own numbers will look different, the shape usually does not.",
    notes:
      "These are medians, not guarantees. The important idea is that the server wait is usually the biggest slice.",
  },
  {
    kind: "cards",
    eyebrow: "The cast",
    title: "Three actors, one conversation",
    cards: [
      {
        title: "The browser",
        body: "Resolves, connects, caches, parses, lays out and paints. It owns the user experience.",
      },
      {
        title: "The network",
        body: "Moves packets between machines. It is unreliable, so every layer above it adds checks.",
      },
      {
        title: "The server",
        body: "Answers a request with a response. It may be one machine or ten thousand behind a load balancer.",
      },
    ],
    notes:
      "Everything in the rest of the deck is one of these three doing its job.",
  },
  {
    kind: "bullets",
    eyebrow: "A useful model",
    title: "The web is a cache in front of a computer",
    bullets: [
      {
        text: "Every layer tries to avoid the network",
        detail:
          "The browser, the operating system, the resolver, the CDN, the proxy",
      },
      {
        text: "Caching is the default, not the exception",
        detail:
          "Almost every request is answered from somewhere closer than the origin",
      },
      {
        text: "Freshness is a negotiation",
        detail:
          "The server states a policy, the client decides whether it can live with it",
      },
    ],
    notes:
      "If the audience remembers one idea, this is the one. The rest of the deck is detail on top of it.",
  },
  {
    kind: "takeaway",
    eyebrow: "Part one",
    title: "Why any of this matters",
    body: "A page is not one request. It is a negotiation between three parties, mediated by a chain of caches, with a hard deadline set by human attention.",
    points: [
      "The network is slow and unreliable, so everything is built to hide it",
      "The browser is the only party the user can actually see",
      "Most performance work is cache work",
    ],
  },

  // ------------------------------------------------------- name resolution
  {
    kind: "section",
    number: "01",
    title: PART_1,
    summary:
      "Turning a name people can remember into an address machines can use.",
    notes:
      "The first part is about the one step that has nothing to do with the web itself.",
  },
  {
    kind: "bullets",
    eyebrow: PART_1,
    title: "What a resolver actually does",
    bullets: [
      {
        text: "The client asks a recursive resolver",
        detail:
          "Usually one run by your internet provider, or one you configure yourself",
      },
      {
        text: "The resolver walks the hierarchy",
        detail:
          "Root, then the top level domain, then the authoritative server",
      },
      {
        text: "The answer is cached on the way back",
        detail: "Every hop in the chain is allowed to remember it for a while",
      },
      {
        text: "The browser remembers it too",
        detail: "Chrome keeps a small in-memory cache for the session",
      },
    ],
    reveal: true,
    notes:
      "The resolver does the walking so that the client only ever makes one simple question.",
  },
  {
    kind: "flow",
    eyebrow: PART_1,
    title: "The lookup path",
    steps: [
      "Browser cache",
      "Resolver cache",
      "Root server",
      "Domain server",
      "Answer",
    ],
    note: "Each step can answer on its own. The first one that can, does.",
    notes: "Point out that a warm lookup often never leaves the machine.",
  },
  {
    kind: "steps",
    eyebrow: PART_1,
    title: "Resolving one name",
    steps: [
      {
        title: "Ask the resolver",
        body: "The browser sends the name and the type it wants, usually over UDP on port 53.",
      },
      {
        title: "Try the root",
        body: "The root does not know the answer, but it knows which server is responsible for the domain.",
      },
      {
        title: "Try the domain server",
        body: "The authoritative server holds the record and returns it with a time to live.",
      },
      {
        title: "Cache on the way back",
        body: "The resolver stores the answer until the time to live expires, then repeats the walk if asked again.",
      },
    ],
    notes:
      "The referral to the domain server is the part people usually miss. The root is a directory, not an answer.",
  },
  {
    kind: "columns",
    eyebrow: PART_1,
    title: "The record types you will meet",
    columns: [
      {
        heading: "Addresses",
        bullets: [
          "A holds an IPv4 address",
          "AAAA holds an IPv6 address",
          "A site usually publishes both",
        ],
      },
      {
        heading: "Indirection",
        bullets: [
          "CNAME is an alias to another name",
          "MX says where mail should go",
          "TXT holds free form text",
        ],
      },
    ],
  },
  {
    kind: "table",
    eyebrow: PART_1,
    title: "Record types at a glance",
    headers: ["Record", "Holds", "Typical use"],
    rows: [
      ["A", "An IPv4 address", "A host that serves HTTP"],
      ["AAAA", "An IPv6 address", "The same host, in the other family"],
      [
        "CNAME",
        "Another name",
        "Aliases such as www pointing at a bare domain",
      ],
      ["MX", "Mail servers", "Where mail for the domain goes"],
      ["NS", "Authoritative servers", "Which servers hold the real records"],
      ["TXT", "Arbitrary text", "Ownership proofs and mail policy"],
    ],
    notes:
      "Mention that mixing A and AAAA is how a site gets both address families without the user noticing.",
  },
  {
    kind: "bullets",
    eyebrow: PART_1,
    title: "Caching and the time to live",
    bullets: [
      {
        text: "The time to live is a promise, not a rule",
        detail:
          "A record may be cached for up to that many seconds, and usually is",
      },
      {
        text: "A short time to live moves work to the client",
        detail:
          "Good for records that change often, bad for records that are read often",
      },
      {
        text: "A long time to live is a fast path",
        detail: "Nothing has to be resolved again until the promise expires",
      },
    ],
    notes:
      "A time to live of zero means do not cache, and the answer is not fast.",
  },
  {
    kind: "code",
    eyebrow: PART_1,
    title: "A query on the wire",
    language: "DNS over UDP",
    code: `;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 41234
;; flags: rd; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 0
;; QUESTION SECTION:
;example.com.              IN      A

;; ANSWER SECTION:
example.com.        3600    IN      A       93.184.216.34`,
    notes:
      "The header carries an id so that replies can be matched to questions, which is how a datagram protocol stays in order.",
  },
  {
    kind: "bullets",
    eyebrow: PART_1,
    title: "The hosts file",
    bullets: [
      {
        text: "A plain text file that maps names to addresses",
        detail: "Checked before any resolver is consulted",
      },
      {
        text: "Still the fastest lookup available",
        detail: "A local file read with no network involved at all",
      },
      {
        text: "Easy to get wrong",
        detail:
          "A stale entry sends the browser to an address that no longer serves the site",
      },
    ],
    notes: "A good example of a cache that you control completely.",
  },
  {
    kind: "columns",
    eyebrow: PART_1,
    title: "Encrypted name resolution",
    columns: [
      {
        heading: "Plain DNS",
        bullets: [
          "Every name you look up is visible on the path",
          "The answer can be rewritten in flight",
          "Cheap, and easy to intercept",
        ],
      },
      {
        heading: "Encrypted DNS",
        bullets: [
          "DNS over HTTPS puts the query inside TLS",
          "DNS over TLS does the same in its own channel",
          "Only the resolver sees the name",
        ],
      },
    ],
  },

  // ------------------------------------------------------------ connection
  {
    kind: "section",
    number: "02",
    title: PART_2,
    summary:
      "Getting a private, ordered, reliable channel to the right machine.",
    notes: "Part two is the transport layer and everything built on top of it.",
  },
  {
    kind: "bullets",
    eyebrow: PART_2,
    title: "TCP, in one slide",
    bullets: [
      {
        text: "It is a connection, not a stream of independent packets",
        detail:
          "Both sides agree on a starting sequence number and acknowledge what they received",
      },
      {
        text: "It is reliable and ordered",
        detail:
          "Missing data is retransmitted, and out of order data is put back in line",
      },
      {
        text: "It is not fast, it is sure",
        detail: "Every design choice trades latency for certainty",
      },
    ],
    notes:
      "Reliability is why HTTP over TCP is simple, and why QUIC was such a large change.",
  },
  {
    kind: "flow",
    eyebrow: PART_2,
    title: "The three way handshake",
    steps: ["SYN", "SYN ACK", "ACK"],
    note: "Three messages to agree on a connection, and to exchange the initial sequence numbers.",
    notes:
      "The third message carries no data, but it is what tells the server the client heard back.",
  },
  {
    kind: "bullets",
    eyebrow: PART_2,
    title: "What the handshake buys you",
    bullets: [
      {
        text: "Both sides know the other is reachable",
        detail:
          "A half open connection would let a server send data into nothing",
      },
      {
        text: "Both sides know where the byte stream starts",
        detail: "Sequence numbers make loss and reordering detectable",
      },
      {
        text: "Both sides agree on how to end the connection",
        detail: "A clean close avoids the reset that breaks other connections",
      },
    ],
    notes: "Ask the room how many messages a TLS handshake needs. It is more.",
  },
  {
    kind: "code",
    eyebrow: PART_2,
    title: "A handshake on the wire",
    language: "TCP",
    code: `client -> server  SYN      seq=0
server -> client  SYN ACK  seq=0 ack=1
client -> server  ACK      seq=1 ack=1

client -> server  PSH ACK  seq=1  len=80   "GET / HTTP/1.1"
server -> client  ACK      seq=1  ack=81`,
    notes:
      "The data rides along on the fourth message, which is why the handshake cost is paid once per connection.",
  },
  {
    kind: "bullets",
    eyebrow: PART_2,
    title: "TLS, the short version",
    bullets: [
      {
        text: "It agrees on a cipher and proves who you are",
        detail:
          "A certificate chain proves the server owns the name in the address bar",
      },
      {
        text: "It derives keys nobody else can derive",
        detail:
          "A key agreement that stays secret even if the exchange is recorded",
      },
      {
        text: "Everything after it is encrypted",
        detail: "Headers, bodies, and the fact that you visited at all",
      },
    ],
    notes:
      "Encryption without authentication is useless, which is why certificates matter more than the cipher list.",
  },
  {
    kind: "steps",
    eyebrow: PART_2,
    title: "The TLS 1.3 handshake",
    steps: [
      {
        title: "Client hello",
        body: "The client offers versions, cipher suites, a key share, and a random value.",
      },
      {
        title: "Server hello",
        body: "The server picks one option, sends its own key share, and its certificate.",
      },
      {
        title: "Finished messages",
        body: "Both sides confirm that the transcript matches, and the session keys are ready.",
      },
    ],
    notes:
      "In TLS 1.3 most of the handshake is one round trip, and the certificate is sent by the server rather than requested.",
  },
  {
    kind: "steps",
    eyebrow: PART_2,
    title: "Certificates and chains",
    steps: [
      {
        title: "The certificate",
        body: "Names a host, carries a public key, and is signed by an authority.",
      },
      {
        title: "The intermediate",
        body: "Signs the certificate, and is itself signed by something higher up.",
      },
      {
        title: "The root",
        body: "Trusted because it is installed in your operating system, not fetched.",
      },
      {
        title: "The check",
        body: "The browser verifies the name, the expiry, and every signature in the chain.",
      },
    ],
  },
  {
    kind: "compare",
    eyebrow: PART_2,
    title: "TLS 1.2 and TLS 1.3",
    left: {
      heading: "TLS 1.2",
      bullets: [
        "Two round trips before any data",
        "The cipher suite is chosen by the server",
        "Old algorithms still allowed by default",
      ],
    },
    right: {
      heading: "TLS 1.3",
      bullets: [
        "One round trip before any data",
        "The client offers, the server confirms",
        "Old algorithms removed, and forward secrecy is the default",
      ],
    },
    notes:
      "The round trip difference is why the protocol version matters for latency.",
  },
  {
    kind: "steps",
    eyebrow: PART_2,
    title: "Session resumption",
    steps: [
      {
        title: "The first visit",
        body: "A full handshake runs, and it is deliberately expensive.",
      },
      {
        title: "The ticket",
        body: "The server hands back a token that proves the session already happened.",
      },
      {
        title: "The next visit",
        body: "The client presents the ticket, and the expensive work is skipped.",
      },
    ],
  },
  {
    kind: "bullets",
    eyebrow: PART_2,
    title: "Agreeing on the protocol",
    bullets: [
      {
        text: "The client offers a list of protocols in the TLS handshake",
        detail:
          "Named by the application layer extension for protocol negotiation",
      },
      {
        text: "The server picks one",
        detail: "Usually the most preferred one it also supports",
      },
      {
        text: "The choice is reused for the whole connection",
        detail: "Which is why a new connection is needed to change protocol",
      },
    ],
    notes:
      "This is the mechanism behind negotiating HTTP/2 instead of HTTP/1.1, and HTTP/3 instead of both.",
  },
  {
    kind: "stats",
    eyebrow: PART_2,
    title: "What a handshake costs",
    stats: [
      { value: "1", label: "round trip for TLS 1.3" },
      { value: "2", label: "round trips for TCP plus TLS" },
      { value: "0", label: "round trips once a session is resumed" },
    ],
    note: "Every round trip is a full delay to the farthest server. On a long path, they add up.",
    notes:
      "This is the strongest argument for connection reuse and for a warm cache.",
  },

  // --------------------------------------------------------------- request
  {
    kind: "section",
    number: "03",
    title: PART_3,
    summary: "Saying what you want, in a form the server can act on.",
    notes:
      "Part three is the application protocol, and the request is its smallest unit.",
  },
  {
    kind: "cards",
    eyebrow: PART_3,
    title: "The anatomy of a request",
    cards: [
      {
        title: "The request line",
        body: "The method, the path, and the version of the protocol. One line, and it sets the tone.",
      },
      {
        title: "The headers",
        body: "Metadata about the request and about the client. Optional, but they change the meaning.",
      },
      {
        title: "The body",
        body: "Content carried with the request. Only some methods have one, and it is often optional too.",
      },
    ],
  },
  {
    kind: "code",
    eyebrow: PART_3,
    title: "A raw request",
    language: "HTTP/1.1",
    code: `GET /articles/42 HTTP/1.1
Host: example.com
User-Agent: Mozilla/5.0
Accept: text/html
Accept-Encoding: gzip, br
Connection: keep-alive`,
    notes:
      "Point at the Host header. In HTTP/1.1 it is required, because the connection no longer implies which site you want.",
  },
  {
    kind: "bullets",
    eyebrow: PART_3,
    title: "Methods and what they promise",
    bullets: [
      {
        text: "GET and HEAD read",
        detail:
          "They must not change anything on the server, so they can be cached and retried",
      },
      {
        text: "POST creates or processes",
        detail: "It may not be repeatable, so it is never cached by default",
      },
      {
        text: "PUT and DELETE are idempotent",
        detail: "Doing them twice leaves the same state as doing them once",
      },
      {
        text: "PATCH changes part of a resource",
        detail: "The body describes the change rather than the new whole",
      },
    ],
    notes:
      "Idempotency is the useful distinction, not the method names themselves.",
  },
  {
    kind: "table",
    eyebrow: PART_3,
    title: "Methods at a glance",
    headers: ["Method", "Safe", "Repeatable", "Has a body"],
    rows: [
      ["GET", "yes", "yes", "no"],
      ["HEAD", "yes", "yes", "no"],
      ["POST", "no", "no", "yes"],
      ["PUT", "no", "yes", "yes"],
      ["PATCH", "no", "no", "yes"],
      ["DELETE", "no", "yes", "rarely"],
    ],
    notes:
      "Safe means it does not change state. Repeatable means doing it twice is the same as doing it once.",
  },
  {
    kind: "cards",
    eyebrow: PART_3,
    title: "The headers that matter most",
    cards: [
      {
        title: "Host",
        body: "Which site you want, and which one the certificate has to cover.",
      },
      {
        title: "Accept",
        body: "What formats and what compression the client is able to handle.",
      },
      {
        title: "Cache-Control",
        body: "How long this may be kept, and by whom. The header that changes everything.",
      },
    ],
  },
  {
    kind: "bullets",
    eyebrow: PART_3,
    title: "Content negotiation",
    bullets: [
      {
        text: "The client states what it can accept",
        detail: "By type, by language, by encoding, or by quality value",
      },
      {
        text: "The server chooses one and says what it chose",
        detail: "The response carries a Content-Type that must match",
      },
      {
        text: "Quality values break ties",
        detail: "A number between zero and one ranks the acceptable options",
      },
    ],
    notes:
      "A quality value of zero means not acceptable at all, which is how you exclude one option.",
  },
  {
    kind: "bullets",
    eyebrow: PART_3,
    title: "Cookies and state",
    bullets: [
      {
        text: "A cookie is a small piece of state the server asked the browser to keep",
        detail:
          "It is sent back with every request to the matching path and domain",
      },
      {
        text: "The SameSite attribute decides who may send it",
        detail: "It is the main defence against cross site request forgery",
      },
      {
        text: "The HttpOnly flag hides it from scripts",
        detail:
          "A stolen page cannot read it, though it can still trigger requests",
      },
    ],
    notes:
      "Cookies are the oldest state mechanism on the web and still the most abused.",
  },
  {
    kind: "bullets",
    eyebrow: PART_3,
    title: "Asking about freshness",
    bullets: [
      {
        text: "The client says what it already has",
        detail: "A validator such as an entity tag, or a last modified date",
      },
      {
        text: "The server compares",
        detail:
          "If nothing changed, it answers with a small not modified response",
      },
      {
        text: "The client keeps the copy it has",
        detail:
          "A body of a few hundred bytes is often cheaper than a full transfer",
      },
    ],
    notes:
      "This is the cheapest performance win available, and it needs one header.",
  },
  {
    kind: "compare",
    eyebrow: PART_3,
    title: "HTTP/1.1 and HTTP/2",
    left: {
      heading: "HTTP/1.1",
      bullets: [
        "One request at a time per connection",
        "Many connections to work around that",
        "Headers are sent in full on every request",
      ],
    },
    right: {
      heading: "HTTP/2",
      bullets: [
        "Many streams multiplexed on one connection",
        "Header fields are compressed and indexed",
        "The transport handles prioritisation for you",
      ],
    },
    notes:
      "HTTP/2 does not make a single request faster, it makes many requests cheaper.",
  },
  {
    kind: "bullets",
    eyebrow: PART_3,
    title: "Multiplexing",
    bullets: [
      {
        text: "One connection, many streams",
        detail:
          "Each stream has an identifier, so responses can arrive in any order",
      },
      {
        text: "No application level queueing",
        detail: "The head of line blocking problem largely disappears",
      },
      {
        text: "The trade is TCP",
        detail: "A lost packet still stalls every stream on that connection",
      },
    ],
    notes: "The last point is exactly what HTTP/3 was built to fix.",
  },
  {
    kind: "bullets",
    eyebrow: PART_3,
    title: "Smaller headers",
    bullets: [
      {
        text: "Header compression was the point",
        detail: "A typical request repeats the same fields over and over",
      },
      {
        text: "A table of common fields is predefined",
        detail: "So a common header costs a single index",
      },
      {
        text: "Repeated fields are indexed",
        detail: "The second Cookie header costs almost nothing",
      },
    ],
    notes: "On a busy page, headers can be larger than the body.",
  },
  {
    kind: "bullets",
    eyebrow: PART_3,
    title: "Preloading and early hints",
    bullets: [
      {
        text: "A server can name the resources it expects to be needed",
        detail:
          "A preload header or an early hints response arrives before the body",
      },
      {
        text: "The browser starts those fetches immediately",
        detail: "Without waiting to discover the references in the document",
      },
      {
        text: "Used well it removes a whole round trip",
        detail:
          "Used badly it wastes bandwidth on resources that are never used",
      },
    ],
    notes: "The discipline is to preload only what you are certain about.",
  },
  {
    kind: "steps",
    eyebrow: PART_3,
    title: "Streaming a response",
    steps: [
      {
        title: "The server starts early",
        body: "It can send the head and the first part of the body long before the work is finished.",
      },
      {
        title: "The browser starts early",
        body: "It parses and paints what has arrived, instead of waiting for the last byte.",
      },
      {
        title: "The first paint arrives sooner",
        body: "Time to first byte becomes time to first paint, which is what the user feels.",
      },
      {
        title: "Nothing buffers",
        body: "It needs a server that flushes, and proxies that have been told not to buffer.",
      },
    ],
  },

  // -------------------------------------------------------------- response
  {
    kind: "section",
    number: "04",
    title: PART_4,
    summary: "Answering well, and making sure the answer is not sent twice.",
    notes: "Part four is about the response and the caches in front of it.",
  },
  {
    kind: "bullets",
    eyebrow: PART_4,
    title: "Status codes, grouped",
    bullets: [
      {
        text: "2xx means it worked",
        detail: "200 for a body, 204 for no body, 206 for part of a body",
      },
      {
        text: "3xx means look elsewhere",
        detail:
          "301 is permanent, 302 is temporary, 304 means your copy is still good",
      },
      {
        text: "4xx means you asked wrongly",
        detail:
          "400 is a bad request, 401 needs credentials, 403 is not allowed, 404 is missing",
      },
      {
        text: "5xx means we failed",
        detail: "The request was fine, the server was not",
      },
    ],
    notes:
      "The most useful distinction is 4xx against 5xx, because only one of them is worth retrying.",
  },
  {
    kind: "table",
    eyebrow: PART_4,
    title: "The families and their meaning",
    headers: ["Family", "Meaning", "Who should act"],
    rows: [
      ["2xx", "Success", "The client reads the body"],
      ["3xx", "A redirect", "The client follows it"],
      ["4xx", "Client error", "The client changes the request"],
      ["5xx", "Server error", "The client may retry later"],
    ],
    notes: "Retry a 5xx, fix a 4xx.",
  },
  {
    kind: "bullets",
    eyebrow: PART_4,
    title: "Content types",
    bullets: [
      {
        text: "The type tells the browser what the bytes mean",
        detail: "A mislabelled type is worse than no type at all",
      },
      {
        text: "Text types carry a charset",
        detail: "Without it the browser guesses, and guesses differently",
      },
      {
        text: "The type also picks a parser",
        detail: "The same bytes mean different things depending on the type",
      },
    ],
    notes: "A missing charset is a classic source of mojibake.",
  },
  {
    kind: "bullets",
    eyebrow: PART_4,
    title: "Compression",
    bullets: [
      {
        text: "Text compresses extremely well",
        detail: "Markup and scripts are mostly repeated structure",
      },
      {
        text: "The client states what it accepts",
        detail: "Usually a list of modern algorithms, with a legacy fallback",
      },
      {
        text: "Already compressed content is skipped",
        detail:
          "Images and video are compressed already, so trying again only costs CPU",
      },
    ],
    notes:
      "Compression is one of the few wins that makes the page smaller rather than the code smaller.",
  },
  {
    kind: "compare",
    eyebrow: PART_4,
    title: "How the body is framed",
    left: {
      heading: "HTTP/1.1",
      bullets: [
        "A content length says exactly how long the body is",
        "Chunked transfer says the length is not known yet",
        "The framing is expressed in headers",
      ],
    },
    right: {
      heading: "HTTP/2 and HTTP/3",
      bullets: [
        "The framing is part of the protocol",
        "There is no header for it at all",
        "A stream ends when the sender says so",
      ],
    },
  },
  {
    kind: "bullets",
    eyebrow: PART_4,
    title: "The content delivery network",
    bullets: [
      {
        text: "A network of caches placed close to the users",
        detail:
          "A request from another continent is answered from the next city instead",
      },
      {
        text: "The cache key is usually the URL",
        detail: "With the method, the host, and the path as the identity",
      },
      {
        text: "It changes the shape of your latency",
        detail:
          "The distance to the origin stops mattering for repeat visitors",
      },
    ],
    notes: "A CDN turns a global service into a local one for most requests.",
  },
  {
    kind: "bullets",
    eyebrow: PART_4,
    title: "The edge",
    bullets: [
      {
        text: "Code that runs close to the user",
        detail:
          "It can rewrite a request, serve a response, or redirect entirely",
      },
      {
        text: "It is where caching and computation meet",
        detail:
          "A cache miss can be answered by running a function instead of a server",
      },
      {
        text: "It is also a security boundary",
        detail: "Rules applied before a request ever reaches the origin",
      },
    ],
    notes:
      "The edge is the most interesting place in the stack, and the least standardised.",
  },
  {
    kind: "steps",
    eyebrow: PART_4,
    title: "Revalidating a cached copy",
    steps: [
      {
        title: "The client states what it has",
        body: "An entity tag, or a last modified timestamp, sent with the request.",
      },
      {
        title: "The server compares",
        body: "It checks the validator against the current version of the resource.",
      },
      {
        title: "The server answers with a small reply",
        body: "If nothing changed, it returns not modified, with no body at all.",
      },
      {
        title: "The client keeps the copy it has",
        body: "A few hundred bytes of headers instead of a full transfer.",
      },
    ],
  },
  {
    kind: "code",
    eyebrow: PART_4,
    title: "Headers that control caching",
    language: "HTTP/1.1",
    code: `HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Encoding: br
Cache-Control: public, max-age=31536000, immutable
ETag: "8f3c1a2"
Vary: Accept-Encoding

<html>...`,
    notes:
      "Immutable means do not even ask again until the URL changes, which is how fingerprinted assets are served.",
  },
  {
    kind: "bullets",
    eyebrow: PART_4,
    title: "Partial responses",
    bullets: [
      {
        text: "A range header asks for part of a resource",
        detail:
          "A byte range, and the server answers with a partial content status",
      },
      {
        text: "It is how video and large downloads resume",
        detail: "An interrupted transfer continues instead of starting again",
      },
      {
        text: "It also keeps caches useful",
        detail:
          "A cache can hold parts of a large object and serve them together",
      },
    ],
    notes:
      "Range requests are an old feature that became essential once video streams moved to the web.",
  },

  // ------------------------------------------------------------- rendering
  {
    kind: "section",
    number: "05",
    title: PART_5,
    summary: "Turning a stream of bytes into a picture, one frame at a time.",
    notes: "Part five is the browser doing the work you never see.",
  },
  {
    kind: "flow",
    eyebrow: PART_5,
    title: "From bytes to pixels",
    steps: ["Parse", "Style", "Layout", "Paint", "Composite"],
    note: "The same pipeline runs again for every change the page makes after the first load.",
    notes:
      "Every performance problem in the browser is one of these five taking too long.",
  },
  {
    kind: "takeaway",
    eyebrow: PART_5,
    title: "The critical path",
    body: "Not everything on a page matters equally. The critical path is the longest chain of dependent work, and the first screenful is the only part the user is actually waiting for.",
    points: [
      "A request waits for a response",
      "A response waits for a script",
      "A script waits for a style",
    ],
  },
  {
    kind: "steps",
    eyebrow: PART_5,
    title: "Parsing HTML",
    steps: [
      {
        title: "Read bytes into characters",
        body: "The stream is decoded according to the declared charset.",
      },
      {
        title: "Group characters into tokens",
        body: "The parser recognises tags, attributes, comments, and text.",
      },
      {
        title: "Build the tree",
        body: "Tokens become nodes, and the tree is available to scripts as the document object model.",
      },
    ],
    notes:
      "The parser does not wait for the whole document. It works through the stream as it arrives.",
  },
  {
    kind: "bullets",
    eyebrow: PART_5,
    title: "The document object model",
    bullets: [
      {
        text: "A tree of objects mirroring the document",
        detail:
          "Every element becomes an object with properties, methods and children",
      },
      {
        text: "It is a live representation",
        detail: "Change it and the page changes, with no reload",
      },
      {
        text: "It is also the slowest way to build a page",
        detail: "A large tree costs time and memory before anything is painted",
      },
    ],
    notes:
      "The document object model is convenient, and it is the reason a big page is slow to appear.",
  },
  {
    kind: "bullets",
    eyebrow: PART_5,
    title: "The style sheet object model",
    bullets: [
      {
        text: "Stylesheets are parsed into a second tree",
        detail:
          "Rules, selectors and declarations, ready to be matched against elements",
      },
      {
        text: "The two trees are then matched",
        detail:
          "Every selector is tested against every element, and the winners are kept",
      },
      {
        text: "Matching is the expensive part",
        detail:
          "Selectors that are hard to match are slow to match, every single time",
      },
    ],
    notes:
      "A class selector is cheap. A descendant selector over a deep tree is not.",
  },
  {
    kind: "steps",
    eyebrow: PART_5,
    title: "The render tree",
    steps: [
      {
        title: "Combine the trees",
        body: "The document tree and the style rules are merged into one structure.",
      },
      {
        title: "Keep only what is visible",
        body: "Anything with no box takes no part in the rest of the pipeline.",
      },
      {
        title: "Resolve the cascade",
        body: "Every node now knows its final computed style.",
      },
      {
        title: "Geometry is still missing",
        body: "The browser knows how each box should look, but not where it goes.",
      },
    ],
  },
  {
    kind: "bullets",
    eyebrow: PART_5,
    title: "Layout",
    bullets: [
      {
        text: "Every visible box gets a position and a size",
        detail: "Width, height, and the position of the top left corner",
      },
      {
        text: "It runs top down and left to right",
        detail:
          "The position of a parent constrains the position of its children",
      },
      {
        text: "Changing one thing can move a lot",
        detail: "A single width change can reflow the entire page below it",
      },
    ],
    notes:
      "Layout is also called reflow, and it is the most expensive of the five phases.",
  },
  {
    kind: "bullets",
    eyebrow: PART_5,
    title: "Paint",
    bullets: [
      {
        text: "The visible boxes are turned into drawing instructions",
        detail: "Borders, backgrounds, text runs, images, shadows",
      },
      {
        text: "The order matters",
        detail: "Backgrounds first, then borders, then the content on top",
      },
      {
        text: "Instructions are recorded, not drawn",
        detail: "Nothing reaches the screen until the compositor runs",
      },
    ],
    notes:
      "Paint produces a list of commands. The compositor is what turns them into pixels.",
  },
  {
    kind: "bullets",
    eyebrow: PART_5,
    title: "Compositing",
    bullets: [
      {
        text: "The layers are combined into the final frame",
        detail: "Each layer is rasterised, then put together in order",
      },
      {
        text: "Layers can be reused between frames",
        detail: "If only one layer changed, the rest are simply kept",
      },
      {
        text: "This is what makes animation smooth",
        detail:
          "A moving element does not force the whole page to be painted again",
      },
    ],
    notes: "Layer promotion is a common cause of memory problems on mobile.",
  },
  {
    kind: "bullets",
    eyebrow: PART_5,
    title: "Layers, and why they matter",
    bullets: [
      {
        text: "A layer is a separate surface the compositor can move on its own",
        detail: "Transform and opacity are the properties that promote one",
      },
      {
        text: "Promoting too much is expensive",
        detail: "Every layer costs memory, and a large one costs a lot",
      },
      {
        text: "Animating the wrong property is worse",
        detail:
          "Animating a layout property forces layout and paint on every frame",
      },
    ],
    notes:
      "The rule of thumb: animate transform and opacity, and nothing else.",
  },
  {
    kind: "bullets",
    eyebrow: PART_5,
    title: "Style, layout and paint again",
    bullets: [
      {
        text: "A change to the document restarts the pipeline",
        detail: "Not from the beginning, but from the phase that was affected",
      },
      {
        text: "Changing a class may change style only",
        detail: "If the geometry does not move, layout and paint are skipped",
      },
      {
        text: "Changing a width usually changes everything",
        detail: "Layout, then paint, then composite",
      },
    ],
    notes:
      "This is the basis of most performance advice about avoiding layout thrashing.",
  },

  // --------------------------------------------------------------- runtime
  {
    kind: "section",
    number: "06",
    title: PART_6,
    summary:
      "The loop that runs your code, and decides when the screen updates.",
    notes: "Part six is the event loop, which explains why pages feel stuck.",
  },
  {
    kind: "bullets",
    eyebrow: PART_6,
    title: "The event loop",
    bullets: [
      {
        text: "One task at a time",
        detail:
          "JavaScript on a page runs to completion before anything else starts",
      },
      {
        text: "A long task blocks everything",
        detail:
          "The page cannot paint, cannot respond, and cannot run another callback",
      },
      {
        text: "The browser yields between tasks",
        detail: "That is when rendering gets a chance to happen",
      },
    ],
    notes:
      "A single synchronous loop over a large array is enough to drop a frame on a good machine.",
  },
  {
    kind: "flow",
    eyebrow: PART_6,
    title: "One turn of the loop",
    steps: ["Take a task", "Run it", "Drain microtasks", "Render", "Repeat"],
    note: "The rendering step is optional. The browser takes it only when the frame is due.",
    notes:
      "Microtasks are drained completely before the next task runs. That matters for ordering.",
  },
  {
    kind: "columns",
    eyebrow: PART_6,
    title: "Tasks and microtasks",
    columns: [
      {
        heading: "A task",
        bullets: [
          "A full piece of work",
          "A timer, or an event handler",
          "The loop takes one at a time",
        ],
      },
      {
        heading: "A microtask",
        bullets: [
          "Runs before the next task",
          "Promise continuations, and queued calls",
          "A chain of them starves rendering",
        ],
      },
    ],
  },
  {
    kind: "code",
    eyebrow: PART_6,
    title: "Ordering you can rely on",
    language: "JavaScript",
    code: `console.log("one");

setTimeout(() => console.log("two"), 0);

Promise.resolve().then(() => console.log("three"));

console.log("four");

// one, four, three, two`,
    notes:
      "The timeout is a task, the promise continuation is a microtask, and microtasks always win.",
  },
  {
    kind: "bullets",
    eyebrow: PART_6,
    title: "Rendering opportunities",
    bullets: [
      {
        text: "The browser renders when it needs to, not when you ask",
        detail:
          "It waits for a frame to be due, and for the main thread to be free",
      },
      {
        text: "A frame is due roughly every sixteen milliseconds",
        detail: "At sixty frames per second",
      },
      {
        text: "You can ask for the next frame explicitly",
        detail:
          "A request for an animation frame callback, which runs before the next paint",
      },
    ],
    notes: "Sixty frames per second is the target, not the guarantee.",
  },
  {
    kind: "stats",
    eyebrow: PART_6,
    title: "The frame budget",
    stats: [
      { value: "16ms", label: "one frame at sixty per second" },
      { value: "8ms", label: "a comfortable target for your own work" },
      { value: "50ms", label: "the threshold for a long task" },
    ],
    note: "Leaving the rest of the budget alone is what keeps the page responsive.",
    notes:
      "The long task threshold is what the browser tooling reports as a warning.",
  },
  {
    kind: "takeaway",
    eyebrow: PART_6,
    title: "Long tasks",
    body: "A task that runs for more than fifty milliseconds is a long task, and every long task is a dropped frame. The user sees a stutter, and every input waits for it to finish.",
    points: [
      "A large loop over a big array",
      "A big parse on the main thread",
      "A layout read inside a loop",
    ],
  },
  {
    kind: "bullets",
    eyebrow: PART_6,
    title: "Workers",
    bullets: [
      {
        text: "A separate thread with its own event loop",
        detail:
          "It shares no memory with the page, and communicates by message",
      },
      {
        text: "Good for work that is heavy but not urgent",
        detail: "Parsing, image processing, and large calculations",
      },
      {
        text: "Not a free lunch",
        detail:
          "The data has to be copied in and out, and a worker cannot touch the page",
      },
    ],
    notes:
      "Moving the wrong work off the main thread makes the page feel worse, not better.",
  },
  {
    kind: "bullets",
    eyebrow: PART_6,
    title: "Hydration",
    bullets: [
      {
        text: "The server sends markup that already looks right",
        detail: "The page is visible before any script has run",
      },
      {
        text: "Then the client rebuilds the same tree",
        detail: "Attaching listeners and bringing the page to life",
      },
      {
        text: "The cost is a second construction of the same page",
        detail:
          "And a period where the page is visible but not yet interactive",
      },
    ],
    notes:
      "This is the central trade of server rendering, and the reason partial hydration exists.",
  },

  // ------------------------------------------------------------- measuring
  {
    kind: "section",
    number: "07",
    title: PART_7,
    summary:
      "Measuring what the user actually feels, rather than what the server does.",
    notes:
      "Part seven is about measurement, and about picking the right number to improve.",
  },
  {
    kind: "cards",
    eyebrow: PART_7,
    title: "The metrics that matter",
    cards: [
      {
        title: "Time to first byte",
        body: "The server and the network, with nothing else mixed in. The part you cannot fix in the browser.",
      },
      {
        title: "Largest contentful paint",
        body: "When the main content appears. The moment the page stops feeling empty.",
      },
      {
        title: "Interaction to next paint",
        body: "How long the page takes to respond to a tap or a click. The feeling of a slow application.",
      },
    ],
  },
  {
    kind: "table",
    eyebrow: PART_7,
    title: "The core web vitals",
    headers: ["Vital", "Measures", "Good looks like"],
    rows: [
      ["LCP", "Largest contentful paint", "Under 2.5 seconds"],
      ["INP", "Interaction to next paint", "Under 200 milliseconds"],
      ["CLS", "Cumulative layout shift", "Under 0.1"],
      ["TTFB", "Time to first byte", "Under 800 milliseconds"],
    ],
    notes:
      "Thresholds are measured at the 75th percentile of real visits, not on a perfect run.",
  },
  {
    kind: "bullets",
    eyebrow: PART_7,
    title: "Time to first byte",
    bullets: [
      {
        text: "The gap between sending the request and the first byte of the response",
        detail: "It includes the network, the server, and anything in between",
      },
      {
        text: "It is the part you cannot optimise in the browser",
        detail: "No amount of client code makes the server answer faster",
      },
      {
        text: "It is the first thing to look at when a site feels slow",
        detail: "Everything after it happens on a machine you do not control",
      },
    ],
    notes:
      "A good server response time is under 200 milliseconds. Over 800 is a problem.",
  },
  {
    kind: "bullets",
    eyebrow: PART_7,
    title: "Largest contentful paint",
    bullets: [
      {
        text: "The render time of the largest element on the screen",
        detail: "Usually an image, a heading, or a large block of text",
      },
      {
        text: "It is the moment the page stops feeling empty",
        detail: "The user sees the thing they came for",
      },
      {
        text: "It is a function of everything",
        detail:
          "Server speed, resource priority, and the order things arrive in",
      },
    ],
    notes:
      "Improving it usually means making the most important resource arrive first, not making it smaller.",
  },
  {
    kind: "bullets",
    eyebrow: PART_7,
    title: "Interaction to next paint",
    bullets: [
      {
        text: "The delay between an input and the next painted frame",
        detail:
          "It replaces the older input latency metric, which was easy to game",
      },
      {
        text: "It is the responsiveness of the whole page",
        detail: "Not one interaction, but all of them together",
      },
      {
        text: "Long tasks are the usual cause",
        detail: "The browser can only respond when the main thread is free",
      },
    ],
    notes:
      "It is the metric that most closely matches the feeling of a page being slow to use.",
  },
  {
    kind: "bullets",
    eyebrow: PART_7,
    title: "Cumulative layout shift",
    bullets: [
      {
        text: "How much visible content moved while the page loaded",
        detail: "Measured as a score, summed over the whole visit",
      },
      {
        text: "It happens when something arrives late",
        detail: "An image with no dimensions, a banner, a web font",
      },
      {
        text: "Reserve the space and it never happens",
        detail:
          "Width and height attributes on images, and space for late content",
      },
    ],
    notes:
      "A layout shift is felt more strongly than a slow load, because the user is already reading.",
  },
  {
    kind: "bullets",
    eyebrow: PART_7,
    title: "Reading a waterfall",
    bullets: [
      {
        text: "Each bar is a request, from start to end",
        detail:
          "The gap before the first bar is the browser deciding what to ask for",
      },
      {
        text: "Look for the long empty gaps",
        detail: "Time spent waiting is time nobody was working",
      },
      {
        text: "Look for the wide bars",
        detail: "A large transfer that could have been cached or compressed",
      },
    ],
    notes:
      "A waterfall is a story about waiting, and most of the waiting is avoidable.",
  },
  {
    kind: "cards",
    eyebrow: PART_7,
    title: "Profiling in the browser",
    cards: [
      {
        title: "The performance panel",
        body: "Records a screenshot of every painted frame, next to everything the main thread was doing.",
      },
      {
        title: "The flame chart",
        body: "Shows where the time went. Long tasks appear as wide bars, and the call tree expands them.",
      },
      {
        title: "The coverage panel",
        body: "Shows the script and the styles that were never used, which is often a large share of the download.",
      },
    ],
  },
  {
    kind: "compare",
    eyebrow: PART_7,
    title: "What to fix first",
    left: {
      heading: "Usually the biggest win",
      bullets: [
        "A slow server response time",
        "A large unoptimised image",
        "Render blocking resources",
        "Work on the main thread that could be moved",
      ],
    },
    right: {
      heading: "Usually not worth it",
      bullets: [
        "Shaving a few kilobytes off a bundle",
        "Adding a preload for a resource that was already fast",
        "Micro optimisations in code that runs once",
        "Chasing a perfect score on a synthetic run",
      ],
    },
    notes:
      "The right list depends on the page, but the shape of the list is usually this.",
  },

  // ----------------------------------------------------------- modern web
  {
    kind: "section",
    number: "08",
    title: PART_8,
    summary: "What the platform is becoming, and where it is going next.",
    notes: "The last part looks forward, briefly.",
  },
  {
    kind: "bullets",
    eyebrow: PART_8,
    title: "Service workers",
    bullets: [
      {
        text: "A script the browser runs on your behalf",
        detail: "It can intercept requests and decide what to answer",
      },
      {
        text: "It sits between the page and the network",
        detail:
          "So it can serve from a cache, or go to the network, or do both",
      },
      {
        text: "It is programmable and powerful",
        detail:
          "And it has to be updated carefully, because a broken worker can break the site",
      },
    ],
    notes:
      "A service worker is a permanent change to how a site behaves, so versioning it is a real chore.",
  },
  {
    kind: "steps",
    eyebrow: PART_8,
    title: "Working offline",
    steps: [
      {
        title: "Cache the shell",
        body: "The files needed to start the page at all, stored ahead of time.",
      },
      {
        title: "Pick a strategy per request",
        body: "Cache first for assets, network first for data, and a fallback for the rest.",
      },
      {
        title: "Serve something useful offline",
        body: "An offline page that the user can still act on, not an error page.",
      },
    ],
  },
  {
    kind: "bullets",
    eyebrow: PART_8,
    title: "Web components",
    bullets: [
      {
        text: "A standard way to build reusable elements",
        detail: "A custom element with its own markup, style and behaviour",
      },
      {
        text: "They work with any framework, or none",
        detail: "The encapsulation is handled by the browser, not by a library",
      },
      {
        text: "The shadow boundary is the interesting part",
        detail:
          "Styles inside do not leak out, and outside styles do not leak in",
      },
    ],
    notes:
      "The interesting question is always about styling and how it crosses the boundary.",
  },
  {
    kind: "bullets",
    eyebrow: PART_8,
    title: "WebAssembly",
    bullets: [
      {
        text: "A portable compilation target for the browser",
        detail: "Code written in C, C++, Rust or Go can run on the web",
      },
      {
        text: "It runs at close to native speed",
        detail: "And it sandboxes exactly like JavaScript does",
      },
      {
        text: "It usually works together with JavaScript",
        detail: "One for the hot inner loop, the other for the interface",
      },
    ],
    notes:
      "The interesting applications are the ones that were previously impossible in a browser.",
  },
  {
    kind: "bullets",
    eyebrow: PART_8,
    title: "Computing at the edge",
    bullets: [
      {
        text: "The server moves closer to the user",
        detail: "A function running in a data centre near the request",
      },
      {
        text: "It shortens the round trip",
        detail: "And it can answer without talking to the origin at all",
      },
      {
        text: "It changes where state lives",
        detail:
          "A request can now touch a database on the other side of the planet",
      },
    ],
    notes: "The edge is a redistribution of work, not a removal of it.",
  },
  {
    kind: "bullets",
    eyebrow: PART_8,
    title: "HTTP/3 in practice",
    bullets: [
      {
        text: "It runs over QUIC, on top of UDP",
        detail:
          "So it does not have to wait for a middlebox to learn the connection",
      },
      {
        text: "Loss is per stream, not per connection",
        detail: "A lost packet no longer stalls the other requests",
      },
      {
        text: "It can move a connection when the network changes",
        detail: "Which is exactly what happens on a phone",
      },
    ],
    notes:
      "Most of the benefit shows up on mobile networks, where the path really does change.",
  },
  {
    kind: "bullets",
    eyebrow: PART_8,
    title: "Where it is heading",
    bullets: [
      {
        text: "Less network, more compute nearby",
        detail: "The edge is becoming a normal part of the architecture",
      },
      {
        text: "More capability in the browser",
        detail:
          "Graphics, storage and compute that used to need an application",
      },
      {
        text: "The same primitives, applied better",
        detail:
          "Caching, compression and streaming have not changed, they are just used well",
      },
    ],
    notes: "End on the note that most of the wins are still the fundamentals.",
  },

  // --------------------------------------------------------------- closing
  {
    kind: "takeaway",
    eyebrow: "The whole journey",
    title: "One request, end to end",
    body: "A name becomes an address, an address becomes a secure channel, a request becomes a response, a response becomes a page, and the page becomes an application that keeps running while you use it.",
    points: [
      "Each step has a cache in front of it",
      "Each step can fail in its own way",
      "Each step is measured by something different",
    ],
  },
  {
    kind: "bullets",
    eyebrow: "In practice",
    title: "The levers that matter most",
    bullets: [
      {
        text: "Cache what does not change",
        detail:
          "Fingerprinted assets with a long lifetime, and revalidation for everything else",
      },
      {
        text: "Send less",
        detail: "Compression, smaller images, and less JavaScript",
      },
      {
        text: "Get the important thing first",
        detail:
          "One server response, one critical path, one first meaningful paint",
      },
      {
        text: "Keep the main thread free",
        detail: "Short tasks, and work moved off it when it is genuinely heavy",
      },
    ],
    reveal: true,
    notes: "This is the checklist to take away. It is short on purpose.",
  },
  {
    kind: "table",
    eyebrow: "A checklist",
    title: "Before you call a page fast",
    headers: ["Check", "Target", "Why"],
    rows: [
      ["Server response", "Under 200 ms", "Everything else waits for it"],
      [
        "Cache headers",
        "Set on every response",
        "Without them nothing is cached",
      ],
      [
        "Image sizes",
        "Match the display size",
        "The most common waste on a page",
      ],
      [
        "Blocking resources",
        "As few as possible",
        "They delay the first paint",
      ],
      ["Long tasks", "None over 50 ms", "They block every interaction"],
      [
        "Layout shift",
        "Reserve space",
        "It is the most irritating kind of slow",
      ],
    ],
    notes:
      "Work down the list. The first two usually give the biggest improvement.",
  },
  {
    kind: "quote",
    quote:
      "The web is not a place to put things. It is a set of agreements about how to fetch them, cache them, and render them.",
    cite: "A summary of the last hundred slides",
  },
  {
    kind: "end",
    title: "That is the whole web",
    subtitle:
      "A name, a connection, a request, a response, a page, and a loop that keeps it running.",
    links: [
      { label: "MDN", detail: "The reference for every part of this deck" },
      { label: "The spec", detail: "HTTP, TLS, DNS and HTML, in full" },
      { label: "Your tools", detail: "Devtools, a profiler and a waterfall" },
    ],
    notes:
      "This deck is built into the app. Open the Canvases tab to bring it back at any time.",
  },
];
