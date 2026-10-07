// Asserts where the Tree-sitter grammar decides a URL ends.
//
// `text.hyperlink` is only ever injected in real use, but it is a registered
// grammar like any other, so assigning it to a buffer directly exercises the
// parser and `hyperlink-highlights.scm` without dragging in a host language package —
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
    await lumine.packages.activatePackage("language-hyperlink");
  });

  // Returns the substring of `text` that carries the link scope, or null when
  // nothing does.
  async function linkIn(text) {
    const editor = await lumine.workspace.open();
    editor.setGrammar(lumine.grammars.grammarForScopeName("text.hyperlink"));
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

  async function openText(text) {
    const editor = await lumine.workspace.open();
    editor.setGrammar(lumine.grammars.grammarForScopeName("text.hyperlink"));
    await editor.languageMode.ready;
    editor.setText(text);
    await editor.languageMode.atTransactionEnd();
    return editor;
  }

  function links(editor) {
    return editor.languageMode.rootLanguageLayer.tree.rootNode.descendantsOfType("url");
  }

  function expectLinkScopes(editor, expected) {
    const nodes = links(editor);
    expect(nodes.map((node) => node.text)).toEqual(expected);
    for (const node of nodes) {
      const startScopes = editor
        .scopeDescriptorForBufferPosition(node.startPosition)
        .getScopesArray();
      expect(startScopes.includes(LINK_SCOPE)).withContext(JSON.stringify(startScopes)).toBe(true);
      const inside = editor.getBuffer().positionForCharacterIndex(node.endIndex - 1);
      expect(
        editor.scopeDescriptorForBufferPosition(inside).getScopesArray().includes(LINK_SCOPE),
      ).toBe(true);
      // EOF has no character to the right and may report the preceding scope.
      if (node.endIndex < editor.getText().length) {
        const endScopes = editor
          .scopeDescriptorForBufferPosition(node.endPosition)
          .getScopesArray();
        expect(endScopes.includes(LINK_SCOPE)).withContext(JSON.stringify(endScopes)).toBe(false);
      }
    }
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
    it("starts separate captured and scoped links at HTTP prefixes inside parentheses", async () => {
      for (const [text, expected] of [
        [
          "https://example.com/a(http://other.example/path)",
          ["https://example.com/a", "http://other.example/path"],
        ],
        [
          "https://example.com(https://other.example/a(b)",
          ["https://example.com", "https://other.example/a(b)"],
        ],
      ]) {
        const editor = await openText(text);
        expectLinkScopes(editor, expected);
        expect(editor.languageMode.rootLanguageLayer.tree.rootNode.hasError).toBe(false);
      }
    });

    it("updates link captures and scopes when parentheses become complete or incomplete", async () => {
      const editor = await openText("https://example.com/a(b");
      expectLinkScopes(editor, ["https://example.com/a"]);
      editor.getBuffer().append(")");
      await editor.languageMode.atTransactionEnd();
      expectLinkScopes(editor, ["https://example.com/a(b)"]);
      editor.getBuffer().delete([
        [0, editor.getText().length - 1],
        [0, editor.getText().length],
      ]);
      await editor.languageMode.atTransactionEnd();
      expectLinkScopes(editor, ["https://example.com/a"]);
      editor.setText("https://example.com/a(https://other.example/path)");
      await editor.languageMode.atTransactionEnd();
      expectLinkScopes(editor, ["https://example.com/a", "https://other.example/path"]);
      expect(editor.languageMode.rootLanguageLayer.tree.rootNode.hasError).toBe(false);
    });

    it("keeps root parser work linear for repeated incomplete URL groups", async () => {
      for (const count of [512, 1024]) {
        const editor = await openText("");
        const languageMode = editor.languageMode;
        const acquire = languageMode.acquireParserForLanguage;
        const parsers = new Set();
        let consumed = 0;
        let processed = 0;
        let reduced = 0;
        spyOn(languageMode, "acquireParserForLanguage").and.callFake(function (...args) {
          const parser = acquire.apply(this, args);
          parsers.add(parser);
          parser.setLogger((message) => {
            if (message.startsWith("consume ")) consumed++;
            if (message.startsWith("process ")) processed++;
            if (message.startsWith("reduce ")) reduced++;
          });
          return parser;
        });
        try {
          const source = "https://x(".repeat(count);
          editor.setText(source);
          await languageMode.atTransactionEnd();
          expect(links(editor).length).toBe(count);
          expect(languageMode.rootLanguageLayer.tree.rootNode.hasError).toBe(false);
          expect(consumed).toBeGreaterThan(0);
          expect(consumed).toBeLessThan(source.length * 8);
          expect(processed).toBeLessThan(source.length * 5);
          expect(reduced).toBeLessThan(source.length * 5);
          expectLinkScopes(editor, Array(count).fill("https://x"));
        } finally {
          for (const parser of parsers) parser.setLogger(null);
        }
      }
    });

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

    it("stops before an incomplete opening group", async () => {
      expect(await linkIn("https://example.com/a(b")).toBe("https://example.com/a");
      expect(await linkIn("https://example.com/a(b(c)d")).toBe("https://example.com/a");
      expect(await linkIn("https://example.com/a(b)c(d")).toBe("https://example.com/a(b)c");
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

  describe("URLs before trailing prose", () => {
    it("recognizes a URL after a NUL character", async () => {
      expect(await linkIn("\0https://example.com/a\0")).toBe("https://example.com/a");
    });

    it("keeps the complete query string", async () => {
      expect(await linkIn("before https://example.com/path?q=1 after")).toBe(
        "https://example.com/path?q=1",
      );
      expect(await linkIn("before https://example.com/?filter[name]=x&page=2 after")).toBe(
        "https://example.com/?filter[name]=x&page=2",
      );
      expect(await linkIn("before https://example.com/foo?first=1;second=2 after")).toBe(
        "https://example.com/foo?first=1;second=2",
      );
      expect(await linkIn("before https://example.com/foo?first=1?second=2 after")).toBe(
        "https://example.com/foo?first=1?second=2",
      );
    });

    it("keeps punctuation inside the path", async () => {
      expect(await linkIn("before https://example.com/a_b/file.name after")).toBe(
        "https://example.com/a_b/file.name",
      );
      expect(await linkIn("before https://example.com/a,b:c;d after")).toBe(
        "https://example.com/a,b:c;d",
      );
    });

    it("keeps fragments with and without a query", async () => {
      expect(await linkIn("before https://example.com/path#section after")).toBe(
        "https://example.com/path#section",
      );
      expect(await linkIn("before https://example.com/path?q=1#section after")).toBe(
        "https://example.com/path?q=1#section",
      );
    });

    it("stops at prose punctuation and surrounding delimiters after a query", async () => {
      expect(await linkIn("before (https://example.com/path?q=1). after")).toBe(
        "https://example.com/path?q=1",
      );
      expect(await linkIn("before **[site](https://example.com/path?q=1)** after")).toBe(
        "https://example.com/path?q=1",
      );
      expect(await linkIn("before <https://example.com/path?q=1> after")).toBe(
        "https://example.com/path?q=1",
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
