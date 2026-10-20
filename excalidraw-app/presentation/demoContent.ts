import type { SlideTransition } from "./slides";

/**
 * The content of the built-in demo deck.
 *
 * The deck argues one thing: a page load is a chain of round trips, and
 * almost every one of them can be shortened. Every slide makes a single
 * point, the title states the conclusion, and every number carries a
 * source line.
 *
 * The rules the deck follows live in `DECK-RULES.md` and are checked by
 * `deckRules.ts`.
 */

type SlideBase = {
  /** the part of the deck this slide belongs to, shown in the footer */
  section?: string;
  transition?: SlideTransition;
  /** speaker notes */
  notes?: string;
  /** reveal the content one bullet at a time */
  reveal?: boolean;
  /** where a number on the slide came from */
  source?: string;
};

export type DemoSlideSpec = SlideBase &
  (
    | {
        kind: "cover";
        title: string;
        subtitle: string;
      }
    | {
        kind: "statement";
        /** the one claim the slide makes */
        text: string;
        /** optional supporting line under the claim */
        detail?: string;
      }
    | {
        kind: "section";
        /** which part of the deck this is */
        marker: string;
        /** the part of the deck, in words */
        title: string;
        /** what this part argues */
        summary: string;
      }
    | {
        kind: "bullets";
        title: string;
        bullets: string[];
      }
    | {
        kind: "steps";
        title: string;
        steps: { label: string; body: string }[];
      }
    | {
        kind: "quote";
        quote: string;
        cite: string;
      }
    | {
        kind: "table";
        title: string;
        headers: string[];
        rows: string[][];
      }
    | {
        kind: "code";
        title: string;
        language: string;
        code: string;
      }
    | {
        kind: "chart";
        title: string;
        /** what the axis measures */
        axis: string;
        /** the bars, smallest first */
        bars: { label: string; value: number; note?: string }[];
      }
    | {
        kind: "diagram";
        title: string;
        /** the stages in the chain, in order */
        nodes: { label: string; body: string }[];
      }
    | {
        kind: "number";
        title: string;
        /** the figure */
        value: string;
        /** what the figure means */
        caption: string;
      }
    | {
        kind: "compare";
        title: string;
        left: { heading: string; lines: string[] };
        right: { heading: string; lines: string[] };
      }
    | {
        kind: "takeaway";
        title: string;
        body: string;
        points: string[];
      }
    | {
        kind: "end";
        title: string;
        body: string;
        links: { label: string; detail: string }[];
      }
  );

export const DEMO_TITLE = "A page load, end to end";

const PART_RESOLVE = "Resolving the name";
const PART_CONNECT = "Opening the connection";
const PART_REQUEST = "Asking for the page";
const PART_MEASURE = "Measuring the result";

export const DEMO_SLIDES: DemoSlideSpec[] = [
  // ------------------------------------------------------------------ open
  {
    kind: "cover",
    title: "A page load, end to end",
    subtitle:
      "Every request is a chain of round trips, and almost every link in the chain can be shortened",
    notes:
      "This deck follows one page load from the moment you press enter to the moment the page is on screen. The argument is simple: each stage of the chain has a cache, and the stages people forget about are the slow ones. Ask the room which stage they think takes the longest. The answer is usually the name, not the server.",
  },
  {
    kind: "statement",
    text: "A page load is a chain of requests, and the chain is only as slow as its slowest link.",
    detail:
      "The stages run in a fixed order, so every millisecond spent in one of them is a millisecond the user is waiting.",
    notes:
      "This is the claim the rest of the deck defends. The useful part is the consequence: because the stages are sequential, you cannot parallelise your way out of a slow one. You can only shorten it or cache it. If the team takes one thing away, it should be that the fix for a slow page is usually not in the application code.",
  },
  {
    kind: "diagram",
    title: "The chain runs in this order, and every stage of it has a cache",
    nodes: [
      { label: "Name", body: "resolve the domain" },
      { label: "Connection", body: "TCP, then TLS" },
      { label: "Request", body: "one HTTP message" },
      { label: "Response", body: "headers, then body" },
      { label: "Render", body: "parse, lay out, paint" },
    ],
    notes:
      "Walk the chain left to right. The order matters, because the browser cannot start the second stage until the first one finishes. Point out that every stage on this line has a cache attached to it, which is the theme of the next few slides. If the audience only remembers the shape of the chain, the rest of the deck is detail.",
  },

  // -------------------------------------------------------------- the name
  {
    kind: "section",
    marker: "Part one of four",
    title: PART_RESOLVE,
    summary: "Turning a name into an address, and why it is often already done",
    notes:
      "Short section. The point of it is that the name lookup is a separate round trip that happens before anything else, and that it is cached in a way most people do not think about.",
  },
  {
    kind: "bullets",
    title:
      "The resolver walks down a tree, and every answer it gets is cached with a lifetime",
    bullets: [
      "The domain name space is a tree, and a name is the list of labels from the node up to the root",
      "A resolver starts at the root, is pointed down a level at a time, and asks the server that holds the answer",
      "The answer carries a time to live, a 32-bit signed count of seconds, and the resolver caches it for that long",
      "A time to live of zero means the record is good only for the transaction in progress, and must not be cached",
    ],
    source: "RFC 1034 section 3.1, RFC 1035 sections 2.3.4 and 3.2.1",
    notes:
      "The tree is the mental model most people miss: the root knows nothing about your site, it knows who does. Ask whether anyone has watched a dig trace go root, com, then the domain itself. The surprising part for most teams is the time to live, because it means the answer can be stale for the whole of that window and nobody notices.",
  },
  {
    kind: "chart",
    title: "A DNS answer has to fit inside one packet to arrive over UDP",
    axis: "octets",
    bars: [
      { label: "One label", value: 63, note: "in a name" },
      { label: "A whole name", value: 255, note: "in a name" },
      { label: "A DNS message", value: 512, note: "the UDP limit" },
    ],
    source: "RFC 1035 section 2.3.4",
    notes:
      "These are the size limits from the specification, and they are small enough to be surprising. The 512-octet UDP limit is why larger answers fall back to TCP, which is a real source of latency on some networks. The 63-octet label limit is why a single hostname cannot be long. Nobody designs around these numbers, but they shape the protocol.",
  },
  {
    kind: "table",
    title: "The record types you will actually meet, and what each one answers",
    headers: ["Type", "Answers", "Holds"],
    rows: [
      ["A", "Which IPv4 address", "A 32-bit address"],
      ["AAAA", "Which IPv6 address", "A 128-bit address"],
      ["CNAME", "The real name", "Another domain name"],
      ["MX", "Where to send mail", "Mail exchanger names"],
      ["NS", "Who is authoritative", "Name server names"],
    ],
    source: "RFC 1035 section 3.3, RFC 3596 section 2.1",
    notes:
      "Two of these are worth a sentence each. AAAA is a separate record rather than a flag on A, which is why a host with both families has to publish both, and why a broken AAAA record takes the site down for IPv6 users. CNAME is an alias, and because it points at a name rather than an address, the resolver has to look that name up too, which is one more round trip.",
  },
  {
    kind: "steps",
    title: "A cold lookup costs three round trips before the answer arrives",
    steps: [
      {
        label: "Root",
        body: "the resolver is told which server holds the top level domain",
      },
      {
        label: "Top level",
        body: "it is told which server holds the domain itself",
      },
      {
        label: "Authoritative",
        body: "it is told the address",
      },
      {
        label: "Answer",
        body: "the resolver caches it until the time to live expires",
      },
    ],
    source: "RFC 1034 section 4.3.2, RFC 1035 section 7.2",
    notes:
      "This is the sequence to show someone who thinks a DNS lookup is one request. Each step is a round trip to a different server, and the four of them happen in series. The practical consequence is that the first visit to a site is slow in a way the second visit is not, and the difference is entirely the cache.",
  },
  {
    kind: "takeaway",
    title:
      "The name is resolved once and reused until its time to live runs out",
    body: "Nothing in the rest of the chain can start until this does, so it is the first place to look when a page is slow on a cold cache.",
    points: [
      "A warm resolver answers without touching the network",
      "The time to live decides how long that answer is trusted",
      "That lifetime is chosen by whoever owns the domain, not by your code",
    ],
    notes:
      "This closes the first part. The third point is the one to linger on: the cache lifetime is a decision made somewhere else entirely, usually years ago, by whoever set up the domain. If a site has a one-minute TTL, a resolver re-walks the tree every minute for every user, and no amount of frontend work will change that.",
  },

  // --------------------------------------------------------- the connection
  {
    kind: "section",
    marker: "Part two of four",
    title: PART_CONNECT,
    summary: "Two round trips before any application data moves",
    notes:
      "The connection is where people expect the time to go, and they are right, but the reason is not the server. It is the handshake.",
  },
  {
    kind: "bullets",
    title:
      "The connection costs a handshake, and the handshake is the slowest part of the load",
    bullets: [
      "TCP opens with a three-way handshake of SYN, SYN-ACK and ACK, which is a full round trip before any data moves",
      "TLS then negotiates keys on top of that, and TLS 1.3 gets it down to a single round trip where TLS 1.2 needed two",
    ],
    source: "RFC 9293 section 3.4, RFC 8446 section 1.2",
    notes:
      "The three-way handshake is the reason the connection cannot be faster than a round trip, no matter how fast the machines are. TLS 1.3 then made the encryption handshake one round trip instead of two, which is a real saving on a bad mobile connection. If you want the audience to remember one number, it is that TLS 1.3 halved the handshake cost.",
  },
  {
    kind: "compare",
    title:
      "TLS 1.2 and TLS 1.3 are not the same handshake with different ciphers",
    left: {
      heading: "TLS 1.2",
      lines: [
        "Two round trips to complete",
        "Static RSA and static Diffie-Hellman still allowed",
        "Cipher list includes legacy algorithms",
        "The certificate travels in the clear",
      ],
    },
    right: {
      heading: "TLS 1.3",
      lines: [
        "One round trip to complete",
        "Static RSA and static Diffie-Hellman removed",
        "Only authenticated encryption remains",
        "Everything after the ServerHello is encrypted",
      ],
    },
    source: "RFC 8446 section 1.2",
    notes:
      "The security change is the more interesting half. TLS 1.3 removed the key exchange modes that did not give forward secrecy, so a connection recorded today cannot be opened later with the server's long-term key. For performance, the point is the round trip count in the left column. That is what you are paying for if you have not upgraded.",
  },
  {
    kind: "number",
    title:
      "A resumed connection can send data before the handshake has finished",
    value: "0",
    caption:
      "round trips of delay. TLS 1.3 added a zero round trip time mode, but that data can be replayed by an attacker, so it does not suit anything that changes state.",
    source: "RFC 8446 section 1.2, RFC 9001 section 4.1",
    notes:
      "This is the resumption path, and it is where a lot of the remaining time went after TLS 1.3. The caveat is the whole point: early data can be replayed, so a payment or a database write must not travel in it. The rule of thumb is that zero round trip time is fine for a GET and wrong for anything else.",
  },
  {
    kind: "takeaway",
    title:
      "One connection carries many requests, so the handshake is paid once",
    body: "HTTP over TCP keeps the connection open by default, and a browser will reuse it for every asset on the page.",
    points: [
      "Pipelining is allowed but rare in practice, because a slow response holds up the ones behind it",
      "HTTP/2 replaces that queue with multiplexed streams over the one connection",
    ],
    source: "RFC 9112 section 9.3, RFC 9113 section 5.1",
    notes:
      "The reason a page with forty assets is not forty handshakes is this slide. One connection, many requests. HTTP/2 improved on it by giving each exchange its own stream so that a slow one no longer blocks the queue, and HTTP/3 went further by moving the whole thing onto QUIC. If someone asks which to use, the answer is that HTTP/2 and HTTP/3 are already the default everywhere.",
  },

  // ---------------------------------------------------------- the request
  {
    kind: "section",
    marker: "Part three of four",
    title: PART_REQUEST,
    summary: "One message, and the rules that decide how much of it travels",
    notes:
      "Now the part people think they know. The message is simple, which is exactly why the rules around it matter.",
  },
  {
    kind: "code",
    title: "The whole request is this, and it is the same every time",
    language: "http",
    code: `GET /hello.txt HTTP/1.1
Host: www.example.com
User-Agent: curl/7.64.1
Accept-Language: en, mi`,
    source: "RFC 9110 section 3.9",
    notes:
      "The method, the path, the version, and a handful of headers. There is no session, no cookie by default and no body on a GET. Worth pointing out that the Host header is required in HTTP/1.1 and is what lets one server serve many names. The whole request is about 120 bytes, which is worth remembering when the response is two megabytes.",
  },
  {
    kind: "bullets",
    title:
      "HTTP/2 gives every request its own stream, so one stall does not stop the rest",
    bullets: [
      "Each request and response exchange is associated with its own stream on a single connection",
      "A blocked or stalled exchange does not prevent progress on the other streams",
      "Streams are numbered with a 31-bit identifier, and the client uses the odd ones",
      "Headers are compressed with HPACK, which keeps a table of 4,096 bytes of the values it has already sent",
    ],
    source: "RFC 9113 sections 4.3.1, 5.1 and 5.1.1",
    notes:
      "This is the change that made a page with forty assets feel different from a page with one. Before HTTP/2, requests on a connection were answered in order, so one slow response held up everything behind it. Ask the room how many assets their own site loads, because the number is usually higher than anyone expects, and each one used to be able to hold up the rest.",
  },
  {
    kind: "quote",
    quote:
      "Streams are largely independent of each other, so a blocked or stalled request or response does not prevent progress on other streams.",
    cite: "RFC 9113, section 5.1",
    notes:
      "One sentence from the specification, and it is the whole idea. Read it out rather than paraphrasing it, because the precise wording matters: the guarantee is about progress, not about speed. A stream can still be slow. What the specification rules out is one slow stream holding up every other request on the same connection.",
  },
  {
    kind: "bullets",
    title:
      "The server decides what travels by setting freshness and validators on the response",
    bullets: [
      "Cache-Control states the policy directly, with max-age giving a lifetime in seconds and no-store refusing storage entirely",
      "An ETag is an opaque validator for one version of the resource, and a client sends it back as If-None-Match",
      "If the validator still matches, the server answers 304 Not Modified and sends no body at all",
      "A 304 still carries the headers, including the ETag and the cache policy, so the cache can be refreshed",
    ],
    source: "RFC 9111 section 5.2, RFC 9110 sections 13.1.2 and 15.4.5",
    notes:
      "This is the highest-value slide in the deck for an application team, because these two headers are usually set by a framework rather than deliberately. A 304 costs a few hundred bytes and saves the whole body. A likely question is what happens when the client has no validator, and the answer is that it gets the full body, which is why the ETag matters.",
  },
  {
    kind: "steps",
    title: "A second visit can be answered without sending the body at all",
    steps: [
      {
        label: "Fresh",
        body: "the cached copy is still within its lifetime, so the browser asks nobody",
      },
      {
        label: "Stale",
        body: "the browser revalidates with If-None-Match, and the server answers 304 Not Modified",
      },
      {
        label: "Missing",
        body: "the cache has nothing, so the request goes out and the body comes back whole",
      },
    ],
    source: "RFC 9111 sections 4.2 and 4.3, RFC 9110 section 15.4.5",
    notes:
      "These three paths cover every repeat visit, and the middle one is the interesting one. A 304 carries the headers and no body, so the saving scales with the size of the resource. On a large asset that is the difference between a few hundred bytes and a couple of hundred kilobytes, which is why a cache header is often the cheapest performance work available.",
  },
  {
    kind: "takeaway",
    title: "A second visit can be almost free, if the server says how",
    body: "The browser will not cache a response unless the response allows it, so this is a decision the server makes on every route.",
    points: [
      "No cache headers means the browser revalidates, which still saves the body",
      "A wrong cache header is worse than a missing one, because it is hard to notice",
    ],
    notes:
      "The second point is worth a moment. A cache header that is too generous serves a stale page to users and is invisible in development, because a developer almost always has the cache disabled. A cache header that is missing just costs a revalidation, which is cheap. If there is one thing to take away here, it is to set the header deliberately rather than by accident.",
  },

  // ------------------------------------------------------------ measuring
  {
    kind: "section",
    marker: "Part four of four",
    title: PART_MEASURE,
    summary:
      "What the browser measures, and the numbers that are worth watching",
    notes:
      "The last part is about measurement, because a page load is only as good as the number you hold it to.",
  },
  {
    kind: "table",
    title: "Three numbers stand in for whether a page felt fast",
    headers: ["Metric", "Measures", "Good", "Poor"],
    rows: [
      ["LCP", "When the largest element appears", "2.5 s", "4 s"],
      ["INP", "How long a tap takes to be answered", "200 ms", "500 ms"],
      ["CLS", "How much the layout moves while loading", "0.1", "0.25"],
    ],
    source: "web.dev, How the Core Web Vitals metrics thresholds were defined",
    notes:
      "These are the thresholds Google published, and they are assessed at the 75th percentile of page views, which is the number to keep in mind. A site is classified good when at least 75 percent of its page views meet the good threshold. INP replaced First Input Delay in 2024, so older dashboards may still show the old metric.",
  },
  {
    kind: "bullets",
    title:
      "The largest element on the page usually is not the slowest one to arrive",
    bullets: [
      "Largest Contentful Paint is dominated by the server sending the main resource and the browser reaching the first byte",
      "A late third-party script can push Interaction to Next Paint up, because the main thread is busy while it runs",
      "Cumulative Layout Shift is usually caused by an image or a font arriving without reserved space",
    ],
    source: "web.dev, How the Core Web Vitals metrics thresholds were defined",
    notes:
      "The three metrics fail for three different reasons, so they send you to three different parts of the system. A slow LCP is a server or network problem. A slow INP is a main thread problem, usually a long task. A high CLS is a layout problem, usually a missing width and height on an image. Teams that chase all three at once get confused, so pick the one the users are complaining about.",
  },
  {
    kind: "takeaway",
    title:
      "Measure the chain, because a single score only says something is slow",
    body: "A single score tells you that something is slow. The chain tells you which link to fix.",
    points: [
      "Break the load into the five stages and time each one",
      "Compare the stages against the budget you actually have",
    ],
    notes:
      "This is the advice the deck has been building towards. A page load score is a symptom, and the stages are the diagnosis. The habit worth forming is to look at the network waterfall with the stages labelled, because it takes thirty seconds and it points straight at whoever owns the problem.",
  },

  // ------------------------------------------------------------------ close
  {
    kind: "end",
    title: "Open the network panel and count the round trips",
    body: "The next time a page feels slow, look at the request chain in your browser's network panel and count how many round trips happen before the first byte. Then look at which of them you could have skipped.",
    links: [
      { label: "RFC 9110", detail: "HTTP semantics" },
      { label: "RFC 9113", detail: "HTTP/2" },
      { label: "RFC 8446", detail: "TLS 1.3" },
      { label: "RFC 1035", detail: "DNS" },
    ],
    notes:
      "Close on the action rather than a summary. The network panel is in every browser, it needs no setup, and it shows the chain in order, so it is the natural place to start. The four documents are the primary sources for everything in the deck if anyone wants to check a claim. Offer to leave this slide up while people ask questions.",
  },
];
