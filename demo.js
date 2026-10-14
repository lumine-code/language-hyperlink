// Authentic package usage. Run with lumine/script/demo.js; fixtures stay in demo/.
module.exports = {
  version: 1,
  dependencies: ["language-javascript"],
  viewport: { width: 1100, height: 340 },
  async before() {},
  async prepare(context) {
    const { lumine, state, open } = context;
    state.editor = await open("usage/signal.js");

    lumine.grammars.assignLanguageMode(state.editor.getBuffer(), "source.js");
    await state.editor.getBuffer().getLanguageMode().ready;
    await state.editor.getBuffer().getLanguageMode().atGrammarSettlement?.();
  },
  scenes: [
    {
      id: "scene-1",
      file: "demo.png",
      caption: "Highlight URLs inside comments and strings.",
      timeout: 60000,
      async run() {},
      ready(context) {
        const { state } = context;
        return Boolean(state.editor.getGrammar().scopeName === "source.js");
      },
    },
  ],
  async cleanup() {},
};
