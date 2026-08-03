// Asserts where the Tree-sitter grammar decides a URL ends.
//
// `text.hyperlink` is only ever injected in real use, but it is a registered
// grammar like any other, so assigning it to a buffer directly exercises the
// parser and `ts/highlights.scm` without dragging in a host language package —
// which matters, because CI checks out this package on its own.
//
// Extent is the whole point here. The parser's own corpus in
// `lumine-code/tree-sitter-hyperlink` asserts tree *shape*, and shape cannot
// tell `https://example.com` from `https://example.com)**` — both are
// `(prose (url))`. Only a scope range can, so these are the tests that would
// have caught the delimiter bug.

const LINK_SCOPE = "markup.underline.link.hyperlink";

describe("Hyperlink Tree-sitter grammar", () => {
  beforeEach(async () => {
    atom.config.set("language.useTreeSitterParsers", true);
    await atom.packages.activatePackage("language-hyperlink");
  });

  // Returns the substring of `text` that carries the link scope, or null when
  // nothing does.
  async function linkIn(text) {
    const editor = await atom.workspace.open();
    editor.setGrammar(atom.grammars.grammarForScopeName("text.hyperlink"));
    editor.setText(text);
    await editor.languageMode.ready;

    let start = null;
    for (let column = 0; column <= text.length; column++) {
      const scopes = editor.scopeDescriptorForBufferPosition([0, column]).scopes;
      // A scope reported at `column` covers the character to its right, so the
      // first column that drops the scope is the exclusive end of the run.
      const linked = column < text.length && scopes.includes(LINK_SCOPE);
      if (linked && start === null) start = column;
      if (!linked && start !== null) return text.slice(start, column);
    }
    return null;
  }

  describe("markdown delimiters", () => {
    it("stops at the closing paren of a link wrapped in emphasis", async () => {
      expect(await linkIn("**[Lumine](https://github.com/lumine-code/lumine)**")).toBe(
        "https://github.com/lumine-code/lumine",
      );
      expect(await linkIn("*[a](https://example.com)*")).toBe("https://example.com");
      expect(await linkIn("~~[a](https://example.com)~~")).toBe("https://example.com");
    });

    it("stops at emphasis wrapped around a bare URL", async () => {
      expect(await linkIn("see *https://example.com* italic")).toBe("https://example.com");
      expect(await linkIn("see **https://example.com** bold")).toBe("https://example.com");
      expect(await linkIn("see __https://example.com__ bold")).toBe("https://example.com");
      expect(await linkIn("see `https://example.com` code")).toBe("https://example.com");
    });

    it("stops at a closing bracket or brace", async () => {
      expect(await linkIn("https://example.com]**")).toBe("https://example.com");
      expect(await linkIn("https://example.com}**")).toBe("https://example.com");
    });
  });

  describe("parentheses", () => {
    it("keeps a paired pair", async () => {
      expect(await linkIn("(see https://en.wikipedia.org/wiki/Foo_(bar))")).toBe(
        "https://en.wikipedia.org/wiki/Foo_(bar)",
      );
    });

    it("keeps nested paired pairs", async () => {
      expect(await linkIn("https://example.com/a(b(c)d)e")).toBe("https://example.com/a(b(c)d)e");
    });

    it("stops at an unpaired closing paren", async () => {
      expect(await linkIn("https://example.com)x")).toBe("https://example.com");
      expect(await linkIn("[a](https://example.com)")).toBe("https://example.com");
    });
  });

  describe("URLs that keep their punctuation", () => {
    it("keeps characters that only look like delimiters mid-URL", async () => {
      expect(await linkIn("https://example.com/a_b/c-d")).toBe("https://example.com/a_b/c-d");
      expect(await linkIn("https://example.com/a*b/c")).toBe("https://example.com/a*b/c");
      expect(await linkIn("https://example.com/~user")).toBe("https://example.com/~user");
      expect(await linkIn("https://example.com/?filter[name]=x")).toBe(
        "https://example.com/?filter[name]=x",
      );
      expect(await linkIn("https://user@example.com:8080/x?a=1&b=2")).toBe(
        "https://user@example.com:8080/x?a=1&b=2",
      );
    });
  });

  describe("accepted truncations", () => {
    // These are the cost of refusing to end a URL on a markdown delimiter, and
    // they are deliberate: GFM's autolink extension excludes `? ! . , : * _ ~`
    // from the end of an autolink and truncates all three of these the same
    // way. Recorded so a future change to the character classes has to argue
    // with them rather than discover them.
    it("trims a genuine trailing asterisk or underscore", async () => {
      expect(await linkIn("https://api.example.com/search?q=*")).toBe(
        "https://api.example.com/search?q=",
      );
      expect(await linkIn("https://example.com/foo_")).toBe("https://example.com/foo");
    });

    it("cuts a URL short at an unpaired closing paren in its path", async () => {
      expect(await linkIn("https://example.com/a)b/c")).toBe("https://example.com/a");
    });
  });
});
