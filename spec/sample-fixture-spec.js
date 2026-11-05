const path = require("path");

// Hyperlink is an injection-only grammar, so its representative sample uses
// Markdown as a real host rather than inventing a file type the package does
// not own.

describe("Hyperlink sample fixture", () => {
  beforeEach(async () => {
    await lumine.packages.activatePackage("language-hyperlink");
    await lumine.packages.activatePackage("language-gfm");
  });

  it("highlights an inline-code URL through the Markdown hyperlink injection", async () => {
    const editor = await lumine.workspace.open(path.join(__dirname, "fixtures", "sample.md"));
    const languageMode = editor.getBuffer().getLanguageMode();
    await languageMode.ready;
    await languageMode.atTransactionEnd();

    // GFM owns bare prose URLs natively. Its injection deliberately includes
    // code spans, where this package must still own the URL's complete scope.
    const needle = "https://example.com/docs?view=compact&lang=en";
    const index = editor.getText().indexOf(needle);
    expect(index).not.toBe(-1);
    const position = editor.getBuffer().positionForCharacterIndex(index);

    expect(editor.getGrammar().scopeName).toBe("source.gfm");
    const root = await editor.analyzeSyntax(require.resolve("./helpers/syntax-tree"), "inspect");
    expect(root.hasError).toBe(false);
    languageMode.requestHighlighting(editor, [[position.row, position.row]]);
    await languageMode.refresh?.();
    await languageMode.presentation?.flush();
    await conditionPromise(() =>
      editor
        .scopeDescriptorForBufferPosition(position)
        .getScopesArray()
        .includes("markup.underline.link.hyperlink"),
    );
    const scopes = editor.scopeDescriptorForBufferPosition(position).getScopesArray();
    expect(scopes).toContain("markup.raw.inline.gfm");
    expect(scopes).not.toContain("markup.underline.link.gfm");
    const range = await editor.bufferRangeForScopeAtPosition(
      ".markup.underline.link.hyperlink",
      position,
    );
    const end = editor.getBuffer().positionForCharacterIndex(index + needle.length);
    expect(range.serialize()).toEqual([position.toArray(), end.toArray()]);
  });
});
