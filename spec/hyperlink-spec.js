const path = require("path");

describe("Hyperlink grammar", function () {
  let grammar = null;

  beforeEach(async () => {
    // These specs all tokenize a line in isolation, which only a TextMate
    // grammar can do, so this file covers `grammars/hyperlink.json` alone.
    // The Tree-sitter grammar is covered by `tree-sitter-grammar-spec.js`,
    // which asserts scope ranges in a real buffer instead.
    lumine.config.set("editor.useTreeSitterParsers", false);
    await lumine.packages.activatePackage("language-hyperlink");

    grammar = lumine.grammars.grammarForScopeName("text.hyperlink");
  });

  it("parses the grammar", function () {
    expect(grammar).toBeTruthy();
    expect(grammar.scopeName).toBe("text.hyperlink");
  });

  it("parses http: and https: links", function () {
    const plainGrammar = lumine.grammars.selectGrammar();

    let { tokens } = plainGrammar.tokenizeLine("http://github.com");
    expect(tokens[0]).toEqual({
      value: "http://github.com",
      scopes: ["text.plain.null-grammar", "markup.underline.link.http.hyperlink"],
    });

    ({ tokens } = plainGrammar.tokenizeLine("https://github.com"));
    expect(tokens[0]).toEqual({
      value: "https://github.com",
      scopes: ["text.plain.null-grammar", "markup.underline.link.https.hyperlink"],
    });

    ({ tokens } = plainGrammar.tokenizeLine("http://twitter.com/#!/LumineEditor"));
    expect(tokens[0]).toEqual({
      value: "http://twitter.com/#!/LumineEditor",
      scopes: ["text.plain.null-grammar", "markup.underline.link.http.hyperlink"],
    });

    ({ tokens } = plainGrammar.tokenizeLine("https://github.com/example/brightray_example"));
    expect(tokens[0]).toEqual({
      value: "https://github.com/example/brightray_example",
      scopes: ["text.plain.null-grammar", "markup.underline.link.https.hyperlink"],
    });
  });

  it("parses http: and https: links that contains unicode characters", function () {
    const plainGrammar = lumine.grammars.selectGrammar();

    const { tokens } = plainGrammar.tokenizeLine("https://sv.wikipedia.org/wiki/Mañana");
    expect(tokens[0]).toEqual({
      value: "https://sv.wikipedia.org/wiki/Mañana",
      scopes: ["text.plain.null-grammar", "markup.underline.link.https.hyperlink"],
    });
  });

  it("parses other links", function () {
    const plainGrammar = lumine.grammars.selectGrammar();

    let { tokens } = plainGrammar.tokenizeLine("mailto:noreply@example.com");
    expect(tokens[0]).toEqual({
      value: "mailto:noreply@example.com",
      scopes: ["text.plain.null-grammar", "markup.underline.link.mailto.hyperlink"],
    });

    ({ tokens } = plainGrammar.tokenizeLine("x-man-page://tar"));
    expect(tokens[0]).toEqual({
      value: "x-man-page://tar",
      scopes: ["text.plain.null-grammar", "markup.underline.link.x-man-page.hyperlink"],
    });

    ({ tokens } = plainGrammar.tokenizeLine(
      "lumine://core/open/file?filename=urlEncodedFileName&line=n&column=n",
    ));
    expect(tokens[0]).toEqual({
      value: "lumine://core/open/file?filename=urlEncodedFileName&line=n&column=n",
      scopes: ["text.plain.null-grammar", "markup.underline.link.lumine.hyperlink"],
    });
  });

  it("does not parse links in a regex string", function () {
    const testGrammar = lumine.grammars.loadGrammarSync(
      path.join(__dirname, "fixtures", "test-grammar.json"),
    );

    const { tokens } = testGrammar.tokenizeLine("regexp:http://github.com");
    expect(tokens[1]).toEqual({
      value: "http://github.com",
      scopes: ["source.test", "string.regexp.test"],
    });
  });

  describe("parsing a text-rooted grammar", function () {
    // A grammar that embeds code in a `text.*` root — PHP is the one everybody
    // meets, `text.html.php` wrapping `source.php` — matches the `text` branch of
    // the injection selector at every position, including inside a regex string
    // that the `string` branch already excludes. `text - string.regexp` is what
    // carries the exclusion across to that branch.
    // https://github.com/atom/language-php/issues/219
    let textGrammar = null;

    beforeEach(() => {
      textGrammar = lumine.grammars.loadGrammarSync(
        path.join(__dirname, "fixtures", "test-text-grammar.json"),
      );
    });

    it("parses links in embedded code", function () {
      const { tokens } = textGrammar.tokenizeLine("<? http://github.com ?>");
      expect(tokens[2]).toEqual({
        value: "http://github.com",
        scopes: ["text.test", "source.embedded.test", "markup.underline.link.http.hyperlink"],
      });
    });

    it("does not parse links in a regex string", function () {
      const { tokens } = textGrammar.tokenizeLine('<? "/mailto:/" ?>');
      expect(tokens[3]).toEqual({
        value: "/mailto:/",
        scopes: ["text.test", "source.embedded.test", "string.regexp.test"],
      });
    });
  });

  describe("parsing cfml strings", function () {
    it("does not include anything between (and including) pound signs", function () {
      const plainGrammar = lumine.grammars.selectGrammar();
      const { tokens } = plainGrammar.tokenizeLine("http://github.com/#username#");
      expect(tokens[0]).toEqual({
        value: "http://github.com/",
        scopes: ["text.plain.null-grammar", "markup.underline.link.http.hyperlink"],
      });
    });

    it("still includes single pound signs", function () {
      const plainGrammar = lumine.grammars.selectGrammar();
      const { tokens } = plainGrammar.tokenizeLine("http://github.com/example/#start-of-content");
      expect(tokens[0]).toEqual({
        value: "http://github.com/example/#start-of-content",
        scopes: ["text.plain.null-grammar", "markup.underline.link.http.hyperlink"],
      });
    });
  });

  describe("parsing matching parentheses", function () {
    it("still includes matching parentheses", function () {
      const plainGrammar = lumine.grammars.selectGrammar();
      const { tokens } = plainGrammar.tokenizeLine(
        "https://en.wikipedia.org/wiki/Example_(text_editor)",
      );
      expect(tokens[0]).toEqual({
        value: "https://en.wikipedia.org/wiki/Example_(text_editor)",
        scopes: ["text.plain.null-grammar", "markup.underline.link.https.hyperlink"],
      });
    });

    it("does not include wrapping parentheses", function () {
      const plainGrammar = lumine.grammars.selectGrammar();
      const { tokens } = plainGrammar.tokenizeLine(
        "(https://en.wikipedia.org/wiki/Example_(text_editor))",
      );
      expect(tokens[1]).toEqual({
        value: "https://en.wikipedia.org/wiki/Example_(text_editor)",
        scopes: ["text.plain.null-grammar", "markup.underline.link.https.hyperlink"],
      });
    });
  });

  describe("parsing trailing punctuation", function () {
    // `_` and `~` are in the character class, so without the trailing guard a
    // markdown emphasis or strikethrough closer is swallowed by the link. They
    // stay legal in the middle of a URL — only the last character is refused.
    it("does not include a trailing underscore", function () {
      const plainGrammar = lumine.grammars.selectGrammar();
      const { tokens } = plainGrammar.tokenizeLine("http://example.com/foo_");
      expect(tokens[0]).toEqual({
        value: "http://example.com/foo",
        scopes: ["text.plain.null-grammar", "markup.underline.link.http.hyperlink"],
      });
    });

    it("still includes an underscore in the middle", function () {
      const plainGrammar = lumine.grammars.selectGrammar();
      const { tokens } = plainGrammar.tokenizeLine("http://example.com/a_b/c");
      expect(tokens[0]).toEqual({
        value: "http://example.com/a_b/c",
        scopes: ["text.plain.null-grammar", "markup.underline.link.http.hyperlink"],
      });
    });

    it("does not include trailing tildes", function () {
      const plainGrammar = lumine.grammars.selectGrammar();
      const { tokens } = plainGrammar.tokenizeLine("~~http://example.com~~");
      expect(tokens[1]).toEqual({
        value: "http://example.com",
        scopes: ["text.plain.null-grammar", "markup.underline.link.http.hyperlink"],
      });
    });

    it("does not include a trailing exclamation mark or pipe", function () {
      const plainGrammar = lumine.grammars.selectGrammar();

      let { tokens } = plainGrammar.tokenizeLine("http://example.com!");
      expect(tokens[0]).toEqual({
        value: "http://example.com",
        scopes: ["text.plain.null-grammar", "markup.underline.link.http.hyperlink"],
      });

      ({ tokens } = plainGrammar.tokenizeLine("http://example.com|"));
      expect(tokens[0]).toEqual({
        value: "http://example.com",
        scopes: ["text.plain.null-grammar", "markup.underline.link.http.hyperlink"],
      });
    });

    it("applies the same guard to mailto: links", function () {
      const plainGrammar = lumine.grammars.selectGrammar();
      const { tokens } = plainGrammar.tokenizeLine("mailto:noreply@example.com_");
      expect(tokens[0]).toEqual({
        value: "mailto:noreply@example.com",
        scopes: ["text.plain.null-grammar", "markup.underline.link.mailto.hyperlink"],
      });
    });
  });
});
