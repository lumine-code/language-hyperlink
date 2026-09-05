const path = require("path");

// Hyperlink is an injection-only grammar, so its representative sample uses
// Markdown as a real host rather than inventing a file type the package does
// not own.

describe("Hyperlink sample fixture", () => {
  beforeEach(async () => {
    await lumine.packages.activatePackage("language-hyperlink");
    await lumine.packages.activatePackage("language-gfm");
  });

  it("highlights links injected into sample.md", async () => {
    const editor = await lumine.workspace.open(path.join(__dirname, "fixtures", "sample.md"));
    const languageMode = editor.getBuffer().getLanguageMode();
    await languageMode.ready;
    await languageMode.atTransactionEnd();

    const needle = "https://example.com/docs";
    const index = editor.getText().indexOf(needle);
    expect(index).not.toBe(-1);
    const position = editor.getBuffer().positionForCharacterIndex(index);

    expect(editor.getGrammar().scopeName).toBe("source.gfm");
    expect(languageMode.tree.rootNode.hasError).toBe(false);
    await conditionPromise(() =>
      editor
        .scopeDescriptorForBufferPosition(position)
        .getScopesArray()
        .includes("markup.underline.link.hyperlink"),
    );
  });
});
